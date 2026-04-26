hai  # Urbexon Hour Category Fix — TODO

## Issue
Navbar mein UH category click karne se `/urbexon-hour/category/:slug` jaata hai, lekin:
1. Route `AppRoutes.jsx` mein defined nahi hai → 404/NotFound
2. `UrbexonHour.jsx` URL slug se category pre-select nahi karta

## Steps
- [x] 1. Add route `/urbexon-hour/category/:slug` in `AppRoutes.jsx`
- [x] 2. Add `useParams()` in `UrbexonHour.jsx` to read slug and auto-set activeCategory
- [x] 3. Verify category name/slug matching logic

## Result
All 3 steps completed successfully. Category routing from Navbar now works correctly.

