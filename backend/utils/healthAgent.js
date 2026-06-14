import { eq, and, isNotNull, gte, like, lt, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { tasksTable, subtasksTable, projectMembers, usersTable, notificationsTable, projectsTable } from "../models/index.js";
import { aiClient } from "../config/ai.js";
import { createNotification } from "../services/addNotification.js";

/**
 * The AI Project Advisor
 * Evaluates tasks that are in progress and provides intelligent recommendations to the project admin.
 */
export const evaluateAtRiskTasks = async (projectId) => {
    try {
        console.log(`[Health Agent] Waking up to survey Project ${projectId}...`);

        // Fetch Project Name for notifications
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
        const projectName = project ? project.name : `Project ${projectId}`;

        // 1. Fetch 'in_progress' tasks that are strictly overdue
        const now = new Date();
        
        const activeTasksRecords = await db.select({
            task: tasksTable,
            assigneeName: usersTable.name
        }).from(tasksTable)
            .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
            .where(
                and(
                    eq(tasksTable.projectId, projectId),
                    eq(tasksTable.status, "in_progress"),
                    isNotNull(tasksTable.targetDate),
                    lt(tasksTable.targetDate, now)
                )
            );

        if (activeTasksRecords.length === 0) {
            console.log(`[Health Agent] No active tasks found in Project ${projectId}. Going back to sleep.`);
            return;
        }

        // 2. Find the Ultimate Admin (Fallback)
        const [ultimateAdmin] = await db.select().from(projectMembers)
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.role, "admin")
                )
            );

        if (!ultimateAdmin) {
            console.log(`[Health Agent] No Ultimate Admin found for Project ${projectId}. Cannot notify.`);
            return;
        }

        // 3. Prepare Batch Payload
        const tasksPayload = [];
        const taskIds = activeTasksRecords.map(r => r.task.id);
        
        // Fetch ALL subtasks in one single bulk query (Fixing N+1 Query bug)
        const allSubtasks = await db.select().from(subtasksTable).where(inArray(subtasksTable.taskId, taskIds));
        
        for (const record of activeTasksRecords) {
            const task = record.task;
            // Filter the bulk array in memory instead of hitting the database again
            const taskSubtasks = allSubtasks.filter(st => st.taskId === task.id);
            const subtasksData = taskSubtasks.map(st => `- [${st.isCompleted ? 'X' : ' '}] ${st.title}`).join("\n");
            
            tasksPayload.push({
                taskId: task.id,
                title: task.title,
                description: task.description || "N/A",
                assignee: record.assigneeName || "Unassigned - CRITICAL RISK",
                subtasks: subtasksData || "No subtasks defined."
            });
        }

        // Build the Batch Prompt
        const prompt = `You are an AI Project Manager Advisor.
You are evaluating a batch of overdue "In Progress" tasks. Your goal is to determine if each task is at risk and recommend an action to the Project Admin.

OVERDUE TASKS DATA:
${JSON.stringify(tasksPayload, null, 2)}

INSTRUCTIONS:
1. For each task, evaluate the semantic complexity of the completed subtasks vs. the pending subtasks to determine true progress.
2. Provide a very concise recommendation (under 30 words) for each task. Do you recommend extending the deadline, checking in, or reassigning?
3. You MUST return a valid JSON array containing exactly one object for every task provided.
4. Your response must strictly adhere to this schema:
[
  {
    "taskId": 123,
    "recommendation": "Alice finished the easy setup but the API routing is untouched. Recommend checking in immediately."
  }
]
`;

        console.log(`[Health Agent] Sending 1 Batch API Request for ${tasksPayload.length} task(s)...`);

        // 4. Send exactly ONE request to Gemini to evaluate everything
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                temperature: 0.2,
                responseMimeType: "application/json" 
            }
        });

        let textResponse = typeof response.text === 'function' ? response.text() : response.text;
        
        let recommendationsArray = [];
        try {
            recommendationsArray = JSON.parse(textResponse);
        } catch (parseError) {
            console.error("[Health Agent] Failed to parse JSON from AI:", textResponse);
            return;
        }

        console.log(`[Health Agent] Received batch recommendations. Dispatching notifications...`);

        // 5. Dispatch Notifications Concurrently
        await Promise.all(recommendationsArray.map(async (rec) => {
            try {
                // Find the original task record
                const originalRecord = activeTasksRecords.find(r => r.task.id === rec.taskId);
                if (!originalRecord) return;

                const task = originalRecord.task;
                const notificationMsg = `⚠️ AI Advisor [${projectName}]: Task '${task.title}' - ${rec.recommendation}`;
                
                // Determine exactly who gets this notification
                const targetUserId = task.createdBy ? task.createdBy : ultimateAdmin.userId;

                // Start of the day (Midnight today)
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);

                // Fetch today's notifications and use JS memory check to avoid SQL LIKE wildcard injection
                const todaysNotifications = await db.select().from(notificationsTable)
                    .where(
                        and(
                            eq(notificationsTable.userId, targetUserId),
                            gte(notificationsTable.createdAt, startOfToday)
                        )
                    );

                const alreadyNotified = todaysNotifications.some(n => n.message.includes(`Task '${task.title}'`));

                if (alreadyNotified) {
                    console.log(`[Health Agent] Already notified User ${targetUserId} about Task ${task.id} today. Skipping.`);
                    return;
                }

                // Send Notification
                await createNotification(targetUserId, targetUserId, notificationMsg);
                
                console.log(`[Health Agent] Successfully notified User ${targetUserId} for Task ${task.id}!`);
            } catch (innerError) {
                console.error(`[Health Agent] Failed to process notification for task ${rec.taskId}:`, innerError);
            }
        }));

    } catch (err) {
        console.error(`[Health Agent] Error evaluating project ${projectId}:`, err);
    }
};
