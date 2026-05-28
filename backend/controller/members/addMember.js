import { projectMembers, projectsTable, usersTable } from "../../models/index.js";
import { db } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/addNotification.js";

export const addMember = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const { email, role = "member" } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: "email is required" });
        }

        // Lookup user by email
        const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
        
        if (!user) {
            return res.status(404).json({ message: "No user found with this email address" });
        }

        const userId = user.id;

        // Note: Drizzle will throw an error if the unique constraint (projectId + userId) is violated.
        // We catch it in the catch block to return a friendly message.
        const member = await db.insert(projectMembers).values({ projectId, userId, role }).returning();

        const [projectInfo] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
        const projectName = projectInfo ? projectInfo.name : "a project";

        const payload = {
            id: member[0].id,
            role: member[0].role,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        };

        // Call the utility function. It handles BOTH the database insert AND the websocket emit!
        // We use user.id (the actual user's ID), NOT member[0].id (the membership row ID).
        await createNotification(user.id, req.user.id, `You have been added to ${projectName} as a ${role}`);

        getIO().to(`project_${projectId}`).emit("add_member", payload);
        
        return res.status(200).json({ message: "successfully added", member: payload });
    } catch(err) {
        if (err.code === '23505') { // Postgres unique violation error code
            return res.status(400).json({ message: "User is already a member of this project" });
        }
        return res.status(500).json({ message: err.message });
    }
};