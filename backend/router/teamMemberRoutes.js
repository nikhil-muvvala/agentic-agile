import express from "express";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { roleBasedValidation } from "../middlewares/roleBasedValidation.js";
import { roleManagement } from "../controller/members/roleManagement.js";
import { removeMember } from "../controller/members/removeMember.js";
import { addMember } from "../controller/members/addMember.js";
import { listMembers } from "../controller/members/listMembers.js";

const router = express.Router();

// List Members
router.get("/:projectId/members", validateJsonWebToken, listMembers);

// Add Member
router.post("/:projectId/members", validateJsonWebToken, roleBasedValidation(["admin"]), addMember);

// Role Management (Update Role)
router.patch("/:projectId/members/:targetUserId", validateJsonWebToken, roleBasedValidation(["admin"]), roleManagement);

// Remove Member
router.delete("/:projectId/members/:targetUserId", validateJsonWebToken, roleBasedValidation(["admin"]), removeMember);

export default router;
