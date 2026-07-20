/**
 * adminCannedResponseRoutes.js — mounted at /api/admin/canned-responses via
 * routes/adminRoutes.js (which applies protect + adminOnly file-wide, same
 * as /admin/tickets).
 */
import express from "express";
import {
    listCannedResponses, createCannedResponse,
    updateCannedResponse, deleteCannedResponse,
} from "../../controllers/admin/cannedResponseController.js";

const router = express.Router();

router.get("/", listCannedResponses);
router.post("/", createCannedResponse);
router.put("/:id", updateCannedResponse);
router.delete("/:id", deleteCannedResponse);

export default router;
