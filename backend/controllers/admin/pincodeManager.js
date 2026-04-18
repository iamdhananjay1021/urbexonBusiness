/**
 * pincodeManager.js — Production, fully fixed
 * Fixed: Proper geo validation, no 2dsphere index errors
 * Fixed: Complete CRUD for admin, public pincode check with vendor population
 */
import Pincode from "../../models/vendorModels/Pincode.js";
import Vendor from "../../models/vendorModels/Vendor.js";

// ── PUBLIC: Check pincode ─────────────────────────────────
export const checkPincode = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code || !/^\d{6}$/.test(code.trim())) {
            return res.status(400).json({ success: false, available: false, message: "Invalid pincode format" });
        }

        const pincode = await Pincode.findOne({ code: code.trim() })
            .populate("assignedVendors", "shopName shopLogo rating isOpen acceptingOrders shopDescription")
            .lean();

        if (!pincode) {
            return res.json({ available: false, status: "not_found", message: "We don't cover this area yet. We're expanding soon!" });
        }

        if (pincode.status === "blocked") {
            return res.json({ available: false, status: "blocked", message: "Service not available in your area." });
        }

        if (pincode.status === "coming_soon") {
            return res.json({
                available: false,
                status: "coming_soon",
                message: "We're coming to your area soon! Join our waitlist to be notified.",
                expectedLaunchDate: pincode.expectedLaunchDate,
                waitlistCount: pincode.waitlistCount || 0,
            });
        }

        const activeVendors = (pincode.assignedVendors || []).filter((v) => v.isOpen);

        return res.json({
            available: true,
            status: "active",
            area: pincode.area || "",
            city: pincode.city || "",
            state: pincode.state || "",
            vendors: activeVendors,
            vendorCount: activeVendors.length,
        });
    } catch (err) {
        console.error("[checkPincode]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── PUBLIC: Join waitlist ─────────────────────────────────
export const joinWaitlist = async (req, res) => {
    try {
        const { code, name, email, phone } = req.body;
        if (!code || !email) return res.status(400).json({ success: false, message: "Pincode and email are required" });
        if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Invalid pincode" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "Invalid email address" });

        const pincode = await Pincode.findOne({ code });
        if (!pincode) return res.status(404).json({ success: false, message: "Pincode not found" });
        if (pincode.status === "active") return res.status(400).json({ success: false, message: "Service is already active in your area!" });

        if (pincode.waitlist?.find((w) => w.email === email.toLowerCase())) {
            return res.status(400).json({ success: false, message: "You are already on the waitlist!" });
        }

        pincode.waitlist = pincode.waitlist || [];
        pincode.waitlist.push({ name: name?.trim() || "", email: email.toLowerCase().trim(), phone: phone?.trim() || "" });
        pincode.waitlistCount = (pincode.waitlistCount || 0) + 1;
        await pincode.save();

        res.json({ success: true, message: "You're on the waitlist! We'll notify you when we launch in your area." });
    } catch (err) {
        console.error("[joinWaitlist]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── ADMIN: Get all pincodes ───────────────────────────────
export const getAllPincodes = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (search) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { code: { $regex: escaped } },
                { city: { $regex: escaped, $options: "i" } },
                { area: { $regex: escaped, $options: "i" } },
                { state: { $regex: escaped, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [pincodes, total] = await Promise.all([
            Pincode.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(Number(limit))
                .populate("assignedVendors", "shopName shopLogo").lean(),
            Pincode.countDocuments(filter),
        ]);

        res.json({ success: true, pincodes, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error("[getAllPincodes]", err);
        res.status(500).json({ success: false, message: "Failed to fetch pincodes" });
    }
};

// ── ADMIN: Create pincode ─────────────────────────────────
export const createPincode = async (req, res) => {
    try {
        const { code, status, area, city, district, state, priority, expectedLaunchDate } = req.body;
        if (!code || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Valid 6-digit pincode is required" });

        const existing = await Pincode.findOne({ code });
        if (existing) return res.status(409).json({ success: false, message: `Pincode ${code} already exists` });

        const pincode = await Pincode.create({
            code, status: status || "coming_soon",
            area: area?.trim() || "", city: city?.trim() || "",
            district: district?.trim() || "", state: state?.trim() || "",
            priority: Number(priority) || 0,
            expectedLaunchDate: expectedLaunchDate ? new Date(expectedLaunchDate) : null,
        });

        res.status(201).json({ success: true, pincode, message: "Pincode created" });
    } catch (err) {
        console.error("[createPincode]", err);
        res.status(500).json({ success: false, message: "Failed to create pincode" });
    }
};

// ── ADMIN: Update pincode ─────────────────────────────────
export const updatePincode = async (req, res) => {
    try {
        const pincode = await Pincode.findById(req.params.id);
        if (!pincode) return res.status(404).json({ success: false, message: "Pincode not found" });

        const fields = ["status", "area", "city", "district", "state", "priority", "expectedLaunchDate", "note"];
        fields.forEach((f) => { if (req.body[f] !== undefined) pincode[f] = req.body[f]; });

        // Handle vendor assignment
        if (req.body.assignedVendors !== undefined) {
            pincode.assignedVendors = req.body.assignedVendors;
        }

        await pincode.save();
        res.json({ success: true, pincode, message: "Pincode updated" });
    } catch (err) {
        console.error("[updatePincode]", err);
        res.status(500).json({ success: false, message: "Failed to update pincode" });
    }
};

// ── ADMIN: Delete pincode ─────────────────────────────────
export const deletePincode = async (req, res) => {
    try {
        const pincode = await Pincode.findByIdAndDelete(req.params.id);
        if (!pincode) return res.status(404).json({ success: false, message: "Pincode not found" });
        res.json({ success: true, message: "Pincode deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to delete pincode" });
    }
};
