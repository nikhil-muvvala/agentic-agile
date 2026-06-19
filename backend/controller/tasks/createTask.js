import { tasksTable, projectsTable } from "../../models/index.js";
import { db } from "../../db/index.js";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/addNotification.js";
import { eq } from "drizzle-orm";
import { runAiAdvisorInBackground } from "./aiAdvisor.js";
import { ingestMemory } from "../../services/memoryIngestion.js";

export const createTask = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const { title, description, assigneeId, isAgentEnabled, targetDate } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        const newTask = await db.insert(tasksTable).values({
            projectId,
            title,
            description,
            status: "todo", 
            assigneeId: assigneeId || null,
            createdBy: req.user.id,
            targetDate: targetDate ? new Date(targetDate) : null
        }).returning();

        getIO().to(`project_${projectId}`).emit("task_created", { task: newTask[0] });

        if (assigneeId) {
            const [projectInfo] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
            const projectName = projectInfo ? projectInfo.name : "a project";
            await createNotification(assigneeId, req.user.id, `You have been assigned to '${title}' in ${projectName}`);
        }

        // Trigger the Agentic AI in the background ONLY if the user left the toggle ON
        if (isAgentEnabled) {
            runAiAdvisorInBackground(newTask[0], projectId, req.user.id).catch(console.error);
        }

        // Ingest into Project Brain (RAG Vector Database) in the background
        const assigneeContext = assigneeId ? `Assigned to user ID ${assigneeId}.` : "Unassigned.";
        const memoryContent = `Task Title: ${title}\nDescription: ${description || 'No description provided.'}\nStatus: todo\n${assigneeContext}`;
        ingestMemory(projectId, memoryContent, "task_creation", newTask[0].id).catch(console.error);

        return res.status(201).json({ 
            message: "Task created successfully", 
            task: newTask[0] 
        });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};