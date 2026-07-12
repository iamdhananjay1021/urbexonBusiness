/**
 * pincodeManager.js — Production Hardened v2.0
 *
 * FIXES APPLIED:
 * [FIX-PM1] checkPincode → caching added (120s TTL for active, 300s for non-active)
 * [FIX-PM2] getAllPincodes (admin) → caching added (60s TTL) + input validation
 * [FIX-PM3] joinWaitlist → atomic dedup preserved + cache invalidation on join
 * [FIX-PM4] createPincode → atomic upsert preserved + cache invalidation
 * [FIX-PM5] updatePincode → cache invalidation added
 * [FIX-PM6] deletePincode → cache invalidation added
 * [FIX-PM7] All cache calls wrapped in safe helpers (never crash)
 * [FIX-PM8] Input validation on getAllPincodes (page, limit, search length)
 */
import Pincode from "../../models/vendorModels/Pincode.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import { getCache, setCache, delCacheByPrefix } from "../../utils/Cache.js";

// [FIX-PM7] Safe cache helpers
const safeGetCache = async (key) => {
    try { return await getCache(key); } catch (_) { return null; }
};
const safeSetCache = async (key, val, ttl) => {
    try { await setCache(key, val, ttl); } catch (_) { }
};
const safeDelPrefix = async (prefix) => {
    try { await delCacheByPrefix(prefix); } catch (_) { }
};

// Escape regex chars
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Coordinates admin enters end up in the same geo index the resolveNearestPincode
// endpoint trusts blindly — a fat-fingered lat/lng here would silently corrupt
// GPS resolution for every user near it, so validate the same as client input.
const isValidLngLatPair = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
    const [lng, lat] = coordinates.map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

/* ── PUBLIC: Check pincode ─────────────────────────────────────────── */
export const checkPincode = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code || !/^\d{6}$/.test(code.trim())) {
            return res.status(400).json({ success: false, available: false, message: "Invalid pincode format" });
        }

        // [FIX-PM1] Cache pincode check results
        const cacheKey = `pincode:check:${code.trim()}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const pincode = await Pincode.findOne({ code: code.trim() }).lean();

        let result;
        let cacheTTL = 120; // default 2 min

        if (!pincode) {
            result = { available: false, status: "not_found", message: "We don't cover this area yet. We're expanding soon!" };
            cacheTTL = 300; // not found → cache longer
        } else if (pincode.status === "blocked") {
            result = { available: false, status: "blocked", message: "Service not available in your area." };
            cacheTTL = 300;
        } else if (pincode.status === "coming_soon") {
            result = {
                available: false,
                status: "coming_soon",
                message: "We're coming to your area soon! Join our waitlist to be notified.",
                expectedLaunchDate: pincode.expectedLaunchDate,
                waitlistCount: pincode.waitlistCount || 0,
            };
            cacheTTL = 120;
        } else {
            // Fetch active vendors dynamically based on their servicePincodes array
            const activeVendors = await Vendor.find({
                servicePincodes: code.trim(),
                status: "approved",
                isOpen: true,
                isDeleted: false
            }).select("shopName shopLogo rating isOpen city").lean();
            result = {
                available: true,
                status: "active",
                area: pincode.area || "",
                city: pincode.city || "",
                state: pincode.state || "",
                vendors: activeVendors,
                vendorCount: activeVendors.length,
            };
            cacheTTL = 60; // active pincodes → shorter cache (vendor open/close status changes)
        }

        await safeSetCache(cacheKey, result, cacheTTL);
        return res.json(result);
    } catch (err) {
        console.error("[checkPincode]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/* ── PUBLIC: Resolve nearest serviceable pincode by GPS coordinates ──
   BUG FIX: the client's reverse-geocoding providers (Nominatim/Google)
   sometimes return the WRONG postal_code for coordinates near a pincode
   boundary — OSM's Indian postal-code coverage is patchy, so a genuinely-
   224122 GPS fix can come back tagged 224138. Rather than trusting that
   verbatim, cross-check the raw coordinates against our OWN serviceable-
   pincode database (which admin populates with real geo coordinates) and
   prefer whichever pincode is actually closest, when one is within a
   sane radius. If no admin-configured pincode is close enough, the
   caller falls back to whatever the reverse geocoder said — this only
   ever CORRECTS a mismatch, never blocks a result. ── */
const DEFAULT_MAX_KM = 8; // fallback radius when a pincode has no deliveryRadiusKm set — pincode areas aren't circular, a registered center point can legitimately be several km from its boundary
const OUTER_SEARCH_KM = 50; // absolute cap — a fix this far from every known pincode never matches

export const resolveNearestPincode = async (req, res) => {
    try {
        const lat = Number(req.query.lat);
        const lng = Number(req.query.lng);
        if (
            !Number.isFinite(lat) || !Number.isFinite(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180
        ) {
            return res.status(400).json({ success: false, message: "Valid lat/lng required" });
        }
        // Security: reject coordinates far outside India's landmass outright —
        // never trust raw frontend coordinates blindly (spoofed/garbage GPS fixes).
        if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
            return res.json({ success: true, found: false });
        }

        // Use $geoNear (not a linear scan) so distance is computed by Mongo itself;
        // each pincode's OWN deliveryRadiusKm decides the acceptance threshold,
        // not a single global constant.
        const [nearest] = await Pincode.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] },
                    distanceField: "distanceMeters",
                    maxDistance: OUTER_SEARCH_KM * 1000,
                    spherical: true,
                    query: { status: { $ne: "blocked" } },
                },
            },
            { $limit: 1 },
            { $project: { code: 1, area: 1, city: 1, state: 1, status: 1, deliveryRadiusKm: 1, distanceMeters: 1 } },
        ]);

        if (!nearest) {
            return res.json({ success: true, found: false });
        }

        const allowedKm = Number(nearest.deliveryRadiusKm) > 0 ? Number(nearest.deliveryRadiusKm) : DEFAULT_MAX_KM;
        if (nearest.distanceMeters > allowedKm * 1000) {
            return res.json({ success: true, found: false });
        }

        return res.json({
            success: true,
            found: true,
            code: nearest.code,
            area: nearest.area || "",
            city: nearest.city || "",
            state: nearest.state || "",
            status: nearest.status,
            distanceKm: Math.round((nearest.distanceMeters / 1000) * 10) / 10,
        });
    } catch (err) {
        console.error("[resolveNearestPincode]", err);
        // Non-fatal by design — caller falls back to the reverse geocoder's own pincode.
        res.json({ success: true, found: false });
    }
};

/* ── PUBLIC: Join waitlist ─────────────────────────────────────────── */
// [FIX-PM3] Atomic duplicate email prevention using $addToSet-style update with condition (preserved)
export const joinWaitlist = async (req, res) => {
    try {
        const { code, name, email, phone } = req.body;
        if (!code || !email) return res.status(400).json({ success: false, message: "Pincode and email are required" });
        if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Invalid pincode" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "Invalid email address" });

        const normalizedEmail = email.toLowerCase().trim();

        // Atomic: use $push with $ne condition — single round-trip, race-safe
        const result = await Pincode.findOneAndUpdate(
            {
                code,
                status: { $ne: "active" },
                "waitlist.email": { $ne: normalizedEmail },
            },
            {
                $push: {
                    waitlist: {
                        name: name?.trim() || "",
                        email: normalizedEmail,
                        phone: phone?.trim() || "",
                    },
                },
                $inc: { waitlistCount: 1 },
            },
            { new: true }
        );

        if (!result) {
            const pincode = await Pincode.findOne({ code }).select("status").lean();
            if (!pincode) return res.status(404).json({ success: false, message: "Pincode not found" });
            if (pincode.status === "active") return res.status(400).json({ success: false, message: "Service is already active in your area!" });
            return res.status(400).json({ success: false, message: "You are already on the waitlist!" });
        }

        // [FIX-PM3] Invalidate pincode cache since waitlistCount changed
        await safeDelPrefix(`pincode:check:${code}`);

        res.json({ success: true, message: "You're on the waitlist! We'll notify you when we launch in your area." });
    } catch (err) {
        console.error("[joinWaitlist]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/* ── ADMIN: Get all pincodes ───────────────────────────────────────── */
export const getAllPincodes = async (req, res) => {
    try {
        const { status, search } = req.query;

        // [FIX-PM8] Input validation
        const page = Math.max(1, Math.min(10000, parseInt(req.query.page) || 1));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const searchRaw = search?.trim() || "";
        if (searchRaw.length > 50) {
            return res.status(400).json({ success: false, message: "Search too long (max 50 chars)" });
        }

        // [FIX-PM2] Admin cache (60s)
        const cacheKey = `pincode:admin:${status || "_"}:${searchRaw || "_"}:p${page}:l${limit}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const filter = {};
        if (status) filter.status = status;
        if (searchRaw) {
            const escaped = escapeRegex(searchRaw);
            filter.$or = [
                { code: { $regex: escaped } },
                { city: { $regex: escaped, $options: "i" } },
                { area: { $regex: escaped, $options: "i" } },
                { state: { $regex: escaped, $options: "i" } },
            ];
        }

        const skip = (page - 1) * limit;
        const [pincodes, total] = await Promise.all([
            Pincode.find(filter)
                .sort({ priority: -1, createdAt: -1 })
                .skip(skip).limit(limit)
                .lean(),
            Pincode.countDocuments(filter),
        ]);

        // Dynamically attach vendors to each pincode for the admin view
        const codes = pincodes.map(p => p.code);
        const vendors = await Vendor.find({ servicePincodes: { $in: codes }, isDeleted: false, status: "approved" })
            .select("shopName shopLogo servicePincodes").lean();

        pincodes.forEach(p => {
            p.assignedVendors = vendors.filter(v => v.servicePincodes && v.servicePincodes.includes(p.code));
        });

        const result = { success: true, pincodes, total, page, pages: Math.ceil(total / limit) };
        await safeSetCache(cacheKey, result, 60);
        res.json(result);
    } catch (err) {
        console.error("[getAllPincodes]", err);
        res.status(500).json({ success: false, message: "Failed to fetch pincodes" });
    }
};

/* ── ADMIN: Create pincode ─────────────────────────────────────────── */
export const createPincode = async (req, res) => {
    try {
        const { code, status, area, city, district, state, priority, expectedLaunchDate, location, deliveryRadiusKm } = req.body;
        if (!code || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ success: false, message: "Valid 6-digit pincode is required" });
        }

        const insertData = {
            code,
            status: status || "coming_soon",
            area: area?.trim() || "",
            city: city?.trim() || "",
            district: district?.trim() || "",
            state: state?.trim() || "",
            priority: Number(priority) || 0,
            expectedLaunchDate: expectedLaunchDate ? new Date(expectedLaunchDate) : null,
        };
        if (deliveryRadiusKm !== undefined && Number.isFinite(Number(deliveryRadiusKm))) {
            insertData.deliveryRadiusKm = Math.min(25, Math.max(1, Number(deliveryRadiusKm)));
        }

        // FIX: Extract location if provided, format correctly for MongoDB 2dsphere index
        if (location && Array.isArray(location.coordinates) && location.coordinates[0] !== null) {
            const coords = [Number(location.coordinates[0]), Number(location.coordinates[1])];
            if (!isValidLngLatPair(coords)) {
                return res.status(400).json({ success: false, message: "Invalid coordinates — longitude must be -180..180 and latitude -90..90" });
            }
            insertData.location = { type: "Point", coordinates: coords };
        }

        // [FIX-PM4] Atomic upsert with $setOnInsert (preserved — prevents race on concurrent admin creates)
        const result = await Pincode.findOneAndUpdate(
            { code },
            { $setOnInsert: insertData },
            // FIX: Replaced `rawResult` with `includeResultMetadata` to resolve Mongoose Deprecation Warning
            { upsert: true, new: true, includeResultMetadata: true }
        );

        if (result.lastErrorObject?.updatedExisting) {
            return res.status(409).json({ success: false, message: `Pincode ${code} already exists` });
        }

        // [FIX-PM4] Invalidate admin cache
        await safeDelPrefix("pincode:admin:");

        res.status(201).json({ success: true, pincode: result.value, message: "Pincode created" });
    } catch (err) {
        console.error("[createPincode]", err);
        res.status(500).json({ success: false, message: "Failed to create pincode" });
    }
};

/* ── ADMIN: Update pincode ─────────────────────────────────────────── */
export const updatePincode = async (req, res) => {
    try {
        const pincode = await Pincode.findById(req.params.id);
        if (!pincode) return res.status(404).json({ success: false, message: "Pincode not found" });

        const prevCode = pincode.code;

        const fields = ["status", "area", "city", "district", "state", "priority", "expectedLaunchDate", "note"];
        fields.forEach((f) => { if (req.body[f] !== undefined) pincode[f] = req.body[f]; });

        if (req.body.deliveryRadiusKm !== undefined && Number.isFinite(Number(req.body.deliveryRadiusKm))) {
            pincode.deliveryRadiusKm = Math.min(25, Math.max(1, Number(req.body.deliveryRadiusKm)));
        }

        // FIX: Support updating location properly
        if (req.body.location !== undefined) {
            if (req.body.location && Array.isArray(req.body.location.coordinates) && req.body.location.coordinates[0] !== null) {
                const coords = [Number(req.body.location.coordinates[0]), Number(req.body.location.coordinates[1])];
                if (!isValidLngLatPair(coords)) {
                    return res.status(400).json({ success: false, message: "Invalid coordinates — longitude must be -180..180 and latitude -90..90" });
                }
                pincode.location = { type: "Point", coordinates: coords };
            } else {
                pincode.location = undefined;
            }
        }

        await pincode.save();

        // [FIX-PM5] Invalidate all related caches
        await Promise.all([
            safeDelPrefix("pincode:admin:"),
            safeDelPrefix(`pincode:check:${prevCode}`),
        ]);

        res.json({ success: true, pincode, message: "Pincode updated" });
    } catch (err) {
        console.error("[updatePincode]", err);
        res.status(500).json({ success: false, message: "Failed to update pincode" });
    }
};

/* ── ADMIN: Delete pincode ─────────────────────────────────────────── */
export const deletePincode = async (req, res) => {
    try {
        const pincode = await Pincode.findByIdAndDelete(req.params.id);
        if (!pincode) return res.status(404).json({ success: false, message: "Pincode not found" });

        // BUG FIX: a deleted pincode used to leave dangling entries in every
        // vendor's servicePincodes array — those vendors kept believing (and
        // checkPincode/validateDeliveryServiceability kept treating) the
        // removed code as serviceable, since nothing ever pulled it back out.
        await Vendor.updateMany(
            { servicePincodes: pincode.code },
            { $pull: { servicePincodes: pincode.code } }
        );

        // [FIX-PM6] Invalidate all related caches
        await Promise.all([
            safeDelPrefix("pincode:admin:"),
            safeDelPrefix(`pincode:check:${pincode.code}`),
        ]);

        res.json({ success: true, message: "Pincode deleted" });
    } catch (err) {
        console.error("[deletePincode]", err);
        res.status(500).json({ success: false, message: "Failed to delete pincode" });
    }
};