import { db } from "../../db/index.js";
import { taskAttachmentsTable, tasksTable } from "../../models/index.js";
import { eq, and } from "drizzle-orm";
import { cloudinary } from "../../config/cloudinary.js";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/addNotification.js";

export const uploadAttachment = async (req, res) => {
    try {
        const projectId=parseInt(req.params.projectId);
        const taskId = parseInt(req.params.taskId);
        const uploaderId = req.user.id;
        const userRole = req.userRole;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Fetch task to check assignee permissions
        const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
        if (!task) return res.status(404).json({ message: "Task not found" });

        // Permission Logic: Allowed if unassigned, OR if uploader is assignee, OR if uploader is admin/project_admin
        if (task.assigneeId !== null && task.assigneeId !== uploaderId && userRole !== "admin" && userRole !== "project_admin") {
            return res.status(403).json({ message: "Only the assigned user or an admin can upload attachments" });
        }

        // Multer-storage-cloudinary attaches these to req.file
        const fileUrl = req.file.path;
        const fileName = req.file.originalname;
        const sizeBytes = req.file.size;
        const mimeType = req.file.mimetype;

        const [attachment] = await db.insert(taskAttachmentsTable).values({
            taskId,
            uploaderId,
            fileName,
            fileUrl,
            mimeType,
            sizeBytes
        }).returning();

        getIO().to(`project_${projectId}`).emit("task_attachment",attachment);

        if (task.assigneeId && task.assigneeId !== uploaderId) {
            await createNotification(task.assigneeId, uploaderId, `A new file '${fileName}' was attached to your task: ${task.title}`);
        }

        return res.status(201).json({ message: "File uploaded successfully", attachment });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export const deleteAttachment = async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId);
        const attachmentId = parseInt(req.params.attachmentId);
        const taskId = parseInt(req.params.taskId);

        // First, get the attachment to find the cloudinary public_id
        const [attachment] = await db.select().from(taskAttachmentsTable)
            .where(and(
                eq(taskAttachmentsTable.id, attachmentId),
                eq(taskAttachmentsTable.taskId, taskId)
            ));

        if (!attachment) {
            return res.status(404).json({ message: "Attachment not found" });
        }

        // Extract the public ID from the Cloudinary URL to delete it from the cloud
        // Example URL: https://res.cloudinary.com/demo/image/upload/v12345/project_camp_attachments/filename.pdf
        const urlParts = attachment.fileUrl.split('/');
        const folderAndFile = urlParts.slice(-2).join('/'); // project_camp_attachments/filename.pdf
        const publicId = folderAndFile.split('.')[0]; // remove extension

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(publicId);

        // Delete from Database
        await db.delete(taskAttachmentsTable).where(eq(taskAttachmentsTable.id, attachmentId));

        getIO().to(`project_${projectId}`).emit("delete_attachment",{attachmentId,taskId});

        return res.status(200).json({ message: "Attachment deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
