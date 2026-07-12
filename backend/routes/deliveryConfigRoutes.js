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
import { haversineKm, calculateETA, isPlausibleIndiaLatLng } from "../services/geoEngine.js";

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
        const { pincode, weight = 500, paymentMethod = "ONLINE", productType = "ecommerce", lat, lng } = req.body;

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
            }).select("_id location preparationTime deliveryMode").lean();

            // Dynamic ETA via the shared Geo Engine when the client also
            // sends GPS — same formula used at checkout, so this "before you
            // even open the pincode" estimate never drifts from the real
            // one. Falls back to the static 45–120 range (unchanged
            // behavior) when GPS isn't provided or no vendor has coordinates.
            let etaMinMinutes = 45, etaMaxMinutes = 120;
            if (isPlausibleIndiaLatLng(lat, lng) && activeVendors.length) {
                let nearestKm = Infinity, nearestVendor = null;
                for (const v of activeVendors) {
                    const coords = v.location?.coordinates;
                    if (!coords || coords.length !== 2) continue;
                    const d = haversineKm(Number(lat), Number(lng), coords[1], coords[0]);
                    if (d < nearestKm) { nearestKm = d; nearestVendor = v; }
                }
                if (nearestVendor) {
                    const eta = calculateETA({
                        distanceKm: nearestKm,
                        preparationTimeMin: nearestVendor.preparationTime ?? config.defaultPrepTimeMin,
                        avgSpeedKmph: config.avgRiderSpeedKmph,
                        deliveryMode: nearestVendor.deliveryMode === "self" ? "self" : "platform",
                    });
                    if (eta) { etaMinMinutes = eta.etaMinMinutes; etaMaxMinutes = eta.etaMaxMinutes; }
                }
            }

            return res.json({
                success: true,
                available: true,
                deliveryType: "urbexon_hour",
                etaText: config.uhEtaText || "45–120 mins",
                etaMinMinutes,
                etaMaxMinutes,
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
