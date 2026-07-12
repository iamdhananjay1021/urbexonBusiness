/**
 * Order-flow helpers — resolve the seeded QA product and build valid
 * order/pricing payloads against the REAL createOrder validation rules
 * (items required, customerName 2-100, phone /^[6-9]\d{9}$/, address >=5,
 * paymentMethod COD|RAZORPAY).
 */
import { APIRequestContext } from "@playwright/test";
import { EP } from "./api";
import { PRODUCT, ORDER_ADDRESS } from "../fixtures/testData";

export const resolveQaProductId = async (api: APIRequestContext): Promise<string | null> => {
    // Public products endpoint — find the seeded QA product by slug/name.
    const res = await api.get(`${EP.products}?search=${encodeURIComponent(PRODUCT.name)}&limit=20`);
    if (res.status() >= 400) return null;
    const body = await res.json().catch(() => ({}));
    const list: any[] = body.products || body.data || body.items || (Array.isArray(body) ? body : []);
    const match = list.find(p => p.slug === PRODUCT.slug || p.name === PRODUCT.name) || list[0];
    return match?._id || match?.id || null;
};

export const buildItems = (productId: string, qty = 1) => [{ productId, qty }];

export const buildOrder = (productId: string, paymentMethod: "COD" | "RAZORPAY" = "COD") => ({
    items: buildItems(productId),
    customerName: ORDER_ADDRESS.customerName,
    phone: ORDER_ADDRESS.phone,
    address: ORDER_ADDRESS.address,
    paymentMethod,
});
