/**
 * cannedResponseController.js — admin CRUD for support reply templates.
 * Consumed by the Support Center's ticket detail modal ("insert into reply
 * box" picker). Templates are inserted client-side, never auto-sent.
 */
import CannedResponse from "../../models/CannedResponse.js";

// GET /api/admin/canned-responses?active=1&category=
export const listCannedResponses = async (req, res) => {
    try {
        const filter = {};
        if (req.query.active === "1") filter.isActive = true;
        if (req.query.category) filter.category = req.query.category;
        const responses = await CannedResponse.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
        res.json({ success: true, responses });
    } catch (err) {
        console.error("[listCannedResponses]", err);
        res.status(500).json({ success: false, message: "Failed to fetch canned responses" });
    }
};

// POST /api/admin/canned-responses
export const createCannedResponse = async (req, res) => {
    try {
        const { title, body, category } = req.body;
        if (!title?.trim() || !body?.trim()) {
            return res.status(400).json({ success: false, message: "title and body are required" });
        }
        const response = await CannedResponse.create({
            title: title.trim(),
            body: body.trim(),
            category: category || "other",
            createdBy: req.user._id,
        });
        res.status(201).json({ success: true, response });
    } catch (err) {
        console.error("[createCannedResponse]", err);
        res.status(500).json({ success: false, message: "Failed to create canned response" });
    }
};

// PUT /api/admin/canned-responses/:id
export const updateCannedResponse = async (req, res) => {
    try {
        const updates = {};
        for (const key of ["title", "body", "category", "isActive"]) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        const response = await CannedResponse.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
        if (!response) return res.status(404).json({ success: false, message: "Canned response not found" });
        res.json({ success: true, response });
    } catch (err) {
        console.error("[updateCannedResponse]", err);
        res.status(500).json({ success: false, message: "Failed to update canned response" });
    }
};

// DELETE /api/admin/canned-responses/:id
export const deleteCannedResponse = async (req, res) => {
    try {
        const response = await CannedResponse.findByIdAndDelete(req.params.id);
        if (!response) return res.status(404).json({ success: false, message: "Canned response not found" });
        res.json({ success: true, message: "Deleted" });
    } catch (err) {
        console.error("[deleteCannedResponse]", err);
        res.status(500).json({ success: false, message: "Failed to delete canned response" });
    }
};
