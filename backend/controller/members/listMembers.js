import { eq } from "drizzle-orm";
import { projectMembers, usersTable } from "../../models/index.js";
import { db } from "../../db/index.js";

export const listMembers = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        
        const members = await db.select({
            id: projectMembers.id,
            projectId: projectMembers.projectId,
            role: projectMembers.role,
            user: {
                id: usersTable.id,
                name: usersTable.name,
                email: usersTable.email
            }
        })
        .from(projectMembers)
        .innerJoin(usersTable, eq(projectMembers.userId, usersTable.id))
        .where(eq(projectMembers.projectId, projectId));
        
        return res.status(200).json(members);
    } catch(err) {
        return res.status(500).json({ message: err.message });
    }
};