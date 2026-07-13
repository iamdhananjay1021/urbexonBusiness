/**
 * adminTicketRoutes.js — admin support-ticket case management.
 * Mounted at /api/admin/tickets via routes/adminRoutes.js (router.use("/tickets", ...)),
 * which already applies protect+adminOnly at the file level for everything
 * under /api/admin — no auth middleware repeated here, same pattern as
 * routes/admin/adminDeliveryRoutes.js.
 */
import express from "express";
import multer from "multer";
import {
    listTickets, getTicketStats, getTicketDetail, replyToTicket, addInternalNote,
    changeStatus, changePriority, assignAdmin, closeTicket, reopenTicket,
} from "../../controllers/admin/ticketController.js";

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

router.get("/stats", getTicketStats);
router.get("/", listTickets);
router.get("/:id", getTicketDetail);
router.post("/:id/reply", attachments, replyToTicket);
router.post("/:id/notes", addInternalNote);
router.patch("/:id/status", changeStatus);
router.patch("/:id/priority", changePriority);
router.patch("/:id/assign", assignAdmin);
router.patch("/:id/close", closeTicket);
router.patch("/:id/reopen", reopenTicket);

export default router;
