/**
 * QA seed script — upserts deterministic test data straight into MongoDB.
 *
 * Why direct DB writes: user registration requires an email OTP round-trip
 * which cannot be automated against a real mailbox, so QA accounts are
 * created pre-verified. Everything else (vendor/delivery approval state,
 * product catalog entries) mirrors exactly what the admin flows produce.
 *
 * Idempotent: safe to run repeatedly; keyed on fixed QA emails/slugs.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// Fall back to the backend's own .env for MONGO_URI. override:true is
// required because testing/.env ships an empty MONGO_URI= placeholder, and
// without override dotenv keeps that empty value instead of the real one.
if (!process.env.MONGO_URI) {
    dotenv.config({ path: path.resolve(__dirname, "../../../backend/.env"), override: true });
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("[seed] MONGO_URI not found in testing/.env or backend/.env");
    process.exit(1);
}

export const QA = {
    password: "QaTest@12345",
    customer: { email: "qa.customer@urbexon.test", phone: "9800000001", name: "QA Customer" },
    vendor: { email: "qa.vendor@urbexon.test", phone: "9800000002", name: "QA Vendor" },
    delivery: { email: "qa.delivery@urbexon.test", phone: "9800000003", name: "QA Delivery" },
    admin: { email: "qa.admin@urbexon.test", phone: "9800000004", name: "QA Admin" },
    product: { name: "QA Test Product", slug: "qa-test-product", price: 499 },
    category: { name: "QA Test Category", slug: "qa-test-category" },
    coupon: { code: "QATEST10" },
};

// Loose schemas (strict:false) — we only pin the fields the app reads;
// documents keep whatever shape the real models define.
const loose = (name, collection) =>
    mongoose.models[name] || mongoose.model(name, new mongoose.Schema({}, { strict: false, collection }));

const User = loose("QaUser", "users");
const Vendor = loose("QaVendor", "vendors");
const DeliveryBoy = loose("QaDeliveryBoy", "deliveryboys");
const Product = loose("QaProduct", "products");
const Category = loose("QaCategory", "categories");
const Coupon = loose("QaCoupon", "coupons");
const Subscription = loose("QaSubscription", "subscriptions");
const Pincode = loose("QaPincode", "pincodes");

// Delhi coords, ~1-2km apart — well inside the 10km Urbexon Hour radius.
const UH_VENDOR_LOC = { lat: 28.6139, lng: 77.2090 };
const UH_PINCODE = "201301";

const upsertUser = async (u, role, hash) => {
    const doc = await User.findOneAndUpdate(
        { email: u.email },
        {
            $set: {
                name: u.name, email: u.email, phone: u.phone, role,
                password: hash, isEmailVerified: true,
                isBlocked: false, isDeleted: false,
            },
            $setOnInsert: { tokenVersion: 0, createdAt: new Date() },
        },
        { upsert: true, new: true }
    );
    return doc;
};

const run = async () => {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    const hash = await bcrypt.hash(QA.password, 10);

    const customer = await upsertUser(QA.customer, "user", hash);
    const vendorUser = await upsertUser(QA.vendor, "vendor", hash);
    const deliveryUser = await upsertUser(QA.delivery, "delivery_boy", hash);
    const admin = await upsertUser(QA.admin, "admin", hash);

    // Approved vendor profile (what admin approval produces) — plus every
    // field needed to place a real Urbexon Hour order end-to-end (location/
    // isOpen/acceptingOrders/subscription/deliveryMode are all checked by
    // validateDeliveryServiceability before an order can be created;
    // isDeleted is required by protectVendor's own lookup query, so leaving
    // it unset made every vendor-authenticated route 404 with "Vendor
    // profile not found" despite the vendor existing).
    await Vendor.findOneAndUpdate(
        { userId: vendorUser._id },
        {
            $set: {
                userId: vendorUser._id,
                name: QA.vendor.name,
                shopName: "QA Test Shop",
                email: QA.vendor.email,
                phone: QA.vendor.phone,
                status: "approved",
                isActive: true,
                isDeleted: false,
                location: { type: "Point", coordinates: [UH_VENDOR_LOC.lng, UH_VENDOR_LOC.lat] },
                isOpen: true,
                acceptingOrders: true,
                subscription: { isActive: true, expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
                deliveryRadius: 10,
                deliveryMode: "platform",
            },
        },
        { upsert: true, new: true }
    );

    // Approved delivery partner profile
    await DeliveryBoy.findOneAndUpdate(
        { userId: deliveryUser._id },
        {
            $set: {
                userId: deliveryUser._id,
                name: QA.delivery.name,
                phone: QA.delivery.phone,
                status: "approved",
                isOnline: false,
            },
        },
        { upsert: true, new: true }
    );

    await Category.findOneAndUpdate(
        { slug: QA.category.slug },
        { $set: { name: QA.category.name, slug: QA.category.slug, isActive: true } },
        { upsert: true }
    );

    const vendorDoc = await Vendor.findOne({ userId: vendorUser._id });
    await Product.findOneAndUpdate(
        { slug: QA.product.slug },
        {
            $set: {
                name: QA.product.name,
                slug: QA.product.slug,
                description: "Deterministic product used by the automated QA suite.",
                price: QA.product.price,
                mrp: 999,
                stock: 100,
                category: QA.category.slug,
                images: [{ url: "https://placehold.co/600x600/png", alt: "QA product" }],
                isActive: true,
                status: "active",
                vendorId: vendorDoc?._id,
                // Vendor-owned products are Urbexon Hour by definition; "in
                // stock" must be explicit — orderValidations.js checks
                // `product.inStock` directly (not just the stock count), and
                // an unset field reads as falsy, so every checkout failed
                // with "out of stock or has insufficient quantity" without it.
                productType: "urbexon_hour",
                inStock: true,
            },
        },
        { upsert: true }
    );

    // A real Subscription doc (separate from Vendor.subscription above) —
    // requireActiveSubscription middleware queries this collection directly
    // for every vendor-authenticated order route.
    await Subscription.findOneAndUpdate(
        { vendorId: vendorDoc?._id },
        { $set: { vendorId: vendorDoc?._id, status: "active", expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) } },
        { upsert: true }
    );

    // COD is only allowed for pincodes explicitly marked "active".
    await Pincode.findOneAndUpdate(
        { code: UH_PINCODE },
        { $set: { code: UH_PINCODE, status: "active", city: "Noida", state: "Uttar Pradesh" } },
        { upsert: true }
    );

    await Coupon.findOneAndUpdate(
        { code: QA.coupon.code },
        {
            $set: {
                code: QA.coupon.code,
                discountType: "percent",
                discountValue: 10,
                minOrderValue: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
            },
        },
        { upsert: true }
    );

    const product = await Product.findOne({ slug: QA.product.slug }).lean();
    console.log("[seed] OK", JSON.stringify({
        customer: customer._id, vendor: vendorUser._id,
        delivery: deliveryUser._id, admin: admin._id,
        productId: product?._id,
    }));
    await mongoose.disconnect();
};

run().catch((e) => { console.error("[seed] FAILED:", e.message); process.exit(1); });
