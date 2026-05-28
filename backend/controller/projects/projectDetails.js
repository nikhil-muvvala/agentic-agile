import { db } from "../../db/index.js";
import { projectsTable, projectMembers, usersTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";

export const projectDetails = async function (req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const userId = req.user.id;

        if (isNaN(projectId)) {
            return res.status(400).json({ message: "Invalid project ID" });
        }

        // Query 1 — access check + project details
        const [project] = await db
            .select({
                id: projectsTable.id,
                name: projectsTable.name,
                description: projectsTable.description,
                userRole: projectMembers.role
            })
            .from(projectMembers)
            .innerJoin(projectsTable, eq(projectMembers.projectId, projectsTable.id))
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, userId)
                )
            );

        if (!project) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Query 2 — fetch members only
        const members = await db
            .select({
                id: usersTable.id,
                name: usersTable.name,
                email: usersTable.email,
                role: projectMembers.role
            })
            .from(projectMembers)
            .innerJoin(usersTable, eq(projectMembers.userId, usersTable.id))
            .where(eq(projectMembers.projectId, projectId));

        return res.status(200).json({
            project: {
                id: project.id,
                name: project.name,
                description: project.description
            },
            userRole: project.userRole,
            members
        });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};