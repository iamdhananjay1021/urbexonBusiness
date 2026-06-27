import mongoose from "mongoose";
import dotenv from "dotenv";
import Vendor from "../models/vendorModels/Vendor.js";
import User from "../models/User.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js"; // Correct model name

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB Connected...");
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const migrateRoles = async () => {
    await connectDB();
    let totalUpdated = 0;

    // --- Migrate Vendors ---
    console.log("Starting vendor role migration...");
    const approvedVendors = await Vendor.find({ status: "approved" }).lean();

    if (approvedVendors.length === 0) {
        console.log("No approved vendors found. Nothing to migrate for vendors.");
    } else {
        let updatedVendors = 0;
        for (const vendor of approvedVendors) {
            const user = await User.findById(vendor.userId);
            if (user && user.role !== "vendor") {
                user.role = "vendor";
                await user.save({ validateBeforeSave: false });
                console.log(`Updated user ${user.email} (ID: ${user._id}) to role 'vendor'.`);
                updatedVendors++;
            } else if (!user) {
                console.warn(`Warning: No user found for vendor ${vendor.shopName} (User ID: ${vendor.userId})`);
            }
        }
        console.log(`\nVendor migration complete. Total vendors processed: ${approvedVendors.length}.`);
        console.log(`Users updated to 'vendor' role: ${updatedVendors}.`);
        totalUpdated += updatedVendors;
    }

    console.log("\n----------------------------------------\n");

    // --- Migrate Delivery Partners ---
    console.log("Starting delivery partner role migration...");
    // Find users with the old 'delivery_boy' role
    const approvedPartners = await DeliveryBoy.find({ status: "approved" }).lean(); // Using DeliveryBoy model
    const oldRoleUsers = await User.find({ role: "delivery_boy" }).lean();
    const userIdsToUpdate = new Set([
        ...approvedPartners.map(p => p.userId.toString()),
        ...oldRoleUsers.map(u => u._id.toString())
    ]);

    if (userIdsToUpdate.size === 0) {
        console.log("No approved delivery partners or users with old 'delivery_boy' role found.");
    } else {
        let updatedPartners = 0;
        for (const userId of userIdsToUpdate) {
            const result = await User.updateMany(
                { _id: userId, role: { $ne: "delivery" } },
                { $set: { role: "delivery" } }
            );
            if (result.modifiedCount > 0) {
                console.log(`Updated user (ID: ${userId}) to role 'delivery'.`);
                updatedPartners++;
            }
        }
        console.log(`\nDelivery partner migration complete. Total partners processed: ${userIdsToUpdate.size}.`);
        console.log(`Users updated to 'delivery' role: ${updatedPartners}.`);
        totalUpdated += updatedPartners;
    }

    console.log(`\n\nTotal users updated across all roles: ${totalUpdated}.`);
    process.exit(0);
};

migrateRoles();