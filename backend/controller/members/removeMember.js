import { db } from "../../db/index.js";
import { projectMembers } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";

export const removeMember = async function (req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const targetUserId = parseInt(req.params.targetUserId);

        // Security check: Don't let an admin accidentally delete themselves
        if (req.user.id === targetUserId) {
             return res.status(400).json({ message: "You cannot remove yourself" });
        }

        const result = await db.delete(projectMembers).where(
            and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, targetUserId)
            )
        ).returning();

        if (result.length === 0) {
            return res.status(404).json({ message: "Member not found in this project" });
        }

        getIO().to(`project_${projectId}`).emit("remove_member",targetUserId);

        return res.status(200).json({ message: "Member successfully removed" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
