import { eq, and, gte } from "drizzle-orm";
import { projectsTable, tasksTable, usersTable } from "../../models/index.js";
import { db } from "../../db/index.js";
import { aiClient } from "../../config/ai.js";

export const summarizeWork = async function(req,res) {
    try {
        const projectId = parseInt(req.params.projectId);
        
        // 1. Fetch the project name to give the AI context
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
        if (!project) return res.status(404).json({ message: "Project not found" });

        // 2. Fetch tasks updated in the last 24 hours
        // Note: You do not need to check if the user is in the project here, because 
        // the `validateProjectAccess` middleware will already block unauthorized users before this runs!
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // We use leftJoin with usersTable to get the assignee's name so the AI knows who did what!
        const recentTasks = await db
            .select({
                title: tasksTable.title,
                status: tasksTable.status,
                assigneeName: usersTable.name,
                updatedAt: tasksTable.updatedAt
            })
            .from(tasksTable)
            .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
            .where(
                and(
                    eq(tasksTable.projectId, projectId),
                    gte(tasksTable.updatedAt, twentyFourHoursAgo)
                )
            );

        if (recentTasks.length === 0) {
            return res.status(200).json({ summary: "No tasks were updated in this project in the last 24 hours. The board is quiet!" });
        }

        // 3. Write the prompt
        let prompt = `You are a highly efficient Agile Scrum Master. Your job is to write a brief, professional Daily Standup summary for a project named "${project.name}".
Below is the raw JSON data of tasks that were updated by the team in the last 24 hours.

Task Data:
${JSON.stringify(recentTasks, null, 2)}

INSTRUCTIONS:
1. Write a single, concise paragraph summarizing what the team accomplished yesterday and what is currently in progress.
2. Group related items logically (e.g., "Nikhil completed the API while Sarah started working on the frontend").
3. Do NOT output markdown blocks. Just return the raw paragraph text.
4. Tone: Professional, encouraging, and clear.`;

        // 4. Call Gemini
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2 // Low temperature for factual, professional text
            }
        });

        let textResponse = "";
        if (typeof response.text === 'function') {
            textResponse = response.text();
        } else {
            textResponse = response.text;
        }
        
        let summary = textResponse.trim();
        
        return res.status(200).json({ summary });

    } catch (err) {
        console.error("AI Generation Error:", err);
        return res.status(500).json({ message: "Failed to summarize" });
    }
}