# Urbexon Hour Assignment Flow Fixes

## Issue
Urbexon Hour orders were not being instantly assigned to riders upon order creation. Rider assignment was delayed until the vendor marked the order as `READY_FOR_PICKUP`. Additionally, accepting an order forced its `orderStatus` to `READY_FOR_PICKUP` prematurely, and there were potential hardcoded values.

## Fixes Implemented

1. **Instant Assignment Trigger (orderKickoff.js):**
   - Modified `kickoffNewOrder` to instantly call `startAssignment(orderId)` immediately after order creation, provided the order is `URBEXON_HOUR` and not set to `VENDOR_SELF` delivery.

2. **Relaxed Assignment Pre-requisites (assignmentEngine.js):**
   - Modified `startAssignment` to accept orders in `PLACED`, `CONFIRMED`, `PACKED`, or `READY_FOR_PICKUP` states (no longer strict to just `READY_FOR_PICKUP`).

3. **Atomic Acceptance & Race Condition Prevention (assignmentEngine.js):**
   - Modified `handleRiderAccept`'s `findOneAndUpdate` query to look for `$in: ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP"]` alongside `delivery.assignedTo: null`.
   - **Crucial Fix:** Removed the hardcoded `$set: { orderStatus: "READY_FOR_PICKUP" }` from the atomic update block. The rider accepting the order now only updates the `delivery.status` to `RIDER_ASSIGNED` and populates rider details, leaving the `orderStatus` intact (so it can properly remain as `PLACED` / "Pending" until the vendor prepares it).
   - Because `findOneAndUpdate` is atomic, if two riders accept simultaneously, only the first transaction finds the document where `delivery.assignedTo: null`. The second transaction returns `null` and safely triggers the "Order already taken" fallback, explicitly preventing race conditions.

4. **Real-time Notifications:**
   - Modified the "order_status" WebSocket event sent to the user upon assignment to use `order.orderStatus` dynamically rather than hardcoding `"READY_FOR_PICKUP"`.

## Result
Urbexon Hour orders now follow a Zepto-style immediate broadcast upon placement (`PLACED` state), identifying nearby riders via 2dsphere geo-queries, preventing race conditions through atomic locking, and correctly isolating the delivery status from the preparation status.
