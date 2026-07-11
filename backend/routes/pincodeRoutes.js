import express from 'express';
import { checkPincode, joinWaitlist, resolveNearestPincode } from '../controllers/admin/pincodeManager.js';

const router = express.Router();

// Public routes for pincode checking and waitlist
router.get('/check/:code', checkPincode);
router.post('/waitlist', joinWaitlist);
router.get('/nearest', resolveNearestPincode);

export default router;