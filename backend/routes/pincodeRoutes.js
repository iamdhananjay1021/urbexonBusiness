import express from 'express';
import { checkPincode, joinWaitlist } from '../controllers/admin/pincodeManager.js';

const router = express.Router();

// Public routes for pincode checking and waitlist
router.get('/check/:code', checkPincode);
router.post('/waitlist', joinWaitlist);

export default router;