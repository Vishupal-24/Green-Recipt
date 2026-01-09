/**
 * Email OTP Routes
 * 
 * Dedicated routes for email verification and password reset via OTP.
 * Separate from main auth routes for cleaner organization.
 * 
 * ROUTES:
 * - POST /api/auth/email/send-otp       - Send OTP for email verification
 * - POST /api/auth/email/verify-otp     - Verify OTP and complete signup
 * - POST /api/auth/email/resend-otp     - Resend OTP (with cooldown)
 * - GET  /api/auth/email/otp-status     - Check OTP status
 * - POST /api/auth/password/send-otp    - Send password reset OTP
 * - POST /api/auth/password/verify-otp  - Verify password reset OTP
 * - POST /api/auth/password/reset       - Reset password with token
 * 
 * SECURITY:
 * - Rate limited (5 requests per minute for OTP operations)
 * - Input validation via Zod schemas
 * - Generic error messages to prevent enumeration
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import {
  sendEmailOtp,
  verifyEmailOtp,
  resendEmailOtp,
  getOtpStatus,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from "../controllers/emailOtpController.js";
import {
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
  otpStatusSchema,
  sendPasswordResetOtpSchema,
  verifyPasswordResetOtpSchema,
  resetPasswordWithTokenSchema,
} from "../validators/emailOtpSchemas.js";

const router = express.Router();

// ===========================================
// RATE LIMITERS
// ===========================================

/**
 * Strict rate limiter for OTP sending operations
 * Prevents abuse and email spam
 */
const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 3, // 3 requests per minute
  message: {
    success: false,
    message: "Too many requests. Please wait before trying again.",
    code: "RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination
    const email = req.body?.email?.toLowerCase() || "";
    return `${req.ip}-${email}`;
  },
});

/**
 * Moderate rate limiter for OTP verification
 * Prevents brute force but allows reasonable retry
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 attempts per minute
  message: {
    success: false,
    message: "Too many verification attempts. Please wait.",
    code: "RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase() || "";
    return `verify-${req.ip}-${email}`;
  },
});

/**
 * Rate limiter for status checks (less strict)
 */
const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many requests.",
    code: "RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===========================================
// EMAIL VERIFICATION ROUTES
// ===========================================

/**
 * POST /api/auth/email/send-otp
 * Send OTP to email for verification during signup
 * 
 * Body: { email: string, role?: "customer" | "merchant" }
 * Response: { success: true, message, email, expiresIn }
 */
router.post(
  "/email/send-otp",
  otpSendLimiter,
  validate(sendEmailOtpSchema),
  sendEmailOtp
);

/**
 * POST /api/auth/email/verify-otp
 * Verify OTP and complete account creation
 * 
 * Body: {
 *   email: string,
 *   otp: string (6 digits),
 *   password: string,
 *   role?: "customer" | "merchant",
 *   name?: string (for customer),
 *   shopName?: string (for merchant)
 * }
 * Response: { success: true, message, email, role, redirect }
 */
router.post(
  "/email/verify-otp",
  otpVerifyLimiter,
  validate(verifyEmailOtpSchema),
  verifyEmailOtp
);

/**
 * POST /api/auth/email/resend-otp
 * Resend OTP with cooldown protection
 * 
 * Body: { email: string, role?: "customer" | "merchant", purpose?: string }
 * Response: { success: true, message, email, expiresIn }
 */
router.post(
  "/email/resend-otp",
  otpSendLimiter,
  validate(resendEmailOtpSchema),
  resendEmailOtp
);

/**
 * GET /api/auth/email/otp-status
 * Check if there's an active OTP (for frontend UI)
 * 
 * Query: { email: string, purpose?: string }
 * Response: { success, hasActiveOtp, expiresIn, canResend, attemptsUsed, maxAttempts }
 */
router.get(
  "/email/otp-status",
  statusLimiter,
  validate(otpStatusSchema),
  getOtpStatus
);

// ===========================================
// PASSWORD RESET ROUTES
// ===========================================

/**
 * POST /api/auth/password/send-otp
 * Send OTP for password reset
 * 
 * Body: { email: string, role?: "customer" | "merchant" }
 * Response: { success: true, message, expiresIn }
 * 
 * Note: Always returns success to prevent email enumeration
 */
router.post(
  "/password/send-otp",
  otpSendLimiter,
  validate(sendPasswordResetOtpSchema),
  sendPasswordResetOtp
);

/**
 * POST /api/auth/password/verify-otp
 * Verify password reset OTP and get reset token
 * 
 * Body: { email: string, otp: string, role?: "customer" | "merchant" }
 * Response: { success: true, message, resetToken, expiresIn }
 */
router.post(
  "/password/verify-otp",
  otpVerifyLimiter,
  validate(verifyPasswordResetOtpSchema),
  verifyPasswordResetOtp
);

/**
 * POST /api/auth/password/reset
 * Reset password using the reset token
 * 
 * Body: {
 *   email: string,
 *   resetToken: string,
 *   newPassword: string,
 *   role?: "customer" | "merchant"
 * }
 * Response: { success: true, message, redirect }
 */
router.post(
  "/password/reset",
  otpVerifyLimiter,
  validate(resetPasswordWithTokenSchema),
  resetPassword
);

export default router;
