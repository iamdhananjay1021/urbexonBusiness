import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { adminOnly } from "../../middlewares/adminMiddleware.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import User from "../../models/User.js";

const router = express.Router();
router.use(protect, adminOnly);

// GET /api/admin/vendors
router.get("/", async (req, res) => {
    const { page = 1, limit = 20, search, status, isOpen } = req.query;
    const filter = { isDeleted: { $ne: true } };
    if (search) filter.$or = [{ shopName: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
    if (status && status !== "all") filter.status = status;
    if (isOpen && isOpen !== "all") filter.isOpen = isOpen === "true";

    const vendors = await Vendor.find(filter).limit(limit * 1).skip((page - 1) * limit).sort({ createdAt: -1 });
    const total = await Vendor.countDocuments(filter);
    res.json({ vendors, totalPages: Math.ceil(total / limit), currentPage: page });
});

// GET /api/admin/vendors/:id
router.get("/:id", async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).populate("userId", "name email role");
    if (!vendor) return res.status(404).json({ message: "Vendor not found." });
    res.json(vendor);
});

// GET /api/admin/vendors/stats
router.get("/stats", async (req, res) => {
    const [total, approved, pending, suspended] = await Promise.all([
        Vendor.countDocuments({ isDeleted: { $ne: true } }),
        Vendor.countDocuments({ status: "approved", isDeleted: { $ne: true } }),
        Vendor.countDocuments({ status: "pending", isDeleted: { $ne: true } }),
        Vendor.countDocuments({ status: "suspended", isDeleted: { $ne: true } }),
    ]);
    res.json({ total, approved, pending, suspended });
});

// PUT /api/admin/vendors/:id/status
router.put("/:id/status", async (req, res) => {
    const { status, rejectionReason } = req.body;
    if (!["approved", "pending", "suspended", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found." });

    vendor.status = status;
    if (status === "rejected" || status === "suspended") {
        vendor.rejectionReason = rejectionReason || "Your application did not meet our criteria.";
    }

    // Sync user role
    const newRole = status === "approved" ? "vendor" : "user";
    await User.findByIdAndUpdate(vendor.userId, { role: newRole });

    await vendor.save();
    res.json({ message: `Vendor status updated to ${status}.`, vendor });
});

// PUT /api/admin/vendors/:id/delivery-config
router.put("/:id/delivery-config", async (req, res) => {
    const { deliveryRadius, servicePincodes, lat, lng, isOpen } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found." });

    if (deliveryRadius !== undefined) vendor.deliveryRadius = Number(deliveryRadius);
    if (servicePincodes !== undefined) vendor.servicePincodes = servicePincodes;
    if (isOpen !== undefined) vendor.isOpen = isOpen;

    if (lat !== undefined && lng !== undefined) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        if (!isNaN(latitude) && !isNaN(longitude)) {
            vendor.shopLat = latitude;
            vendor.shopLng = longitude;
            vendor.location = {
                type: "Point",
                coordinates: [longitude, latitude],
            };
        }
    }

    await vendor.save();
    res.json({ message: "Vendor delivery settings updated.", vendor });
});

export default router;