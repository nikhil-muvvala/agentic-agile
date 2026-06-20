import { GoogleGenAI } from '@google/genai';
import { db } from "../../db/index.js";
import { tasksTable, projectMembers, taskCompletionsTable, usersTable } from "../../models/index.js";
import { eq, and, ne, inArray, desc } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { createWeightedVector } from "../../utils/aiGatekeeper.js";
import { createNotification } from "../../services/addNotification.js";
import { cos_sim } from '@xenova/transformers';

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const triggerEventAgent = async (task, eventType, projectId, triggerUserId) => {
    try {
        console.log(`[EventAgent] Waking up for Task #${task.id} (${eventType})`);

        // Get admins
        const members = await db.select({ userId: projectMembers.userId, role: projectMembers.role })
            .from(projectMembers)
            .where(eq(projectMembers.projectId, projectId));
            
        const admins = members.filter(m => ['admin', 'project_admin'].includes(m.role)).map(m => m.userId);
        if (admins.length === 0) return; // No admins to notify

        // 3. TOOL IMPLEMENTATIONS
        const functions = {
            get_related_open_tasks: async ({ taskId }) => {
                const targetTask = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
                if (!targetTask[0]) return [];
                
                const vector = await createWeightedVector(targetTask[0].title, targetTask[0].description);
                const openTasks = await db.select().from(tasksTable)
                    .where(and(
                        eq(tasksTable.projectId, projectId), 
                        ne(tasksTable.id, taskId), 
                        ne(tasksTable.status, 'done')
                    ));
                
                let related = [];
                for (const t of openTasks) {
                    const v = await createWeightedVector(t.title, t.description);
                    const sim = cos_sim(vector, v);
                    if (sim > 0.4) {
                        related.push({ id: t.id, title: t.title, status: t.status, similarity: sim.toFixed(2) });
                    }
                }
                return related.sort((a,b) => b.similarity - a.similarity).slice(0, 3);
            },
            get_user_capacity: async ({ userId }) => {
                const activeTasks = await db.select().from(tasksTable)
                    .where(and(
                        eq(tasksTable.assigneeId, userId),
                        eq(tasksTable.projectId, projectId),
                        inArray(tasksTable.status, ['todo', 'in_progress'])
                    ));
                return { activeTasksCount: activeTasks.length, taskTitles: activeTasks.map(t => t.title) };
            },
            search_past_solutions: async ({ query }) => {
                const queryVector = await createWeightedVector(query, "");
                const completions = await db.select({
                    taskId: taskCompletionsTable.taskId,
                    assigneeId: taskCompletionsTable.assigneeId,
                    vector: taskCompletionsTable.vector,
                    daysToComplete: taskCompletionsTable.daysToComplete
                }).from(taskCompletionsTable)
                  .orderBy(desc(taskCompletionsTable.completedAt))
                  .limit(150);

                let groupedBySolver = {};
                for (const comp of completions) {
                    const sim = cos_sim(queryVector, comp.vector);
                    if (sim > 0.3) {
                        const originalTask = await db.select().from(tasksTable).where(eq(tasksTable.id, comp.taskId)).limit(1);
                        if (originalTask[0]) {
                            if (!groupedBySolver[comp.assigneeId]) {
                                groupedBySolver[comp.assigneeId] = {
                                    solverUserId: comp.assigneeId,
                                    totalSimilarity: 0,
                                    relatedTasks: []
                                };
                            }
                            groupedBySolver[comp.assigneeId].totalSimilarity += sim;
                            groupedBySolver[comp.assigneeId].relatedTasks.push({
                                title: originalTask[0].title,
                                similarity: sim.toFixed(2)
                            });
                        }
                    }
                }
                
                let results = Object.values(groupedBySolver).sort((a,b) => b.totalSimilarity - a.totalSimilarity);
                return results.slice(0, 2);
            },
            get_task_recommendations: async ({ userId }) => {
                // 1. Check if Newcomer
                const userCompletions = await db.select().from(taskCompletionsTable).where(eq(taskCompletionsTable.assigneeId, userId));
                
                let isNewcomer = userCompletions.length === 0;
                let userSkills = [];

                const userInfo = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
                if (userInfo[0] && userInfo[0].skills) {
                    userSkills = Array.isArray(userInfo[0].skills) ? userInfo[0].skills : [userInfo[0].skills];
                }

                // Fetch all todo tasks
                const allTodos = await db.select().from(tasksTable).where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.status, 'todo')));
                
                let unassignedMatches = [];
                let assignedMatches = [];

                for (const t of allTodos) {
                    let maxSimScore = 0;
                    if (!isNewcomer) {
                        const tVector = await createWeightedVector(t.title, t.description);
                        // Max Pooling: Find the highest similarity to ANY single past task
                        for (const comp of userCompletions) {
                            const sim = cos_sim(comp.vector, tVector);
                            if (sim > maxSimScore) maxSimScore = sim;
                        }
                    }

                    if (t.assigneeId === null) {
                        unassignedMatches.push({
                            id: t.id,
                            title: t.title,
                            similarity: isNewcomer ? "N/A" : maxSimScore.toFixed(2)
                        });
                    } else if (maxSimScore > 0.4) {
                        // Check assignee workload
                        const activeTasks = await db.select().from(tasksTable)
                            .where(and(
                                eq(tasksTable.assigneeId, t.assigneeId),
                                eq(tasksTable.projectId, projectId),
                                inArray(tasksTable.status, ['todo', 'in_progress'])
                            ));
                        
                        assignedMatches.push({
                            id: t.id,
                            title: t.title,
                            currentAssigneeId: t.assigneeId,
                            currentAssigneeWorkload: activeTasks.length,
                            similarity: maxSimScore.toFixed(2)
                        });
                    }
                }

                if (!isNewcomer) {
                    unassignedMatches.sort((a,b) => parseFloat(b.similarity) - parseFloat(a.similarity));
                    assignedMatches.sort((a,b) => parseFloat(b.similarity) - parseFloat(a.similarity));
                }

                return {
                    isNewcomer,
                    userSkills,
                    topUnassigned: unassignedMatches.slice(0, 4),
                    topAssignedStealCandidates: assignedMatches.slice(0, 2)
                };
            }
        };

        const tools = [{
            functionDeclarations: [
                {
                    name: "get_related_open_tasks",
                    description: "Finds semantic duplicate or highly related open tasks in the current project to avoid redundant work.",
                    parameters: { type: "OBJECT", properties: { taskId: { type: "NUMBER" } }, required: ["taskId"] }
                },
                {
                    name: "get_user_capacity",
                    description: "Checks how many active tasks a user currently has assigned to them.",
                    parameters: { type: "OBJECT", properties: { userId: { type: "NUMBER" } }, required: ["userId"] }
                },
                {
                    name: "search_past_solutions",
                    description: "Searches the database for similar tasks that were completed in the past to find a solution.",
                    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] }
                },
                {
                    name: "get_task_recommendations",
                    description: "Analyzes the backlog to recommend tasks for a specific user using mathematical vector similarity. Also identifies tasks that could be re-assigned if the current assignee is overloaded.",
                    parameters: { type: "OBJECT", properties: { userId: { type: "NUMBER" } }, required: ["userId"] }
                }
            ]
        }];

        const systemPrompt = `You are an elite autonomous Engineering Manager for an Agile project.
You monitor task events and advise human Project Admins.
Event Type: ${eventType}
Task: "${task.title}"
Description: "${task.description || 'No description provided'}"
Status: ${task.status}
Assignee: ${task.assigneeId || 'Unassigned'}

Reasoning Rules:
1. If a task is CREATED or MODIFIED, check for duplicates using get_related_open_tasks.
2. If a task is BLOCKED, use search_past_solutions to find how similar tasks were resolved.
3. If a task is DONE, DELETED, or BLOCKED, and it has an assignee, check their capacity using get_user_capacity because they might now be completely free!
4. If a user is free (0 active tasks), call get_task_recommendations. 
   - If they are a Newcomer, match their skills to the unassigned tasks.
   - If they are a Veteran, suggest the highest-scoring unassigned task.
   - If unassigned tasks aren't suitable, check the "Steal Candidates". If the current assignee of a steal candidate is overloaded (>2 tasks), suggest re-assigning it to the free user.
   - If nothing fits, tell the Admin "[User Name] is free, plan accordingly."

Respond strictly in JSON:
{
  "shouldNotify": true,
  "notificationMessage": "A concise, actionable message for the Project Admin."
}
If no action is needed, set shouldNotify: false.`;

        let chat = aiClient.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: systemPrompt,
                tools: tools,
                temperature: 0.1
            }
        });

        let assigneeName = "Unknown";
        if (task.assigneeId) {
            const userRec = await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId)).limit(1);
            if (userRec[0]) assigneeName = userRec[0].name;
        }

        const assigneeContext = task.assigneeId ? `It is assigned to ${assigneeName} (User ID ${task.assigneeId}).` : 'It is unassigned.';
        const userMessage = `Event: ${eventType} on Task ID: ${task.id}.\nCurrent Status: ${task.status}.\n${assigneeContext}\nPlease analyze.`;
        let response = await chat.sendMessage({ message: userMessage });

        while (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            const func = functions[call.name];
            let result;
            if (func) {
                result = await func(call.args);
            } else {
                result = { error: "Function not found" };
            }
            response = await chat.sendMessage({
                message: [{
                    functionResponse: {
                        name: call.name,
                        response: { data: result }
                    }
                }]
            });
        }

        const rawText = response.text || "";
        const cleanJsonText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const finalData = JSON.parse(cleanJsonText);

        if (finalData.shouldNotify && finalData.notificationMessage) {
            // 4. ROUTING: Target specific users based on event rules
            let targetUserIds = admins; // Default to all admins for "Plan accordingly" and "Steal Candidate" events

            if (eventType === 'TASK_CREATED' && admins.includes(triggerUserId)) {
                targetUserIds = [triggerUserId]; // Only notify the admin who created it
            }

            // Securely route the notification ONLY to the active socket rooms of the target users
            targetUserIds.forEach(userId => {
                // 1. Transient Toast Pop-up
                getIO().to(`user_${userId}`).emit("ai_advisor_alert", {
                    message: finalData.notificationMessage,
                    taskId: task.id
                });
                
                // 2. Persistent Database Notification (for the bell icon inbox)
                // Pass triggerUserId as the sender to satisfy the DB NOT NULL constraint
                createNotification(userId, triggerUserId, "🤖 AI Advisor: " + finalData.notificationMessage).catch(console.error);
            });
            console.log(`[EventAgent] Sent secure targeted notification to ${targetUserIds.length} admins.`);
        } else {
            console.log(`[EventAgent] Analysis complete. No notification needed.`);
        }

    } catch (err) {
        console.error("[EventAgent] Error during background execution:", err);
    }
};
