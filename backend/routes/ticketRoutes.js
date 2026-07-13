/**
 * ticketRoutes.js — customer-facing support ticket routes.
 * Mounted at /api/tickets. Admin case-management routes live in
 * routes/admin/adminTicketRoutes.js, mounted under /api/admin/tickets.
 */
import express from "express";
import multer from "multer";
import { protect } from "../middlewares/authMiddleware.js";
import { createTicket, getMyTickets, getMyTicketDetail, replyToMyTicket } from "../controllers/ticketController.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only images/PDFs allowed"), false);
    },
});
const attachments = upload.array("attachments", 3);

router.post("/", protect, attachments, createTicket);
router.get("/my", protect, getMyTickets);
router.get("/:id", protect, getMyTicketDetail);
router.post("/:id/reply", protect, attachments, replyToMyTicket);

export default router;
