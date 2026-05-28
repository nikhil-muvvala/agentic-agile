import express from "express";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { roleBasedValidation } from "../middlewares/roleBasedValidation.js";
import { createSubtask, updateSubtask, toggleSubtaskStatus, deleteSubtask } from "../controller/subtasks/subtaskManagement.js";

// Note: This router is mounted at /api/v1/projects/:projectId/t/:taskId/subtasks
const router = express.Router({ mergeParams: true });

// Create subtask (Admin/Project Admin)
router.post("/", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), createSubtask);

// Edit subtask title (Admin/Project Admin)
router.patch("/:subtaskId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), updateSubtask);

// Toggle completion status (All Members)
router.patch("/:subtaskId/status", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), toggleSubtaskStatus);

// Delete subtask (Admin/Project Admin)
router.delete("/:subtaskId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin"]), deleteSubtask);

export default router;
