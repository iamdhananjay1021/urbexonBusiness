/**
 * deliveryBoyAuth.js — Production Ready
 * Handles the application process for new delivery partners.
 *
 * FIXES:
 * - Ensures only authenticated users can apply.
 * - Prevents duplicate applications from the same user.
 * - Uses the authenticated user's ID and email, not unverified form data.
 */

import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import {
    login as deliveryLogin,
    deliveryForgotPassword,
    deliveryResetPassword,
} from '../authController.js';
import User from "../../models/User.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { createNotification } from "../admin/notificationController.js";

/**
 * POST /api/delivery/register
 * @description Handles new delivery partner applications. Requires user to be authenticated.
 *
 * Re-exporting deliveryLogin for routing convenience.
 * @access Private
 */
export const registerDeliveryPartner = async (req, res) => {
    try {
        const {
            phone,
            vehicleType,
            vehicleNumber,
            drivingLicenseNumber,
            address, // Expects a JSON string: { line1, city, state, pincode }
        } = req.body;
        const fullName = req.user?.name; // Use authenticated user's name
        // 1. Basic Validation
        if (!fullName || !phone || !vehicleType || !drivingLicenseNumber) {
            return res.status(400).json({
                success: false,
                message: "Full name, phone, vehicle type, and driving license are required.",
            });
        }

        // 2. Ensure user is authenticated (via `protect` middleware)
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in or register first.",
            });
        }
        const userId = user._id;

        // 3. Check for duplicate applications
        const existingApplication = await DeliveryBoy.findOne({ userId, isDeleted: false });
        if (existingApplication) {
            return res.status(409).json({
                success: false,
                message: "You have already submitted a delivery partner application.",
                status: existingApplication.status,
            });
        }

        // 4. Parse address from JSON string
        const parsedAddress = (() => {
            try {
                return typeof address === 'string' ? JSON.parse(address) : (address || {});
            } catch {
                return {};
            }
        })();

        // 5. Upload documents to Cloudinary
        const uploads = {};
        const docFields = ["profilePhoto", "drivingLicensePhoto", "vehicleRCPhoto", "aadhaarPhoto"];

        for (const field of docFields) {
            if (req.files?.[field]?.[0]) {
                try {
                    const result = await uploadToCloudinary(
                        req.files[field][0].buffer,
                        `delivery_partners/${userId}/${field}`
                    );
                    uploads[field] = result.secure_url;
                } catch (e) {
                    console.warn(`[DeliveryApply] Upload failed for ${field}:`, e.message);
                }
            }
        }

        // 6. Create DeliveryBoy document
        const deliveryPartner = await DeliveryBoy.create({
            userId,
            name: fullName.trim(),
            email: user.email, // Use authenticated user's email
            phone: phone.trim(),
            vehicle: {
                type: vehicleType,
                number: vehicleNumber?.trim().toUpperCase() || "",
            },
            drivingLicense: {
                number: drivingLicenseNumber.trim(),
                photoUrl: uploads.drivingLicensePhoto || "",
            },
            address: {
                full: parsedAddress.line1 || "",
                city: parsedAddress.city || "",
                state: parsedAddress.state || "",
                pincode: parsedAddress.pincode || "",
            },
            profilePhotoUrl: uploads.profilePhoto || "",
            documents: {
                vehicleRC: uploads.vehicleRCPhoto || "",
                aadhaar: uploads.aadhaarPhoto || "",
            },
            status: "pending", // Initial status
        });

        // 7. Notify admin (fire-and-forget)
        createNotification({
            type: "delivery",
            title: "New Delivery Partner Application",
            message: `${fullName.trim()} has applied to be a delivery partner.`,
            icon: "delivery",
            link: "/admin/delivery-partners",
            meta: { deliveryPartnerId: deliveryPartner._id },
        });

        return res.status(201).json({
            success: true,
            message: "Application submitted successfully! We will review it and get back to you.",
            deliveryPartnerId: deliveryPartner._id,
        });

    } catch (err) {
        console.error("[registerDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Application failed. Please try again." });
    }
};

export { deliveryLogin, deliveryForgotPassword, deliveryResetPassword };