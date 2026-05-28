import { db } from "../../db/index.js";
import { projectsTable, projectMembers } from "../../models/index.js";
import { validateProject } from "../../services/validateProject.js";
export const projectCreation = async function (req, res) {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "Name and description should not be empty" });
    }
    const userId = req.user.id;
    const [existingProject] = await validateProject(userId,name);
    if(existingProject){
      return res.status(400).json({message : "Project name with this user id already exists"});
    }
    const [project] = await db
      .insert(projectsTable)
      .values({ name, description, createdBy: userId })
      .returning({ id: projectsTable.id });

    await db.insert(projectMembers).values({
      userId: userId,
      projectId: project.id,
      role: "admin",
    });

    return res.status(201).json({ message: "Project created successfully", projectId: project.id });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};