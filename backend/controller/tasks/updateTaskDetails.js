import { db } from "../../db/index.js";
import { tasksTable, projectsTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/addNotification.js";
import { ingestMemory } from "../../services/memoryIngestion.js";
import { triggerEventAgent } from "../ai/eventAgent.js";

export const updateTaskDetails = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);
        const { title, description, assigneeId } = req.body;

        if (!title && !description && assigneeId === undefined) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;

        const [updatedTask] = await db
            .update(tasksTable)
            .set(updateData)
            .where(
                and(
                    eq(tasksTable.id, taskId),
                    eq(tasksTable.projectId, projectId)
                )
            )
            .returning();

        if (!updatedTask) {
            return res.status(404).json({ message: "Task not found in this project" });
        }

        // Emit real-time event to the specific project room!
        getIO().to(`project_${projectId}`).emit("task_updated", {
            message: "Task details updated",
            task: updatedTask,
            taskId: taskId,
            updatedFields: updateData
        });

        triggerEventAgent(updatedTask, 'TASK_MODIFIED', projectId, req.user.id).catch(console.error);

        if (updateData.assigneeId) {
            const [projectInfo] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
            const projectName = projectInfo ? projectInfo.name : "a project";
            await createNotification(updateData.assigneeId, req.user.id, `You have been assigned to '${updatedTask.title}' in ${projectName}`);
        }

        // Project Knowledge Ingestion
        const assigneeContext = updatedTask.assigneeId ? `Assigned to user ID ${updatedTask.assigneeId}.` : "Unassigned.";
        const memoryContent = `Task Title: ${updatedTask.title}\nDescription: ${updatedTask.description || 'No description provided.'}\nStatus: ${updatedTask.status}\n${assigneeContext}`;
        ingestMemory(projectId, memoryContent, 'task_update', taskId).catch(console.error);

        return res.status(200).json({ message: "Task details updated successfully", task: updatedTask });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
