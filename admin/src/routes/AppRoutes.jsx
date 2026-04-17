/**
 * AppRoutes.jsx — Admin Panel v3.0
 * ✅ React.lazy code splitting for all page components
 * ✅ Suspense fallback for loading states
 */
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "../pages/AdminLogin";
import Admin from "../pages/Admin";
import AdminRoute from "./AdminRoute";

const AdminForgotPassword = lazy(() => import("../pages/AdminForgotPassword"));
const AdminResetPassword = lazy(() => import("../pages/AdminResetPassword"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const AdminProducts = lazy(() => import("../pages/AdminProducts"));
const AdminAddProduct = lazy(() => import("../pages/AdminAddProduct"));
const AdminEditProduct = lazy(() => import("../pages/AdminEditProduct"));
const AdminOrders = lazy(() => import("../pages/AdminOrders"));
const AdminBanners = lazy(() => import("../pages/AdminBanners"));
const AdminAddBanner = lazy(() => import("../pages/Adminaddbanner"));
const AdminEditBanner = lazy(() => import("../pages/Admineditbanner"));
const AdminCategories = lazy(() => import("../pages/Admincategories"));
const AdminAddCategory = lazy(() => import("../pages/Adminaddcategory"));
const AdminEditCategory = lazy(() => import("../pages/Admineditcategory"));
const AdminVendors = lazy(() => import("../pages/AdminVendors"));
const AdminVendorDetail = lazy(() => import("../pages/AdminVendorDetail"));
const AdminDeliveryBoys = lazy(() => import("../pages/AdminDeliveryBoys"));
const AdminSubscriptions = lazy(() => import("../pages/AdminSubscriptions"));
const AdminPincodes = lazy(() => import("../pages/AdminPincodes"));
const AdminSettlements = lazy(() => import("../pages/AdminSettlements"));
const AdminPayouts = lazy(() => import("../pages/AdminPayouts"));
const AdminLocalDelivery = lazy(() => import("../pages/AdminLocalDelivery"));
const AdminCustomers = lazy(() => import("../pages/AdminCustomers"));
const AdminRefundReturn = lazy(() => import("../pages/AdminRefundReturn"));
const AdminCoupons = lazy(() => import("../pages/AdminCoupons"));
const AdminMapDashboard = lazy(() => import("../pages/AdminMapDashboard"));

const Loader = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
);

const AppRoutes = () => (
    <Suspense fallback={<Loader />}>
        <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
            <Route path="/admin/reset-password/:token" element={<AdminResetPassword />} />

            <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />}>
                    <Route index element={<AdminDashboard />} />

                    {/* Products */}
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="products/new" element={<AdminAddProduct />} />
                    <Route path="products/:id/edit" element={<AdminEditProduct />} />

                    {/* Orders */}
                    <Route path="orders" element={<AdminOrders />} />

                    {/* Banners */}
                    <Route path="banners" element={<AdminBanners />} />
                    <Route path="banners/new" element={<AdminAddBanner />} />
                    <Route path="banners/:id/edit" element={<AdminEditBanner />} />

                    {/* Categories */}
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="categories/new" element={<AdminAddCategory />} />
                    <Route path="categories/:slug/edit" element={<AdminEditCategory />} />

                    {/* Vendors */}
                    <Route path="vendors" element={<AdminVendors />} />
                    <Route path="vendors/:id" element={<AdminVendorDetail />} />

                    {/* Users */}
                    <Route path="customers" element={<AdminCustomers />} />
                    <Route path="delivery-boys" element={<AdminDeliveryBoys />} />

                    {/* Finance */}
                    <Route path="subscriptions" element={<AdminSubscriptions />} />
                    <Route path="settlements" element={<AdminSettlements />} />
                    <Route path="payouts" element={<AdminPayouts />} />
                    <Route path="refunds" element={<AdminRefundReturn />} />
                    <Route path="coupons" element={<AdminCoupons />} />

                    {/* Operations */}
                    <Route path="pincodes" element={<AdminPincodes />} />
                    <Route path="local-delivery" element={<AdminLocalDelivery />} />
                    <Route path="map" element={<AdminMapDashboard />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
    </Suspense>
);

export default AppRoutes;
