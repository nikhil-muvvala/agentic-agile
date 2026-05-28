
import { db } from "../../db/index.js";
import { projectMembers, projectsTable } from "../../models/index.js";
import { eq, count, inArray } from "drizzle-orm";

export const viewProjects = async function (req, res) {
    try {
        const userId = req.user.id;
        const projects = await db
            .select({
                id: projectsTable.id,
                projectName: projectsTable.name,
                description: projectsTable.description,
                memberCount: count(projectMembers.userId)
            })
            .from(projectsTable)
            .innerJoin(projectMembers, eq(projectMembers.projectId, projectsTable.id))
            .where(
                inArray(
                    projectsTable.id,
                    db.select({ projectId: projectMembers.projectId })
                        .from(projectMembers)
                        .where(eq(projectMembers.userId, userId))
                )
            )
            .groupBy(projectsTable.id, projectsTable.name, projectsTable.description);

        return res.status(200).json(projects);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};