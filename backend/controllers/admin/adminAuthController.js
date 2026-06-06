import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import User from "../../models/User.js";

/**
 * Helper: Generate Final Admin JWT and set HttpOnly Cookie
 */
const issueFinalAdminToken = (res, user) => {
    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" } // 24 hours
    );

    res.cookie("admin_jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
    });

    return token;
};

/**
 * STEP 1: Admin Login Initiation
 * Validates credentials. If 2FA is enabled, issues a temporary token.
 * Otherwise, logs them in directly (if 2FA isn't enforced globally yet).
 */
export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch user with password and 2FA secret
        const user = await User.findOne({ email }).select("+password +twoFactorSecret");
        if (!user || !["admin", "owner", "super_admin"].includes(user.role)) {
            return res.status(401).json({ success: false, message: "Invalid admin credentials" });
        }

        // Placeholder for your password verification logic (e.g., bcrypt.compare)
        // const isMatch = await user.comparePassword(password);
        const isMatch = password === user.password; // Replace with your actual password check
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid admin credentials" });
        }

        // ── If 2FA is enabled, halt standard login and issue a pending token ──
        if (user.is2faEnabled) {
            const pendingToken = jwt.sign(
                { id: user._id, is2faPending: true },
                process.env.JWT_SECRET,
                { expiresIn: "5m" } // Strict 5-minute window to enter OTP
            );

            return res.status(200).json({
                success: true,
                requires2fa: true,
                message: "2FA required. Please submit your authenticator code.",
                pendingToken, // Frontend stores this in memory temporarily
            });
        }

        // ── If 2FA is NOT enabled, log them in directly ──
        issueFinalAdminToken(res, user);

        res.status(200).json({
            success: true,
            message: "Login successful",
            user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ success: false, message: "Server error during login" });
    }
};

/**
 * STEP 2: Verify 2FA OTP & Issue Final Token
 * Called after step 1 if the user has 2FA enabled.
 */
export const verify2fa = async (req, res) => {
    try {
        const { pendingToken, otp } = req.body;

        if (!pendingToken || !otp) {
            return res.status(400).json({ success: false, message: "Token and OTP are required" });
        }

        // Decode the temporary token
        const decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
        if (!decoded.is2faPending) {
            return res.status(401).json({ success: false, message: "Invalid pending token" });
        }

        const user = await User.findById(decoded.id).select("+twoFactorSecret");
        if (!user || !user.is2faEnabled) {
            return res.status(400).json({ success: false, message: "2FA is not enabled for this user" });
        }

        // Verify the provided OTP against the stored secret
        const isValid = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: "base32",
            token: otp,
            window: 1, // Allows ±30 second drift
        });

        if (!isValid) {
            return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
        }

        // ✅ Success: Issue the final secure HttpOnly cookie
        issueFinalAdminToken(res, user);

        res.status(200).json({
            success: true,
            message: "2FA verification successful",
            user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Login window expired. Try again." });
        }
        res.status(500).json({ success: false, message: "Server error during 2FA verification" });
    }
};

/**
 * ── ADMIN SETTINGS: SETUP 2FA ──
 * Generates a secret and QR code for the admin to scan into Google Authenticator.
 * (Should be protected by standard admin auth middleware)
 */
export const generate2faSecret = async (req, res) => {
    try {
        // Generate a cryptographically secure secret
        const secret = speakeasy.generateSecret({
            name: `Urbexon Admin (${req.user.email})`,
        });

        // Temporarily save the secret in DB (but 2FA is NOT enabled until they verify it)
        await User.findByIdAndUpdate(req.user._id, { twoFactorSecret: secret.base32 });

        // Generate QR Code data URL for the frontend to render an image
        QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
            if (err) return res.status(500).json({ success: false, message: "QR Generation failed" });

            res.status(200).json({
                success: true,
                secret: secret.base32, // Allow manual entry if camera is broken
                qrCode: dataUrl,
            });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error generating 2FA secret" });
    }
};