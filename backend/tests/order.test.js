/**
 * tests/order.test.js — Order flow tests
 */
import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { buildApp, connectTestDB, disconnectTestDB, createTestUser } from "./helpers.js";
import { deductStock } from "../services/pricing.js";

jest.mock("../utils/emailService.js", () => ({
    sendEmail:           jest.fn().mockResolvedValue({ success: true }),
    sendEmailBackground: jest.fn(),
}));

jest.mock("../config/redis.js", () => ({
    connectRedis: jest.fn(),
    getRedis:     jest.fn().mockReturnValue(null),
    isRedisUp:    jest.fn().mockReturnValue(false),
}));

// Mock Razorpay so tests don't need real keys
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn().mockResolvedValue({ id: "order_test123", amount: 50000, currency: "INR" }) },
    }));
});

let app, token, userId, productId;

beforeAll(async () => {
    await connectTestDB();
    app = buildApp();

    // Create test user and login
    const user = await createTestUser({ email: `order_${Date.now()}@test.com` });
    userId = user._id;
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "Password123!" });
    token = login.body.token;

    // Create test product directly in DB
    const Product = (await import("../models/Product.js")).default;
    const product = await Product.create({
        name:        "Test Product",
        price:       299,
        mrp:         499,
        category:    "Electronics",
        stock:       100,
        inStock:     true,
        productType: "ecommerce",
        isActive:    true,
    });
    productId = product._id;
});

afterAll(async () => {
    await disconnectTestDB();
});

/* ── PRICING ── */
describe("POST /api/orders/pricing", () => {
    it("should return server-calculated pricing", async () => {
        const res = await request(app)
            .post("/api/orders/pricing")
            .set("Authorization", `Bearer ${token}`)
            .send({
                items:         [{ productId: productId.toString(), quantity: 2 }],
                paymentMethod: "COD",
            });
        expect(res.status).toBe(200);
        expect(res.body.itemsTotal).toBe(598);     // 299 * 2
        expect(res.body.finalTotal).toBeGreaterThan(0);
    });

    it("should reject empty cart", async () => {
        const res = await request(app)
            .post("/api/orders/pricing")
            .set("Authorization", `Bearer ${token}`)
            .send({ items: [] });
        expect([400, 422]).toContain(res.status);
    });
});

/* ── CREATE ORDER (COD) ── */
describe("POST /api/orders", () => {
    it("should create COD order successfully", async () => {
        const res = await request(app)
            .post("/api/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({
                items:         [{ productId: productId.toString(), quantity: 1 }],
                customerName:  "Rajneesh Kumar",
                phone:         "9876543210",
                address:       "123 Test Street, Lucknow",
                pincode:       "226001",
                paymentMethod: "COD",
                deliveryType:  "ECOMMERCE_STANDARD",
            });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.orderId).toBeDefined();
        expect(res.body.invoiceNumber).toBeDefined();
        expect(res.body.orderStatus).toBe("CONFIRMED");
    });

    it("should reject missing customer details", async () => {
        const res = await request(app)
            .post("/api/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({
                items:         [{ productId: productId.toString(), quantity: 1 }],
                paymentMethod: "COD",
            });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("should reject unauthenticated request", async () => {
        const res = await request(app).post("/api/orders").send({ items: [] });
        expect(res.status).toBe(401);
    });
});

/* ── GET MY ORDERS ── */
describe("GET /api/orders/my", () => {
    it("should return authenticated user orders", async () => {
        const res = await request(app)
            .get("/api/orders/my")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.orders || res.body)).toBe(true);
    });

    it("should reject unauthenticated request", async () => {
        const res = await request(app).get("/api/orders/my");
        expect(res.status).toBe(401);
    });
});

/* ── CANCEL ORDER ── */
describe("PATCH /api/orders/:id/cancel", () => {
    it("should allow user to cancel PLACED order", async () => {
        // Create an order first
        const createRes = await request(app)
            .post("/api/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({
                items:         [{ productId: productId.toString(), quantity: 1 }],
                customerName:  "Test User",
                phone:         "9876543210",
                address:       "456 Test Avenue, Delhi",
                pincode:       "110001",
                paymentMethod: "COD",
                deliveryType:  "ECOMMERCE_STANDARD",
            });
        expect(createRes.status).toBe(201);
        const orderId = createRes.body.orderId;

        // Cancel it
        const cancelRes = await request(app)
            .patch(`/api/orders/${orderId}/cancel`)
            .set("Authorization", `Bearer ${token}`);
        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.success).toBe(true);
    });

    it("should reject cancel for non-existent order", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .patch(`/api/orders/${fakeId}/cancel`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});

describe("deductStock()", () => {
    it("should roll back partial deductions on failure", async () => {
        const Product = (await import("../models/Product.js")).default;

        const p1 = await Product.create({
            name: "Rollback Product A",
            price: 100,
            category: "Test",
            stock: 5,
            inStock: true,
            productType: "ecommerce",
            isActive: true,
        });

        const p2 = await Product.create({
            name: "Rollback Product B",
            price: 100,
            category: "Test",
            stock: 1,
            inStock: true,
            productType: "ecommerce",
            isActive: true,
        });

        await expect(
            deductStock([
                { productId: p1._id, name: p1.name, qty: 2 },
                { productId: p2._id, name: p2.name, qty: 2 }, // will fail
            ])
        ).rejects.toThrow(/went out of stock/i);

        const [p1After, p2After] = await Promise.all([
            Product.findById(p1._id).select("stock inStock").lean(),
            Product.findById(p2._id).select("stock inStock").lean(),
        ]);

        expect(p1After.stock).toBe(5);
        expect(p2After.stock).toBe(1);
    });
});
