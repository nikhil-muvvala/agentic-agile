import { db } from "../db/index.js";
import { getIO } from "../config/socket.js";
import { notificationsTable } from "../models/notifications.js";

export const createNotification = async function(targetUserId, senderId, message) {
    try {
        // 1. Insert the notification 
        const [notification] = await db.insert(notificationsTable).values({
            userId: targetUserId,
            senderId: senderId,
            message: message
        }).returning();

        getIO().to(`user_${targetUserId}`).emit("new_notification", notification);

        return notification;
    } catch (err) {
        console.error("Error creating notification:", err);
    }
};