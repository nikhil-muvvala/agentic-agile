import express from "express";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { listMyNotifications, markAsRead, markAllAsRead } from "../controller/notifications/notificationManagement.js";

const router = express.Router();

// All routes require the user to be logged in
router.use(validateJsonWebToken);

router.get("/", listMyNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:notificationId/read", markAsRead);

export default router;
