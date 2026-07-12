/**
 * deliveryAuthController.js — Delivery Partner Authentication
 */

import User from "../../models/User.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import DeliveryApplication from "../../models/deliveryModels/DeliveryApplication.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId, type: "delivery" }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
    const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
    return { accessToken, refreshToken };
};

export const registerDeliveryPartner = async (req, res) => {
    try {
        const { name, phone, email, password, confirmPassword } = req.body;

        if (!name || !phone || !email || !password) {
            return res.status(400).json({ success: false, message: "All fields required" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const existingUser = await User.findOne({ $or: [{ phone }, { email }] });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            phone,
            email,
            password: hashedPassword,
            role: "delivery_partner",
            isVerified: true,
        });

        const deliveryBoy = await DeliveryBoy.create({
            userId: user._id,
            name,
            phone,
            email,
            status: "pending",
            applicationStatus: "form_incomplete",
        });

        const application = await DeliveryApplication.create({
            userId: user._id,
            status: "form_incomplete",
            formStartedAt: new Date(),
        });

        const { accessToken, refreshToken } = generateTokens(user._id);

        res.status(201).json({
            success: true,
            message: "Registration successful",
            accessToken,
            refreshToken,
            user: { id: user._id, name, phone, email },
            deliveryBoy: { id: deliveryBoy._id, status: deliveryBoy.status },
        });
    } catch (err) {
        console.error("[registerDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Registration failed" });
    }
};

export const loginDeliveryPartner = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ success: false, message: "Phone and password required" });
        }

        const user = await User.findOne({ phone, role: "delivery_partner" });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });

        const { accessToken, refreshToken } = generateTokens(user._id);

        res.json({
            success: true,
            message: "Login successful",
            accessToken,
            refreshToken,
            user: { id: user._id, name: user.name, phone: user.phone, email: user.email },
            deliveryBoy: deliveryBoy
                ? {
                      id: deliveryBoy._id,
                      status: deliveryBoy.status,
                      applicationStatus: deliveryBoy.applicationStatus,
                  }
                : null,
        });
    } catch (err) {
        console.error("[loginDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Login failed" });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ success: false, message: "Refresh token required" });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const { accessToken } = generateTokens(decoded.userId);

        res.json({ success: true, accessToken });
    } catch (err) {
        console.error("[refreshToken]", err);
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};

export const logoutDeliveryPartner = async (req, res) => {
    try {
        await DeliveryBoy.findOneAndUpdate({ userId: req.user._id }, { isOnline: false });
        res.json({ success: true, message: "Logout successful" });
    } catch (err) {
        console.error("[logoutDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Logout failed" });
    }
};

export const getDeliveryStatus = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id }).lean();
        const app = await DeliveryApplication.findOne({ userId: req.user._id }).lean();

        if (!db) {
            return res.json({
                registered: false,
                applicationStatus: "not_applied",
            });
        }

        res.json({
            registered: true,
            status: db.status,
            applicationStatus: db.applicationStatus,
            kycStatus: db.kycStatus,
            deliveryBoyId: db._id,
            name: db.name,
            isOnline: db.isOnline,
            application: app || null,
        });
    } catch (err) {
        console.error("[getDeliveryStatus]", err);
        res.status(500).json({ success: false, message: "Failed to fetch status" });
    }
};

export default {
    registerDeliveryPartner,
    loginDeliveryPartner,
    refreshToken,
    logoutDeliveryPartner,
    getDeliveryStatus,
};
