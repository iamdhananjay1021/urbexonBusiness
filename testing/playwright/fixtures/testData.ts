/**
 * Deterministic QA test data — must stay in sync with seed/seed.mjs.
 */
export const QA_PASSWORD = "QaTest@12345";

export const USERS = {
    customer: { email: "qa.customer@urbexon.test", phone: "9800000001", name: "QA Customer", role: "user" },
    vendor: { email: "qa.vendor@urbexon.test", phone: "9800000002", name: "QA Vendor", role: "vendor" },
    delivery: { email: "qa.delivery@urbexon.test", phone: "9800000003", name: "QA Delivery", role: "delivery_boy" },
    admin: { email: "qa.admin@urbexon.test", phone: "9800000004", name: "QA Admin", role: "admin" },
} as const;

export const PRODUCT = { name: "QA Test Product", slug: "qa-test-product", price: 499 };
export const CATEGORY = { name: "QA Test Category", slug: "qa-test-category" };
export const COUPON = { code: "QATEST10" };

export const ORDER_ADDRESS = {
    customerName: USERS.customer.name,
    phone: USERS.customer.phone,
    address: "QA Lane 42, Sector 62, Noida, Uttar Pradesh 201301",
};

/** localStorage keys each app uses for its auth blob */
export const STORAGE_KEYS = {
    client: "auth",       // { token, user }
    vendor: "vendorAuth", // { token, vendor }
    admin: "adminAuth",   // { token, user }
    delivery: "deliveryAuth", // { token, rider }
} as const;
