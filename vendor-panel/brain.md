# Vendor Panel — AI Context Brief

> Read this once instead of re-exploring the codebase. Update it whenever
> routes, auth gating, or the file map change materially — keep it accurate
> or it's worse than not having it.

## What this is
Vendor-facing React SPA for Urbexon Hour (quick-commerce) sellers to manage
their shop: apply, list products, fulfil orders, track earnings, subscribe,
configure payouts. Talks to the shared `backend/` Express API, scoped to
`/vendor/*` and `/auth/*` (`scope: "vendor"`) endpoints.

- **Stack**: React 19, React Router 6, plain `axios`, Vite. **No Redux, no
  Context-based state library beyond two hand-rolled contexts** (Auth,
  Notifications). No test suite.
- **Styling**: pure inline `style={{}}` objects everywhere (737+ blocks).
  **No Tailwind, no CSS framework, no design-token system** — unlike
  `client/` and `admin/` which both run the Signal design system. Don't
  assume Tailwind utility classes will do anything here; they won't.
  Global reset lives in `src/index.css` (box-sizing, font stack, 2 keyframes:
  `spin`, `fadeUp`). Page background `#f0f4ff`, sidebar `#0f0d2e`
  (dark indigo/purple), accent gradient `#7c3aed → #4f46e5`. Text grays
  follow Tailwind's default gray scale hex values (`#111827`, `#6b7280`,
  `#9ca3af`) even though Tailwind itself isn't installed — just borrowed
  hex values, applied inline.
- **No ESLint config** in this package (client/admin have one). Dead
  imports/files won't be caught automatically — see "Known dead code"
  below; re-run a manual audit periodically (`TODO.md` has the 2026-07-18
  audit log).
- Dev port: `5175`. Proxies `/api` → `http://localhost:9000` (see
  `vite.config.js`).

## Auth model (important — non-obvious gating)
`AuthContext` (`src/contexts/AuthContext.jsx`) holds `{ vendor, loading }`.
`vendor` can be in **three distinct states** that route guards
(`AppRoutes.jsx`) branch on:

1. **Not logged in** → `vendor === null`.
2. **Logged in, never applied** → `vendor` exists but has **no `.status`**
   field (a user can pick "vendor" role at signup without ever submitting
   the shop-application form; backend tolerates the resulting `/vendor/me`
   404 and returns a bare profile). Must be routed to `/apply`, NOT
   `/dashboard` (dashboard widgets all 404 without a real Vendor doc).
3. **Applied** → `vendor.status` is `"pending" | "approved" | "rejected" | "suspended"`.

Route guards in `AppRoutes.jsx`, each doing a different check —
**don't collapse these, they're intentionally different**:
- `PrivateRoute` — logged in AND has `.status` (i.e. actually applied).
- `ApprovedRoute` — logged in AND `status === "approved"`.
- `SubscriptionRoute` — approved AND has a currently-active subscription
  (`vendor.subscription.isActive && expiryDate > now`); else → `/subscription`.
- `ApplyRoute` — the inverse gate for `/apply` itself: if already applied
  (`vendor.status` truthy), bounce to `/dashboard`; otherwise let them in.
  Deliberately NOT `PublicRoute` (that would infinite-loop the never-applied
  case: `/apply` → `PublicRoute` sees no valid session→ redirect handling
  differs — see the inline comment in `AppRoutes.jsx` if touching this).
- `PublicRoute` — only for `/login`, `/forgot-password`: if any session
  exists at all, bounce to `/dashboard`.

## Route → Page → Backend map
| Route | Page | Guard | Key backend calls |
|---|---|---|---|
| `/login` | `Login.jsx` | Public | `POST /vendor/login` |
| `/apply` | `VendorApply.jsx` (843 lines, biggest file) | Apply | vendor application submit (multi-step) |
| `/forgot-password`, `/reset-password/:token` | `ForgotPassword.jsx`, `ResetPassword.jsx` | Public / open | `/auth/*` |
| `/verify-email` | `VerifyEmail.jsx` | open | email verify token |
| `/dashboard` | `Dashboard.jsx` | Private | stats, `PUT` isOpen toggle |
| `/subscription` | `Subscription.jsx` (642-line `Settings.jsx` neighbor, easy to confuse) | Approved | `GET /vendor/subscription`, plan change/cancel requests |
| `/products`, `/products/new`, `/products/:id/edit` | `products/ProductList.jsx`, `products/ProductForm.jsx` | Subscription | product CRUD. `ProductForm` renders **dynamic attribute fields from category metadata** (`GET /categories/:slug/metadata`) — same Product Discovery Engine the client/admin use; don't hardcode attribute inputs here. |
| `/orders`, `/orders/:id` | `Orders.jsx`, `OrderDetail.jsx` | Subscription | order list/detail, live rider tracking (`LiveTrackingMap.jsx` + `useLiveTracking.js`, Leaflet) |
| `/earnings` | `Earnings.jsx` | Subscription | payout/earnings summary |
| `/profile` | `Profile.jsx` (728 lines) | none extra | `GET/PUT /vendor/me` — shop name, description, category, **deliveryRadius, servicePincodes, isOpen** (GPS-tag pincode UI lives here) |
| `/settings` | `Settings.jsx` (642 lines — NOT the deleted `VendorSettings.jsx`) | none extra | subscription plan display + `PUT /auth/change-password`. Despite the name, does **not** touch shop/delivery config — that's `Profile.jsx`. |
| `/bank-details` | `BankDetails.jsx` | Approved | payout bank account |

`Settings.jsx` vs `Profile.jsx` naming is a trap: "settings" sounds like
where shop/delivery config would live, but it's actually subscription +
password. Shop config is in `Profile.jsx`.

## Notifications / realtime
`NotificationContext.jsx` opens **one WebSocket** (`${wsBase}/ws?token=...`)
shared for both the notification bell AND live order-tracking (`OrderDetail.jsx`
extends the same connection rather than opening a second one — see the
comment at the top of the ws-connect effect). Auto-reconnect with backoff,
pauses when tab is hidden (`document.hidden`). `Toast.jsx` is the popup
renderer for these.

## Known dead code (audited 2026-07-18, cleaned up — see TODO.md)
If you're about to add a "Settings" feature or an admin-vendor-list feature
here, know that this package has previously accumulated orphaned files with
**zero imports anywhere** (confirmed via grep, safe deletion, build still
passed). Don't be surprised if it happens again without a linter:
- A whole unrouted duplicate settings page (superseded by `Profile.jsx`
  going through a different endpoint than the backend route it called).
- A **backend** Express router file physically committed inside this
  frontend's `pages/` folder (`import express`, dangling `../../` relative
  imports that don't resolve from here) — always double-check `import`
  statements at the top of any unfamiliar file in `pages/`; it might not
  even be frontend code.
- A `utils/errorHandler.js` (`getErrorMessage`/`useApiCall`) nobody ever
  imported, and a `components/ui/` folder (`ErrorMessage`, `LoadingSpinner`)
  same story. Error display is actually handled ad-hoc per-page (each page
  owns its own error string state) plus `Toast.jsx` for realtime pushes —
  there's no shared error-boundary hook currently in active use besides
  `ErrorBoundary.jsx` (top-level, in `App.jsx`).

**Before adding a new shared util/component here**: grep for existing
similar-sounding names first (`ErrorMessage`, `errorHandler`, `Settings`
already had unused/duplicate siblings once).

## File-size hotspots (biggest files, where most logic concentrates)
`VendorApply.jsx` (843) > `Profile.jsx` (728) > `Settings.jsx` (642) >
`Orders.jsx` (536) > `Subscription.jsx` (488) > `Earnings.jsx` (457) >
`Dashboard.jsx` (415) > `VerifyEmail.jsx` (406) > `ProductForm.jsx` (337) >
`AuthContext.jsx` (328). These are single-file, no sub-component
extraction — expect long files when editing.
