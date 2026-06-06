# Vendor Subscription Flow Fix

## Issue
Vendors were able to start adding products and accepting orders immediately after admin approval, without completing any subscription payment ("payment to nhi kiya aur work karna chlu ho gya").

## Root Cause
When an admin approved a vendor application via the `approveVendor` API in `backend/controllers/admin/vendorApproval.js`, the system automatically created a **30-day Free Trial** subscription for the vendor on the `basic` plan, setting the subscription status to `"active"` and bypassing the payment requirement. 

Because `vendorMiddleware.js` uses `requireActiveSubscription` to protect routes (like `/products`, `/orders`, etc.), this free trial allowed the vendor full access without paying.

## Fix Implemented
1. **Removed the Auto-Free Trial:** Modified `backend/controllers/admin/vendorApproval.js` `approveVendor` function to no longer issue a 30-day free trial. 
2. **Default Inactive State:** Admin approval now explicitly creates a subscription in the `"inactive"` state.
3. **Payment Required:** With the subscription `isActive` being `false`, the frontend's `SubscriptionRoute` correctly blocks the vendor from accessing product or order management pages, forcing them to redirect to `/subscription` where they must select a plan and complete a Razorpay payment.
4. **Activation Flow Unchanged:** The `vendorSubscriptionPayment.js` securely handles Razorpay verification and will activate the subscription ONLY upon successful payment.

## Result
Vendors must now complete the Razorpay payment to activate their subscription and start selling on the platform.
