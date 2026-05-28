import { db } from "../../db/index.js";
import { tasksTable, usersTable, subtasksTable, taskAttachmentsTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";

export const getTaskDetails = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);

        const [task] = await db
            .select({
                id: tasksTable.id,
                title: tasksTable.title,
                description: tasksTable.description,
                status: tasksTable.status,
                createdAt: tasksTable.createdAt,
                assignee: {
                    id: usersTable.id,
                    name: usersTable.name,
                    email: usersTable.email
                }
            })
            .from(tasksTable)
            .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
            .where(
                and(
                    eq(tasksTable.id, taskId),
                    eq(tasksTable.projectId, projectId)
                )
            );

        if (!task) {
            return res.status(404).json({ message: "Task not found in this project" });
        }

        const subtasks = await db.select().from(subtasksTable).where(eq(subtasksTable.taskId, taskId));
        task.subtasks = subtasks;

        const attachments = await db.select().from(taskAttachmentsTable).where(eq(taskAttachmentsTable.taskId, taskId));
        task.attachments = attachments;

        return res.status(200).json({ task });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
