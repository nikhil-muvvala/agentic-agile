import express from "express";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { roleBasedValidation } from "../middlewares/roleBasedValidation.js";
import { createNote, listNotes, getNoteDetails, updateNote, deleteNote } from "../controller/notes/noteManagement.js";

const router = express.Router({ mergeParams: true });

// All members can view notes
router.get("/", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), listNotes);
router.get("/:noteId", validateJsonWebToken, roleBasedValidation(["admin", "project_admin", "member"]), getNoteDetails);

// Admin only for create, update, delete
router.post("/", validateJsonWebToken, roleBasedValidation(["admin"]), createNote);
router.patch("/:noteId", validateJsonWebToken, roleBasedValidation(["admin"]), updateNote);
router.delete("/:noteId", validateJsonWebToken, roleBasedValidation(["admin"]), deleteNote);

export default router;
