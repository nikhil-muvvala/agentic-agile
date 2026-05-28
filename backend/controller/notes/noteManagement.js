import { db } from "../../db/index.js";
import { notesTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { getIO } from "../../config/socket.js";

// Admin only: Create a new note for a project
export const createNote = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const { title, content } = req.body;
        const createdBy = req.user.id;

        if (!title) return res.status(400).json({ message: "Note title is required" });

        const [newNote] = await db.insert(notesTable).values({
            projectId,
            title,
            content,
            createdBy
        }).returning();

        const payload = {
            id : newNote.id,
            projectId,
            title,
            content,
            user : {
                createdBy,
                name : req.user.name,
                email : req.user.email
            }
        };

        getIO().to(`project_${projectId}`).emit("new_note",payload);

        return res.status(201).json({ message: "Note created successfully", note: newNote });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// All members: List all notes for a project
export const listNotes = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);

        const notes = await db.select().from(notesTable)
            .where(eq(notesTable.projectId, projectId));

        return res.status(200).json({ notes });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// All members: Get a single note by ID
export const getNoteDetails = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const noteId = parseInt(req.params.noteId);

        const [note] = await db.select().from(notesTable)
            .where(and(
                eq(notesTable.id, noteId),
                eq(notesTable.projectId, projectId)
            ));

        if (!note) return res.status(404).json({ message: "Note not found in this project" });

        return res.status(200).json({ note });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// Admin only: Update a note's title or content
export const updateNote = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const noteId = parseInt(req.params.noteId);
        const { title, content } = req.body;

        if (!title && content === undefined) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (content !== undefined) updateData.content = content;

        const [updatedNote] = await db.update(notesTable)
            .set(updateData)
            .where(and(
                eq(notesTable.id, noteId),
                eq(notesTable.projectId, projectId)
            ))
            .returning();

        if (!updatedNote) return res.status(404).json({ message: "Note not found in this project" });

        getIO().to(`project_${projectId}`).emit("notes_update", { noteId, ...updateData });

        return res.status(200).json({ message: "Note updated successfully", note: updatedNote });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// Admin only: Delete a note
export const deleteNote = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const noteId = parseInt(req.params.noteId);

        const [deletedNote] = await db.delete(notesTable)
            .where(and(
                eq(notesTable.id, noteId),
                eq(notesTable.projectId, projectId)
            ))
            .returning();

        if (!deletedNote) return res.status(404).json({ message: "Note not found in this project" });

        getIO().to(`project_${projectId}`).emit("delete_note",{projectId,noteId}); // sending both because we can make a index with a composite key (projectid , noteid);

        return res.status(200).json({ message: "Note deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
