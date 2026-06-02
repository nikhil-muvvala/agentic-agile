import express from "express";
import { projectCreation } from "../controller/projects/project-creation.js";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { viewProjects } from "../controller/projects/viewProjects.js";
import { projectDetails } from "../controller/projects/projectDetails.js";
import { roleBasedValidation } from "../middlewares/roleBasedValidation.js";
import { projectUpdate } from "../controller/projects/projectUpdate.js";
import { projectDelete } from "../controller/projects/projectDelete.js";
import { chatWithProject } from "../controller/ai/projectBrain.js";
const router = express.Router();

router.post("/project-creation", validateJsonWebToken, projectCreation);
router.get("/viewProjects", validateJsonWebToken, viewProjects);
router.get("/project-details/:projectId", validateJsonWebToken, projectDetails);
router.put("/project-update/:projectId", validateJsonWebToken, roleBasedValidation(["admin"]), projectUpdate);
router.delete("/project-delete/:projectId", validateJsonWebToken, roleBasedValidation(["admin"]), projectDelete);
router.post("/:projectId/brain/chat", validateJsonWebToken, chatWithProject);

export default router;