/**
 * Email Preference Routes
 * 
 * Routes for managing user email preferences:
 * - GET/PUT /api/user/email-preferences (authenticated)
 * - GET /api/email/unsubscribe (public, token-based)
 * - POST /api/email/resubscribe (public, token-based)
 */

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  getEmailPreferences,
  updateEmailPreferences,
  unsubscribeEmail,
  resubscribeEmail,
} from "../controllers/emailPreferenceController.js";
import {
  updateEmailPreferencesSchema,
  unsubscribeSchema,
} from "../validators/emailOtpSchemas.js";

const router = express.Router();

// ===========================================
// AUTHENTICATED ROUTES (require login)
// ===========================================

/**
 * GET /api/user/email-preferences
 * Get current email preferences
 */
router.get("/user/email-preferences", protect, getEmailPreferences);

/**
 * PUT /api/user/email-preferences
 * Update email preferences
 */
router.put(
  "/user/email-preferences",
  protect,
  validate(updateEmailPreferencesSchema),
  updateEmailPreferences
);

// ===========================================
// PUBLIC ROUTES (token-based, no login required)
// ===========================================

/**
 * GET /api/email/unsubscribe
 * One-click unsubscribe via email link
 */
router.get(
  "/email/unsubscribe",
  validate(unsubscribeSchema),
  unsubscribeEmail
);

/**
 * POST /api/email/resubscribe
 * Re-enable emails after unsubscribe
 */
router.post("/email/resubscribe", resubscribeEmail);

export default router;
