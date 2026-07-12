# DELIVERY PARTNER API ROUTES - COMPLETE SPECIFICATION

## DELIVERY PANEL ROUTES

### Authentication
```
POST   /delivery/register              - Register delivery partner
POST   /delivery/login                 - Login delivery partner
POST   /delivery/logout                - Logout delivery partner
POST   /delivery/refresh-token         - Refresh access token
POST   /delivery/forgot-password       - Request password reset
POST   /delivery/reset-password        - Reset password with token
```

### Application & Registration
```
GET    /delivery/application           - Get current application status
POST   /delivery/application           - Create new application
PUT    /delivery/application/personal  - Update personal details
PUT    /delivery/application/identity  - Update identity details
PUT    /delivery/application/address   - Update address details
PUT    /delivery/application/vehicle   - Update vehicle details
PUT    /delivery/application/bank      - Update bank details
PUT    /delivery/application/preferences - Update work preferences
POST   /delivery/application/submit    - Submit application for review
POST   /delivery/application/documents/:docType - Upload document
GET    /delivery/application/documents - List uploaded documents
```

### Profile Management
```
GET    /delivery/profile               - Get delivery partner profile
PUT    /delivery/profile               - Update profile
PUT    /delivery/profile/photo         - Upload profile photo
GET    /delivery/profile/documents     - Get all documents
POST   /delivery/profile/vehicle       - Add/update vehicle
POST   /delivery/profile/bank          - Add/update bank details
```

### Orders
```
GET    /delivery/orders/available      - Get available orders nearby
GET    /delivery/orders/active         - Get active orders assigned to me
GET    /delivery/orders/history        - Get completed/cancelled orders
GET    /delivery/orders/:orderId       - Get order details
PATCH  /delivery/orders/:orderId/accept - Accept order
PATCH  /delivery/orders/:orderId/reject - Reject order
PATCH  /delivery/orders/:orderId/pickup - Mark as picked up
PATCH  /delivery/orders/:orderId/status - Update delivery status
PATCH  /delivery/orders/:orderId/deliver - Mark as delivered with OTP
PATCH  /delivery/orders/:orderId/cancel - Cancel assigned order
```

### Location & GPS
```
PATCH  /delivery/location              - Update current GPS location
GET    /delivery/location/history      - Get location history
POST   /delivery/location/zone-entry   - Log zone entry
POST   /delivery/location/zone-exit    - Log zone exit
```

### Wallet & Earnings
```
GET    /delivery/wallet                - Get wallet balance and status
GET    /delivery/earnings/today        - Get today's earnings
GET    /delivery/earnings/week         - Get weekly earnings
GET    /delivery/earnings/month        - Get monthly earnings
GET    /delivery/earnings/history      - Get earnings history
GET    /delivery/settlements           - Get settlement history
GET    /delivery/settlements/:id       - Get settlement details
POST   /delivery/withdrawals           - Request withdrawal
GET    /delivery/withdrawals           - Get withdrawal history
GET    /delivery/withdrawals/:id       - Get withdrawal status
POST   /delivery/withdrawals/:id/cancel - Cancel withdrawal request
```

### KYC & Verification
```
GET    /delivery/kyc/status            - Get KYC verification status
POST   /delivery/kyc/aadhaar           - Submit Aadhaar for verification
POST   /delivery/kyc/pan               - Submit PAN for verification
POST   /delivery/kyc/selfie            - Submit selfie for face verification
GET    /delivery/kyc/documents         - List all KYC documents
POST   /delivery/kyc/resubmit/:doc     - Resubmit rejected document
```

### Notifications
```
GET    /delivery/notifications         - Get notification history
GET    /delivery/notifications/unread  - Get unread notifications
PUT    /delivery/notifications/:id/read - Mark notification as read
DELETE /delivery/notifications/:id     - Delete notification
PUT    /delivery/notifications/preferences - Update notification preferences
```

### Settings
```
GET    /delivery/settings              - Get account settings
PUT    /delivery/settings              - Update settings
GET    /delivery/devices               - Get linked devices
POST   /delivery/devices               - Register new device
DELETE /delivery/devices/:id           - Unlink device
POST   /delivery/permissions/request   - Request app permissions
POST   /delivery/permissions/grant     - Grant app permissions
```

---

## ADMIN PANEL ROUTES

### Delivery Partners Management
```
GET    /admin/delivery                 - List all delivery partners
GET    /admin/delivery/search          - Search delivery partners
GET    /admin/delivery/:id             - Get delivery partner details
PUT    /admin/delivery/:id             - Update delivery partner info
PATCH  /admin/delivery/:id/status      - Change delivery partner status
PATCH  /admin/delivery/:id/block       - Block delivery partner
PATCH  /admin/delivery/:id/suspend     - Suspend delivery partner
DELETE /admin/delivery/:id             - Delete delivery partner
POST   /admin/delivery/:id/force-logout - Force logout delivery partner
GET    /admin/delivery/:id/metrics     - Get delivery partner metrics
GET    /admin/delivery/:id/orders      - Get delivery partner orders
GET    /admin/delivery/:id/earnings    - Get delivery partner earnings
GET    /admin/delivery/:id/wallet      - Get delivery partner wallet
```

### Application Queue Management
```
GET    /admin/applications             - List all applications
GET    /admin/applications/pending     - Get pending applications
GET    /admin/applications/under-review - Get applications under review
GET    /admin/applications/:id         - Get application details
PUT    /admin/applications/:id         - Update application
POST   /admin/applications/:id/approve - Approve application
POST   /admin/applications/:id/reject  - Reject application
POST   /admin/applications/:id/review  - Start manual review
POST   /admin/applications/bulk/approve - Bulk approve applications
POST   /admin/applications/bulk/reject - Bulk reject applications
GET    /admin/applications/exports/csv - Export applications to CSV
```

### KYC Verification
```
GET    /admin/kyc                      - List all KYC records
GET    /admin/kyc/:id                  - Get KYC details
PUT    /admin/kyc/:id/aadhaar          - Verify Aadhaar
PUT    /admin/kyc/:id/pan              - Verify PAN
PUT    /admin/kyc/:id/driving-license  - Verify driving license
PUT    /admin/kyc/:id/vehicle-rc       - Verify vehicle RC
PUT    /admin/kyc/:id/face             - Verify face match
PUT    /admin/kyc/:id/background       - Update background check
PATCH  /admin/kyc/:id/approve          - Approve KYC
PATCH  /admin/kyc/:id/reject           - Reject KYC
POST   /admin/kyc/:id/request-resubmit - Request document resubmission
```

### Wallet & Settlement Management
```
GET    /admin/wallet                   - List all wallet records
GET    /admin/wallet/:id               - Get wallet details
PUT    /admin/wallet/:id/balance       - Adjust wallet balance
POST   /admin/wallet/:id/hold          - Place hold on amount
POST   /admin/wallet/:id/release       - Release hold
GET    /admin/settlements              - List all settlements
GET    /admin/settlements/:id          - Get settlement details
PATCH  /admin/settlements/:id/approve  - Approve settlement
PATCH  /admin/settlements/:id/process  - Initiate payout
POST   /admin/withdrawals              - List all withdrawals
PATCH  /admin/withdrawals/:id/approve  - Approve withdrawal
PATCH  /admin/withdrawals/:id/reject   - Reject withdrawal
POST   /admin/disputes/:id/resolve     - Resolve wallet dispute
```

### Zone Management
```
GET    /admin/zones                    - List all delivery zones
POST   /admin/zones                    - Create new delivery zone
GET    /admin/zones/:id                - Get zone details
PUT    /admin/zones/:id                - Update zone
DELETE /admin/zones/:id                - Delete zone
POST   /admin/zones/:id/assign-partner - Assign delivery partner to zone
DELETE /admin/zones/:id/assign-partner/:partnerId - Remove from zone
GET    /admin/zones/:id/coverage       - Get zone coverage map
PUT    /admin/zones/:id/coverage       - Update zone coverage
GET    /admin/zones/:id/metrics        - Get zone performance metrics
```

### Live Tracking
```
GET    /admin/tracking/live            - Get all online delivery partners (real-time)
GET    /admin/tracking/:id             - Get delivery partner live location
GET    /admin/tracking/:id/history     - Get location history
POST   /admin/tracking/:id/start       - Start tracking delivery partner
POST   /admin/tracking/:id/stop        - Stop tracking delivery partner
GET    /admin/tracking/orders/:id      - Get order tracking details
```

### Performance & Analytics
```
GET    /admin/metrics/dashboard        - Get overall metrics dashboard
GET    /admin/metrics/partners         - Get delivery partner performance
GET    /admin/metrics/earnings         - Get earnings analytics
GET    /admin/metrics/orders           - Get order analytics
GET    /admin/metrics/zones            - Get zone performance
GET    /admin/metrics/ratings          - Get ratings analytics
GET    /admin/metrics/export           - Export metrics report
```

### Bulk Operations
```
POST   /admin/bulk/block               - Block multiple delivery partners
POST   /admin/bulk/unblock             - Unblock multiple delivery partners
POST   /admin/bulk/suspend             - Suspend multiple delivery partners
POST   /admin/bulk/approve             - Approve multiple applications
POST   /admin/bulk/reject              - Reject multiple applications
POST   /admin/bulk/force-logout        - Force logout multiple partners
POST   /admin/bulk/assign-zone         - Assign multiple partners to zone
POST   /admin/bulk/update-settings     - Update settings for multiple partners
```

---

## INTERNAL/SYSTEM ROUTES

### Location Engine
```
POST   /internal/location/validate     - Validate GPS coordinates
POST   /internal/location/accuracy     - Check GPS accuracy
POST   /internal/location/zone-check   - Check if in delivery zone
POST   /internal/location/geofence     - Geofence enforcement
```

### Wallet Engine
```
POST   /internal/wallet/credit         - Credit earnings to wallet
POST   /internal/wallet/debit          - Debit from wallet
POST   /internal/wallet/hold           - Place hold (dispute/refund)
POST   /internal/wallet/release        - Release hold
POST   /internal/wallet/settle         - Process settlement
```

### Assignment Engine
```
POST   /internal/assignment/find-nearby - Find nearby available riders
POST   /internal/assignment/assign      - Assign order to rider
POST   /internal/assignment/reassign    - Reassign on rejection/cancellation
GET    /internal/assignment/status      - Get assignment status
```

### Notification Engine
```
POST   /internal/notify/delivery       - Send delivery notification
POST   /internal/notify/wallet         - Send wallet notification
POST   /internal/notify/kyc            - Send KYC notification
POST   /internal/notify/settlement     - Send settlement notification
```

---

## REQUEST/RESPONSE FORMATS

### Common Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
X-Device-ID: <device-id>
X-App-Version: <version>
X-Client-Version: <client-version>
```

### Pagination
```
GET /delivery/earnings/history?page=1&limit=20&sort=-date
```

### Filters
```
GET /admin/delivery?status=approved&city=Lucknow&rating=4.5+
GET /admin/applications?status=under-review&createdAt[gte]=2024-01-01
```

### Response Format
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## ERROR RESPONSES

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Not authorized for this resource
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Duplicate or conflicting resource
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Server error

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Week 1-2): Core APIs
- Authentication & Registration
- Profile Management
- Application submission

### Phase 2 (Week 2-3): Operations
- Orders (available, active, accept, pickup, deliver)
- Location updates
- Status changes

### Phase 3 (Week 3-4): Earnings & Wallet
- Wallet APIs
- Earnings tracking
- Withdrawal management

### Phase 4 (Week 4-5): Admin & Management
- Delivery partner management
- Application queue
- KYC verification

### Phase 5 (Week 5-6): Analytics & Tracking
- Performance metrics
- Live tracking
- Advanced reporting

---

**Total API Endpoints**: ~120+
**Implementation Time**: 4-6 weeks
**Testing Time**: 2-3 weeks
**Deployment Time**: 1-2 weeks
