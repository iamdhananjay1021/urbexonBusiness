# Admin Category Management Guide

## Overview
Admin can manage categories for two marketplace sections:
- **E-Commerce (🛒)** - Regular product categories (Electronics, Fashion, etc.)
- **Urbexon Hour (⚡)** - Quick commerce categories (Dairy, Fruits, etc.)

## How to Access

1. Go to Admin Dashboard → **Categories** menu
2. You'll see three tabs:
   - 📋 **All** - Shows all categories (both types)
   - 🛒 **E-Commerce** - Only ecommerce categories
   - ⚡ **Urbexon Hour** - Only quick commerce categories

## Adding a Category

### For E-Commerce:
1. Click **Add Category** button
2. Fill in:
   - **Category Name** (e.g., "Electronics", "Fashion")
   - **Type**: Select **ecommerce** ✓
   - **Emoji**: Pick emoji icon (fallback if no image)
   - **Category Image** (optional - will override emoji)
   - **Brand Color** (primary color)
   - **Light Color** (background color)
   - **Active Status**: Toggle ON/OFF
   - **Order**: Display order (0 = first)
   - **Subcategories**: Add if needed
   - **Highlight Template**: Fields to show for products
3. Click **Submit**

### For Urbexon Hour:
1. Click **Add Category** button
2. Fill in same fields but:
   - **Type**: Select **urbexon_hour** ✓
   - Example: "Dairy", "Fruits", "Vegetables"

## Managing Categories

### Active/Inactive
- Click the **toggle icon** to activate/deactivate
- **Inactive categories won't appear** in vendor dropdowns or customer views

### Edit
- Click the **edit icon** to modify category details

### Delete
- Click the **trash icon** to permanently delete
- ⚠️ Cannot be undone

## Frontend Display

### Vendor Application (become-vendor)
- Shows only **active ecommerce categories** in dropdown
- Admin controls what vendors can select

### Client E-Commerce
- Shows only **active ecommerce categories**
- Nav menu, filters, etc.

### Urbexon Hour (Quick Commerce)
- Shows only **active urbexon_hour categories**
- Separate fast delivery section

## Category Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | String | ✓ | e.g., "Electronics" |
| Type | enum | ✓ | "ecommerce" or "urbexon_hour" |
| Emoji | String | | Used if no image (default: 🏷️) |
| Image | File | | JPG/PNG, max 5MB |
| Color | Hex | | Primary color (#1a1740) |
| LightColor | Hex | | Background color (#f0eefb) |
| isActive | Boolean | ✓ | Controls visibility |
| Order | Number | | Sort order (ascending) |
| Slug | String | Auto | Generated from name |

## API Endpoints (Protected - Admin Only)

```
GET    /api/categories/admin/all        - List all admin categories
POST   /api/categories                  - Create category
PUT    /api/categories/:slug            - Update category
DELETE /api/categories/:slug            - Delete category
```

## Important Notes

✅ **Only admin can create/edit/delete categories**
✅ **Only active categories visible to users**
✅ **Ecommerce & quick commerce kept separate**
✅ **Slug auto-generated from category name**
✅ **Changes take effect immediately** (cached for 60s)

## Testing

1. Add ecommerce category → Check vendor dropdown on /apply
2. Add urbexon_hour category → Check UH section
3. Deactivate category → Verify it disappears from dropdowns
4. Edit category → Check changes reflect in real-time
5. Delete category → Verify removal everywhere
