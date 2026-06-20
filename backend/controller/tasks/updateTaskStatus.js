import { db } from "../../db/index.js";
import { tasksTable, projectMembers } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { taskCompletionsTable } from "../../models/taskCompletions.js";
import { createWeightedVector } from "../../utils/aiGatekeeper.js";
import { ingestMemory } from "../../services/memoryIngestion.js";
import { triggerEventAgent } from "../ai/eventAgent.js";

export const updateTaskStatus = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);
        const { status } = req.body;

        if (!status || !["todo", "in_progress", "blocked", "done"].includes(status)) {
            return res.status(400).json({ message: "Invalid or missing status. Must be todo, in_progress, blocked, or done." });
        }

        const existingTask = await db.select().from(tasksTable)
            .where(and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId)))
            .limit(1);

        if (!existingTask[0]) {
            return res.status(404).json({ message: "Task not found in this project" });
        }

        // RBAC Strict Agile Workflows
        const memberInfo = await db.select().from(projectMembers)
            .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, req.user.id)))
            .limit(1);
            
        const userRole = memberInfo[0]?.role || 'member';
        const currentStatus = existingTask[0].status;
        
        const strictOrder = ['todo', 'in_progress', 'done', 'blocked'];
        
        if (!['admin', 'project_admin'].includes(userRole)) {
            // Rule 0: Cannot move other people's tasks
            if (existingTask[0].assigneeId && existingTask[0].assigneeId !== req.user.id) {
                return res.status(403).json({ message: "Forbidden: You cannot move tasks assigned to other members." });
            }

            // Rule 1: Cannot move backwards
            const currentIndex = strictOrder.indexOf(currentStatus);
            const targetIndex = strictOrder.indexOf(status);
            
            if (targetIndex < currentIndex) {
                return res.status(403).json({ message: "Forbidden: Only Admins can move tasks backwards." });
            }
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

        try {
            // Project Knowledge Ingestion (Level 4 RAG)
            const assigneeContext = updatedTask.assigneeId ? `Assigned to user ID ${updatedTask.assigneeId}.` : "Unassigned.";
            const memoryContent = `Task Title: ${updatedTask.title}\nDescription: ${updatedTask.description || 'No description provided.'}\nStatus changed to: ${status}\n${assigneeContext}`;
            // Run asynchronously without blocking the API response
            ingestMemory(projectId, memoryContent, 'task_status_update', taskId).catch(console.error);
        } catch (err) {
            console.error("[Project Brain Ingestion Error]", err);
        }

        // Emit real-time event to the specific project room!
        getIO().to(`project_${projectId}`).emit("task_updated", {
            message: "Task status updated",
            taskId: taskId,
            newStatus: status
        });

        // The Event-Driven Agent Hook
        // Optimization: Only wake the AI for critical Agile events that require analysis 
        // (Freeing up capacity or encountering a blocker). Saves API calls on routine in_progress moves!
        if (['done', 'blocked'].includes(status)) {
            triggerEventAgent(updatedTask, 'TASK_STATUS_CHANGED', projectId, req.user.id).catch(console.error);
        }

        return res.status(200).json({ message: "Task status updated successfully", task: updatedTask });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
