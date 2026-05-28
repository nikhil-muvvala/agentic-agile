import { db } from "../../db/index.js";
import { projectsTable, projectMembers } from "../../models/index.js";
import { eq } from "drizzle-orm";

export const projectDelete = async function (req, res) {
    try {
        const projectId = parseInt(req.params.projectId);

        // Run the deletion inside a transaction
        // If step 1 works but step 2 fails, the database will "roll back" step 1 automatically!
        await db.transaction(async (tx) => {
            // Step 1: Delete all members associated with this project to prevent Foreign Key errors
            await tx.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
            
            // Step 2: Delete the project itself
            await tx.delete(projectsTable).where(eq(projectsTable.id, projectId));
        });

        return res.status(200).json({ message: "Project successfully deleted" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
