import { db } from "../../db/index.js";
import { tasksTable, subtasksTable, projectsTable } from "../../models/index.js";
import { eq } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { aiClient } from "../../config/ai.js";
import { createNotification } from "../../services/addNotification.js";

// POST /api/v1/projects/:projectId/tasks/:taskId/ai-breakdown/generate
export const generateSubtasks = async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const { previousSuggestions } = req.body;

        const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        if (!task) return res.status(404).json({ message: "Task not found" });

        // Security check: Only admins or the assigned member can generate AI subtasks
        if (req.userRole === "member" && task.assigneeId !== req.user.id) {
            return res.status(403).json({ message: "Only the assigned member or an admin can use AI breakdown on this task" });
        }

        // Fetch Project Context to make the AI smarter
        const projectId = parseInt(req.params.projectId);
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
        const projectName = project ? project.name : "Unknown Project";
        const projectDescription = project ? (project.description || "No description provided.") : "No description provided.";

        // Fetch Existing Subtasks to avoid duplicates
        const existingSubtasksRecords = await db.select().from(subtasksTable).where(eq(subtasksTable.taskId, taskId));
        const existingSubtasks = existingSubtasksRecords.map(st => st.title);

        let prompt = `You are an expert, highly-logical Agile Project Manager.
Context: We are working on a project named "${projectName}".
Project Description: "${projectDescription}"
Your goal is to break down the following specific task into actionable subtasks.

Task Title: "${task.title}"
Task Description: "${task.description || 'No description provided.'}"

RULES:
1. If the Task Title or Description is complete gibberish (e.g., "asdf", "test"), meaningless, or lacks enough context for you to deduce what needs to be done, YOU MUST ABORT. To abort, return exactly this JSON array: ["I_DONT_KNOW"]
2. If the task makes sense, generate between 2 and 6 actionable subtasks depending on its complexity.
3. Keep the subtasks concise, professional, and directly related to the task.
4. Do NOT duplicate any of these existing subtasks that the user has already created: ${JSON.stringify(existingSubtasks)}
`;
        
        if (previousSuggestions && previousSuggestions.length > 0) {
            prompt += `\n5. The user explicitly REJECTED these ideas you gave them previously: ${JSON.stringify(previousSuggestions)}. You MUST provide completely different suggestions this time.\n`;
        }
        
        prompt += `\nOUTPUT FORMAT: Return ONLY a raw JSON array of strings. Do not use markdown formatting blocks like \`\`\`json. Return pure JSON. Example: ["Setup database", "Create API route"]`;

        // We use a low temperature (0.2) to force the AI to be logical and strict, not creative.
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2
            }
        });

        let textResponse = "";
        if (typeof response.text === 'function') {
            textResponse = response.text();
        } else {
            textResponse = response.text;
        }
        let cleanText = textResponse.trim();
        
        // Safety cleanup if the AI hallucinates markdown anyway
        if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
        if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);

        const subtasks = JSON.parse(cleanText.trim());

        // Check if the AI decided the task was gibberish
        if (subtasks.length === 1 && subtasks[0] === "I_DONT_KNOW") {
            return res.status(400).json({ message: "AI could not understand this task. The title/description is too vague or meaningless." });
        }

        return res.status(200).json({ subtasks });
    } catch (err) {
        console.error("AI Generation Error:", err);
        return res.status(500).json({ message: "Failed to generate AI subtasks" });
    }
};

// POST /api/v1/projects/:projectId/tasks/:taskId/ai-breakdown/save
export const saveAiSubtasks = async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const projectId = parseInt(req.params.projectId);
        const { subtasks } = req.body; // array of strings

        if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
            return res.status(400).json({ message: "No subtasks provided" });
        }

        const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        if (!task) return res.status(404).json({ message: "Task not found" });

        // Security check: Only admins or the assigned member can save AI subtasks
        if (req.userRole === "member" && task.assigneeId !== req.user.id) {
            return res.status(403).json({ message: "Only the assigned member or an admin can save AI subtasks for this task" });
        }

        const insertData = subtasks.map(title => ({
            taskId,
            title
        }));

        const newSubtasks = await db.insert(subtasksTable).values(insertData).returning();

        // Emit all subtasks at once instead of looping!
        getIO().to(`project_${projectId}`).emit("subtasks_created_batch", newSubtasks);

        // Notify assignee
        if (task && task.assigneeId && task.assigneeId !== req.user.id) {
            const [projectInfo] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
            const projectName = projectInfo ? projectInfo.name : "a project";
            await createNotification(task.assigneeId, req.user.id, `AI generated ${newSubtasks.length} new subtasks for your task in ${projectName}`);
        }

        return res.status(201).json({ message: "Subtasks saved successfully", subtasks: newSubtasks });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
