import { projectsTable } from "../../models/index.js";
import { db } from "../../db/index.js";
import { eq } from "drizzle-orm";

export const projectUpdate = async function(req, res) {
    try { 
        const projectId = parseInt(req.params.projectId);
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ message: "Name and description should not be empty" });
        }

        // Drizzle ORM update syntax requires an object and a WHERE clause!
        await db.update(projectsTable)
            .set({ name, description })
            .where(eq(projectsTable.id, projectId));

        return res.status(200).json({ message: "Project successfully updated" });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};