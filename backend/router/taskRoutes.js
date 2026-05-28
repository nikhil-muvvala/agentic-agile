import express from "express";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { roleBasedValidation } from "../middlewares/roleBasedValidation.js";
import { createTask } from "../controller/tasks/createTask.js";
import { listTasks } from "../controller/tasks/listTasks.js";
import { getTaskDetails } from "../controller/tasks/taskDetails.js";
import { updateTaskDetails } from "../controller/tasks/updateTaskDetails.js";
import { updateTaskStatus } from "../controller/tasks/updateTaskStatus.js";
import { deleteTask } from "../controller/tasks/deleteTask.js";
import { uploadAttachment, deleteAttachment } from "../controller/tasks/taskAttachments.js";
import { upload } from "../config/cloudinary.js";
import { generateSubtasks, saveAiSubtasks } from "../controller/tasks/aiBreakdown.js";
import { summarizeWork } from "../controller/tasks/aiStandUp.js";
import { predictDeadline } from "../controller/tasks/predictDeadline.js";
import { suggestAssignee } from "../controller/tasks/suggestAssignee.js";

const router = express.Router();

router.post("/:projectId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), createTask);
router.get("/:projectId", validateJsonWebToken, listTasks);
router.get("/:projectId/t/:taskId", validateJsonWebToken, getTaskDetails);
router.patch("/:projectId/t/:taskId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), updateTaskDetails);
router.patch("/:projectId/t/:taskId/status", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), updateTaskStatus);
router.delete("/:projectId/t/:taskId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), deleteTask);

// Attachments
router.post("/:projectId/t/:taskId/attachments", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), upload.single("file"), uploadAttachment);
router.delete("/:projectId/t/:taskId/attachments/:attachmentId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), deleteAttachment);

// AI Features
router.post("/:projectId/t/:taskId/ai-breakdown/generate", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), generateSubtasks);
router.post("/:projectId/t/:taskId/ai-breakdown/save", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), saveAiSubtasks);
router.get("/:projectId/ai-standup", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), summarizeWork);

// GenAI On-Demand Helpers
router.post("/:projectId/predict-deadline", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), predictDeadline);
router.post("/:projectId/suggest-assignee", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), suggestAssignee);

export default router;
