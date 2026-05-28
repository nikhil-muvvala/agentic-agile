import { db } from "../../db/index.js";
import { tasksTable, usersTable } from "../../models/index.js";
import { eq } from "drizzle-orm";

export const listTasks = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);

        //  We use a leftJoin here! 
        // If we used an innerJoin, any task with a NULL assigneeId would be completely hidden from the user.
        const tasks = await db
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
            .where(eq(tasksTable.projectId, projectId));

        return res.status(200).json({ tasks });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};