import { db } from "../../db/index.js";
import { subtasksTable, tasksTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/addNotification.js";

export const createSubtask = async function(req, res) {
    try {
        const taskId = parseInt(req.params.taskId);
        const { title } = req.body;

        if (!title) return res.status(400).json({ message: "Subtask title is required" });

        const [newSubtask] = await db.insert(subtasksTable).values({
            taskId,
            title
        }).returning();

        const projectId = parseInt(req.params.projectId);
        getIO().to(`project_${projectId}`).emit("subtask_created", newSubtask);

        const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        if (task && task.assigneeId && task.assigneeId !== req.user.id) {
            await createNotification(task.assigneeId, req.user.id, `A new subtask '${title}' was added to your task: ${task.title}`);
        }

        return res.status(201).json({ message: "Subtask created", subtask: newSubtask });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export const updateSubtask = async function(req, res) {
    try {
        const subtaskId = parseInt(req.params.subtaskId);
        const { title } = req.body;
        
        if (!title) return res.status(400).json({ message: "Title is required" });

        const [updatedSubtask] = await db.update(subtasksTable)
            .set({ title })
            .where(eq(subtasksTable.id, subtaskId))
            .returning();

        if (!updatedSubtask) return res.status(404).json({ message: "Subtask not found" });

        const projectId = parseInt(req.params.projectId);
        getIO().to(`project_${projectId}`).emit("subtask_updated", updatedSubtask);

        return res.status(200).json({ message: "Subtask updated", subtask: updatedSubtask });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export const toggleSubtaskStatus = async function(req, res) {
    try {
        const subtaskId = parseInt(req.params.subtaskId);
        const { isCompleted } = req.body;

        if (typeof isCompleted !== "boolean") {
            return res.status(400).json({ message: "isCompleted must be a boolean" });
        }

        const [updatedSubtask] = await db.update(subtasksTable)
            .set({ isCompleted })
            .where(eq(subtasksTable.id, subtaskId))
            .returning();

        if (!updatedSubtask) return res.status(404).json({ message: "Subtask not found" });

        const projectId = parseInt(req.params.projectId);
        getIO().to(`project_${projectId}`).emit("subtask_updated", updatedSubtask);

        return res.status(200).json({ message: "Subtask status updated", subtask: updatedSubtask });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export const deleteSubtask = async function(req, res) {
    try {
        const subtaskId = parseInt(req.params.subtaskId);

        const [deletedSubtask] = await db.delete(subtasksTable)
            .where(eq(subtasksTable.id, subtaskId))
            .returning();

        if (!deletedSubtask) return res.status(404).json({ message: "Subtask not found" });

        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);
        getIO().to(`project_${projectId}`).emit("subtask_deleted", { subtaskId, taskId });

        return res.status(200).json({ message: "Subtask deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
