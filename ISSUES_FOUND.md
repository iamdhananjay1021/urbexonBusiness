# 🔴 URBEXON ISSUES FOUND - Apr 19, 2026

## ISSUE #1: Urbexon Hour Availability Missing in Product List
**Status:** CRITICAL 🔴  
**File:** `backend/controllers/productController.js` (Line 237-249)

### Problem:
```javascript
export const getUrbexonHourProducts = async (req, res) => {
    // ❌ MISSING: .select() statement
    // Returns ALL fields but NO explicit select for inStock/stock
    const [products, total] = await Promise.all([
        Product.find(filter)
            .populate("vendorId", "shopName shopLogo rating isOpen city")
            .sort({ isFeatured: -1, createdAt: -1 })
            .skip(skip).limit(Number(limit)).lean(),
        // ❌ NO SELECT - inStock might not be included
    ]);
};
```

**Impact:** 
- Frontend UrbexonHour.jsx expects `product.inStock` to show availability
- If field is not returned, ALL products show as available (wrong!)
- "Out of Stock" overlay won't work properly

**Fix:** Add explicit `.select()` with `inStock stock` fields

---

## ISSUE #2: Vendor Registration - Missing Phone Validation on Frontend
**Status:** MEDIUM 🟡  
**File:** `client/src/pages/BecomeVendor.jsx` (Line 89-90)

### Problem:
```javascript
if (!form.shopName || !form.ownerName || !form.phone || !form.email)
  return setError("Shop name, owner name, phone aur email zaroori hain");
if (!form.pincode || !/^\d{6}$/.test(form.pincode))
  return setError("Valid 6-digit pincode daalen");

// ❌ ISSUE: Phone validation happens on BACKEND only
// Frontend accepts ANY phone number, backend validates
```

**Impact:**
- Users can submit invalid phone numbers
- Backend will accept it and create account
- Vendor won't be able to login with invalid number
- Support tickets will increase

**Fix:** Add frontend phone validation like pincode

---

## ISSUE #3: Vendor Status Check - Missing "pending" Redirect
**Status:** MEDIUM 🟡  
**File:** `client/src/pages/BecomeVendor.jsx` (Line 178-190)

### Problem:
```javascript
if (status) {
    const cfg = {
        pending: { color: "#f59e0b", bg: "#fffbeb", icon: "⏳", 
                  title: "Application Review Mein Hai", ... },
        approved: { ... },
        rejected: { ... },
    };
    const c = cfg[status.status] || cfg.pending;
    // ✅ Status page shows correctly
    
    // BUT: getVendorStatus() returns status.status value
    // If vendor accidentally visits while pending, shows message but no way back
}
```

**Impact:**
- Vendor stuck on status page during pending review
- No "Go Home" button or navigation
- Cannot browse products or check orders

**Fix:** Add navigation buttons for all statuses

---

## ISSUE #4: UH Product Detail - Missing Availability Check on Purchase
**Status:** MEDIUM 🟡  
**File:** `client/src/pages/UHProductDetail.jsx` (Line 150+)

### Problem:
```javascript
const inCart = product ? isInUHCart(product._id) : false;
// ✅ Checks if in cart

// ❌ BUT: No availability check before adding to cart
const handleAdd = useCallback(() => {
    if (!product) return;
    addItem({ ...product, productType: "urbexon_hour" });
    // Should check: if (!product.inStock) return;
}, [product, addItem]);
```

**Impact:**
- Users can add out-of-stock items to cart
- Checkout will fail
- Poor UX

---

## ISSUE #5: Cart - Out of Stock Items Not Disabled
**Status:** MEDIUM 🟡  
**File:** `client/src/pages/UHCart.jsx` (Line ~110+)

### Problem:
```javascript
// UHCart shows product but doesn't check if still available
// Frontend assumes if it's in cart, it's available
// But vendor could have marked product as OOS after user added it
```

**Impact:**
- Users proceed to checkout with unavailable items
- Checkout fails at final step (bad UX)
- Should show "Item no longer available" warning

---

## ISSUE #6: Vendor Profile - Email Update Not Allowed
**Status:** LOW 🟢  
**File:** `backend/controllers/vendor/venderProfile.js`

### Problem:
```javascript
// Vendor can edit almost everything BUT:
// Email should be read-only (tied to user account)
// Phone should be read-only (tied to delivery system)
// But currently allows any update
```

**Impact:**
- Vendor can change email
- User account email stays same
- Account access issues

---

## ISSUE #7: UH Flash Deals - Missing Cache Invalidation
**Status:** LOW 🟢  
**File:** `backend/controllers/productController.js` (Line 370+)

### Problem:
```javascript
export const getUHFlashDeals = async (req, res) => {
    const cacheKey = "uh_flash_deals";
    // Cache for 5 mins
    // BUT: If deal ends, product still shows as deal for 5 mins
    // Cache not invalidated when deal.dealEndsAt passes
};
```

**Impact:**
- Stale deals displayed to users
- Shows deal price for expired deals
- 5 minute lag before correction

---

## QUICK SUMMARY

| # | Issue | Severity | Component | Fix Time |
|---|-------|----------|-----------|----------|
| 1 | UH Products missing inStock field | 🔴 CRITICAL | Backend | 5 min |
| 2 | Vendor phone validation missing | 🟡 MEDIUM | Frontend | 10 min |
| 3 | Vendor pending status navigation | 🟡 MEDIUM | Frontend | 10 min |
| 4 | UH Detail - allow OOS purchase | 🟡 MEDIUM | Frontend | 5 min |
| 5 | UH Cart - show OOS warning | 🟡 MEDIUM | Frontend | 10 min |
| 6 | Vendor can change email | 🟢 LOW | Backend | 5 min |
| 7 | Flash deals cache staleness | 🟢 LOW | Backend | 10 min |

**Total Fix Time: ~55 minutes** ⏱️

