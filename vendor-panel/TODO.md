# Vendor Panel — TODO

## ✅ Fixed
- [x] Floating-cart-style popup / highlighted UI hidden behind bottom nav
      (was actually in `client`, not here — see client's UrbexonHour.jsx
      floating cart fix, resolved via a shared `--bottom-nav-h` CSS var).

## ✅ Dead code audit (2026-07-18) — cleaned up
No linter is configured in this package (no eslint config), so unused
files/imports accumulate silently. Full audit done manually; see
`brain.md` § "Known dead code" for the reasoning. Deleted:

- `src/pages/VendorSettings.jsx` — orphaned page (not in any route).
  Its feature (delivery radius, service pincodes, open/closed) is fully
  live in `Profile.jsx` via `PUT /vendor/me`, just through a different
  endpoint than the one this page called (`PUT /vendor/settings`).
- `src/pages/adminVendorRoutes.js` — a **backend** Express router
  (`import express`, `../../middlewares/...`) mistakenly committed inside
  the frontend's `pages/` folder. Never imported; wouldn't even have
  resolved its relative imports if something had tried.
- `src/utils/errorHandler.js` — unused `getErrorMessage`/`useApiCall`
  helpers, zero imports anywhere. (Whole `utils/` folder removed since
  this was its only file.)
- `src/components/ui/ErrorMessage.jsx`, `src/components/ui/LoadingSpinner.jsx`
  — zero imports anywhere. Whole `components/ui/` folder removed.
- Unused imports: `useEffect` in `Toast.jsx`, `useRef` in
  `products/ProductList.jsx`.
- Stray `console.log` in `NotificationContext.jsx` (WS connect log).

**Backend note (not fixed, out of scope for this package):**
`backend/routes/VendorRoutes/vendorSettingsRoutes.js` exposes
`GET/PUT /api/vendor/settings` (shopName/deliveryRadius/servicePincodes/
isOpen/lat-lng) — this looks like the intended backend for the now-deleted
`VendorSettings.jsx`. Nothing in the frontend calls it anymore; `Profile.jsx`
covers the same fields through `PUT /vendor/me` instead. Worth deciding
whether to delete the backend route or keep it as a documented duplicate
API surface — flagging here so it isn't a surprise later.

## Open items
- No test suite exists for this package (manual QA only).
- No ESLint config — consider adding one (client/admin both have one)
  so dead imports/vars get caught automatically instead of via periodic
  manual audits like this one.




