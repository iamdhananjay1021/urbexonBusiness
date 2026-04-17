/**
 * userNotificationRoutes.js — Customer notification center routes
 */
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
} from "../controllers/userNotificationController.js";

const router = express.Router();

// All routes require auth
router.use(protect);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.delete("/clear-all", clearAll);
router.put("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;
