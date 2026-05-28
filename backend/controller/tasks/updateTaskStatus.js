import { db } from "../../db/index.js";
import { tasksTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";

export const updateTaskStatus = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);
        const { status } = req.body;

        if (!status || !["todo", "in_progress", "done"].includes(status)) {
            return res.status(400).json({ message: "Invalid or missing status. Must be todo, in_progress, or done." });
        }

        const [updatedTask] = await db
            .update(tasksTable)
            .set({ status })
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
            message: "Task status updated",
            taskId: taskId,
            newStatus: status
        });

        return res.status(200).json({ message: "Task status updated successfully", task: updatedTask });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
