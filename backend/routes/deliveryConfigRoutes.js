/**
 * deliveryConfigRoutes.js — Admin + Public delivery config routes
 * Admin: GET/PUT /api/admin/delivery-config (protected)
 * Public: GET /api/delivery-config/public
 * Estimate: POST /api/delivery/estimate (unified delivery estimate)
 */
import { Router } from "express";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    getDeliveryConfig,
    updateDeliveryConfig,
    getPublicDeliveryConfig,
} from "../controllers/admin/deliveryConfigController.js";
import { calculateShippingRate } from "../utils/Shiprocketservice.js";
import Pincode from "../models/vendorModels/Pincode.js";
import DeliveryConfigModel from "../models/DeliveryConfig.js";
import Vendor from "../models/vendorModels/Vendor.js";

const router = Router();

/* ── Admin routes ── */
router.get("/admin/delivery-config", protect, adminOnly, getDeliveryConfig);
router.put("/admin/delivery-config", protect, adminOnly, updateDeliveryConfig);

/* ── Public config ── */
router.get("/delivery-config/public", getPublicDeliveryConfig);

/* ── Unified delivery estimate ──
   POST /api/delivery/estimate
   Body: { pincode, weight?, paymentMethod?, productType? }
   Returns: delivery date, charges, COD, return policy in one call
*/
router.post("/delivery/estimate", async (req, res) => {
    try {
        const { pincode, weight = 500, paymentMethod = "ONLINE", productType = "ecommerce" } = req.body;

        if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) {
            return res.status(400).json({ success: false, message: "Valid 6-digit pincode required" });
        }

        const config = await DeliveryConfigModel.findById("delivery_config").lean()
            || {
            freeDeliveryThreshold: 499, codAvailablePanIndia: true, returnDays: 7,
            etaEcommerceStandard: "3–5 Business Days", etaUrbexonHour: "45–120 mins",
            uhEnabled: true, uhEtaText: "45–120 mins"
        };

        if (productType === "urbexon_hour") {
            // UH estimate — check pincode availability
            const pincodeDoc = await Pincode.findOne({ code: String(pincode).trim() })
                .lean();

            if (!pincodeDoc || pincodeDoc.status !== "active") {
                return res.json({
                    success: true,
                    available: false,
                    message: pincodeDoc?.status === "coming_soon"
                        ? "We're coming to your area soon!"
                        : "Urbexon Hour not available in this area yet.",
                });
            }

            // Fetch active vendors dynamically
            const activeVendors = await Vendor.find({
                servicePincodes: String(pincode).trim(),
                status: "approved",
                isOpen: true,
                isDeleted: false
            }).select("_id").lean();
            return res.json({
                success: true,
                available: true,
                deliveryType: "urbexon_hour",
                etaText: config.uhEtaText || "45–120 mins",
                etaMinMinutes: 45,
                etaMaxMinutes: 120,
                area: pincodeDoc.area || "",
                city: pincodeDoc.city || "",
                vendorCount: activeVendors.length,
                codAvailable: config.codAvailablePanIndia,
                returnDays: config.returnDays,
            });
        }

        // Ecommerce estimate — use Shiprocket
        const srResult = await calculateShippingRate({
            deliveryPincode: String(pincode).trim(),
            weight,
            cod: paymentMethod === "COD",
        });

        return res.json({
            success: true,
            available: true,
            deliveryType: "ecommerce",
            etdText: srResult.etd || config.etaEcommerceStandard,
            courier: srResult.courier || "Standard Courier",
            shippingRate: srResult.rate || 0,
            freeDeliveryThreshold: config.freeDeliveryThreshold,
            codAvailable: config.codAvailablePanIndia,
            codCharge: config.codCharge,
            returnDays: config.returnDays,
        });
    } catch (err) {
        console.error("[DeliveryEstimate]", err.message);
        res.status(500).json({ success: false, message: "Failed to estimate delivery" });
    }
});

export default router;
