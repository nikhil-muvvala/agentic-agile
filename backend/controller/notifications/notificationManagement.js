import { db } from "../../db/index.js";
import { notificationsTable } from "../../models/notifications.js";
import { eq, and, desc } from "drizzle-orm";

export const listMyNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        const notifications = await db.select()
            .from(notificationsTable)
            .where(eq(notificationsTable.userId, userId))
            .orderBy(desc(notificationsTable.createdAt));

        return res.status(200).json({ notifications });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = parseInt(req.params.notificationId);

        const [updatedNotification] = await db.update(notificationsTable)
            .set({ isRead: true })
            .where(
                and(
                    eq(notificationsTable.id, notificationId),
                    eq(notificationsTable.userId, userId) // security: ensure they own it
                )
            )
            .returning();

        if (!updatedNotification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        return res.status(200).json({ message: "Notification marked as read", notification: updatedNotification });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await db.update(notificationsTable)
            .set({ isRead: true })
            .where(
                and(
                    eq(notificationsTable.userId, userId),
                    eq(notificationsTable.isRead, false)
                )
            );

        return res.status(200).json({ message: "All notifications marked as read" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
