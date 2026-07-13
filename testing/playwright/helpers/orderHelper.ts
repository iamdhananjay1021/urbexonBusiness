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
    // The seeded QA product is an Urbexon-Hour product (vendor-owned), and the
    // default /api/products listing filters to productType=ecommerce — so we
    // must query the urbexon_hour listing explicitly. Fall back to the
    // ecommerce listing in case the catalog is configured differently.
    const queries = [
        `${EP.products}?productType=urbexon_hour&search=${encodeURIComponent(PRODUCT.name)}&limit=50`,
        `${EP.products}?productType=urbexon_hour&limit=50`,
        `${EP.products}?search=${encodeURIComponent(PRODUCT.name)}&limit=50`,
    ];
    for (const q of queries) {
        const res = await api.get(q);
        if (res.status() >= 400) continue;
        const body = await res.json().catch(() => ({}));
        const list: any[] = body.products || body.data || body.items || (Array.isArray(body) ? body : []);
        const match = list.find(p => p.slug === PRODUCT.slug || p.name === PRODUCT.name);
        if (match) return match._id || match.id || null;
    }
    return null;
};

export const buildItems = (productId: string, qty = 1) => [{ productId, qty }];

// Coordinates ~matching the seeded vendor location (28.6139, 77.2090) so the
// Urbexon-Hour serviceability check (distance ≤ vendor radius) passes; pincode
// 201301 is seeded as an active COD pincode.
export const buildOrder = (productId: string, paymentMethod: "COD" | "RAZORPAY" = "COD") => ({
    items: buildItems(productId),
    customerName: ORDER_ADDRESS.customerName,
    phone: ORDER_ADDRESS.phone,
    address: ORDER_ADDRESS.address,
    pincode: "201301",
    city: "Noida",
    state: "Uttar Pradesh",
    latitude: 28.6142,
    longitude: 77.2085,
    deliveryType: "URBEXON_HOUR",
    paymentMethod,
});
