import { db } from "../../db/index.js";
import { tasksTable } from "../../models/tasks.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { triggerEventAgent } from "../ai/eventAgent.js";

export const deleteTask = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);

        // Security check: Make sure the task belongs to the project
        const existingTask = await db.select().from(tasksTable).where(
            and(
                eq(tasksTable.id, taskId),
                eq(tasksTable.projectId, projectId)
            )
        );

        if (existingTask.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Store task before deletion for Agent logic
        const taskToDelete = existingTask[0];

        // Delete the task
        await db.delete(tasksTable).where(eq(tasksTable.id, taskId));

        // Trigger Event Agent (Wait for it to finish, or run async?)
        // Let's run it async so it doesn't block the deletion response
        if (process.env.NODE_ENV !== 'test') {
            triggerEventAgent(taskToDelete, 'TASK_DELETED', projectId, req.user.id).catch(console.error);
        }

        // Emit the deletion event via WebSockets so it disappears from everyone's screen in real-time
        getIO().to(`project_${projectId}`).emit("task_deleted", { taskId });

        return res.status(200).json({ message: "Task deleted successfully" });

    } catch (err) {
        console.error("Delete Task Error:", err);
        return res.status(500).json({ message: err.message });
    }
};