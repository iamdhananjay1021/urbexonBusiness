import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const resetDatabase = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not defined in .env file");
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // 1. Drop the ENTIRE database (Deletes all Users, Orders, Vendors, Products, Delivery Boys, etc.)
        await mongoose.connection.db.dropDatabase();
        console.log("✅ Database completely wiped clean! (All data deleted)");

        // 2. Hash the new password securely
        const hashedPassword = await bcrypt.hash("Nikhil@0001", 12);

        // 3. Create the new Admin (Owner)
        const newAdmin = await User.create({
            name: "Dhananjay Pandey",
            email: "pandeydhananjay1444@gmail.com",
            password: hashedPassword,
            phone: "9876543210", // Default phone (required by schema)
            role: "owner",       // Super admin role
            isEmailVerified: true
        });

        console.log("✅ Fresh Admin successfully created! You can now login to your empty store.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error resetting database:", error);
        process.exit(1);
    }
};

resetDatabase();