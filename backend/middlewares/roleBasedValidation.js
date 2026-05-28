import { projectMembers } from "../models/index.js";
import { db } from "../db/index.js";
import { eq, and } from "drizzle-orm";

export const roleBasedValidation = (allowedRoles) => {
    return async function (req, res, next) {
        try {
            const userId = req.user.id;
            const projectId = parseInt(req.params.projectId);

            // 1. Fetch the user's role from the DB
            const [role] = await db
                .select({ role: projectMembers.role })
                .from(projectMembers)
                .where(
                    and(
                        eq(projectMembers.userId, userId),
                        eq(projectMembers.projectId, projectId)
                    )
                );

            // 2. Check if they exist in the project at all
            if (!role) {
                return res.status(403).json({ message: "You are not a member of this project" });
            }

            const userRole = role.role;

            // 3. Check if their specific role is allowed
            if (allowedRoles.includes(userRole)) {
                req.userRole = userRole;
                return next(); // CRITICAL: You must return next() so it doesn't continue down to the 403 error!
            }

            return res.status(403).json({ message: "You do not have the required permissions" });

        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    };
};