import { db } from "../../db/index.js";
import { projectsTable, projectMembers } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/addNotification.js";

export const roleManagement = async function (req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        // We get the target user's ID from the URL, NOT from the JWT token!
        // (Because the Admin is changing someone else's role, not their own)
        const targetUserId = parseInt(req.params.targetUserId);
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ message: "Role is required" });
        }

        await db.update(projectMembers)
            .set({ role })
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, targetUserId)
                )
            );

        getIO().to(`project_${projectId}`).emit("role_change",{targetUserId,role});

        const [projectInfo] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
        const projectName = projectInfo ? projectInfo.name : "a project";

        await createNotification(targetUserId, req.user.id, `Your role in ${projectName} has been updated to ${role}`);

        return res.status(200).json({ message: "Role successfully updated" });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};