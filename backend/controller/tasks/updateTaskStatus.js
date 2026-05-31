import { db } from "../../db/index.js";
import { tasksTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { taskCompletionsTable } from "../../models/taskCompletions.js";
import { createWeightedVector } from "../../utils/aiGatekeeper.js";

export const updateTaskStatus = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);
        const { status } = req.body;

        if (!status || !["todo", "in_progress", "blocked", "done"].includes(status)) {
            return res.status(400).json({ message: "Invalid or missing status. Must be todo, in_progress, blocked, or done." });
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

            // The Skill-Memory Agent Hook

        if (status === 'done' && updatedTask.assigneeId) {
            try {
                console.log(`[Memory Bank] Task ${taskId} marked as Done. Generating Xenova Embedding...`);
                
                // 1. Generate Mathematical Vector
                const vector = await createWeightedVector(updatedTask.title, updatedTask.description);
                
                // 2. Calculate Days to Complete
                const msToComplete = Date.now() - new Date(updatedTask.createdAt).getTime();
                let daysToComplete = msToComplete / (1000 * 60 * 60 * 24);
                // Ensure it's at least 0.1 days to prevent dividing by zero elsewhere
                if (daysToComplete < 0.1) daysToComplete = 0.1;

                // 3. Store in Memory Bank
                await db.insert(taskCompletionsTable).values({
                    taskId: updatedTask.id,
                    assigneeId: updatedTask.assigneeId,
                    vector: vector,
                    daysToComplete: Number(daysToComplete.toFixed(2))
                });
                
                console.log(`[Memory Bank] Saved completion for User ${updatedTask.assigneeId} (Velocity: ${daysToComplete.toFixed(2)} days)`);
            } catch (memErr) {
                console.error("[Memory Bank Error] Failed to generate or save embedding:", memErr);
                // We don't return an error here because we still want the task status update to succeed for the user.
            }
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
