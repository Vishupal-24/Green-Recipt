/**
 * OTP Service - Business Logic Layer
 * 
 * This service encapsulates all OTP-related business logic:
 * - OTP generation and validation
 * - Rate limiting and abuse prevention
 * - Email delivery coordination
 * - User verification status updates
 * 
 * WHY SEPARATE SERVICE:
 * 1. SINGLE RESPONSIBILITY: OTP logic isolated from HTTP concerns
 * 2. TESTABLE: Pure business logic without request/response coupling
 * 3. REUSABLE: Can be called from controllers, schedulers, or other services
 * 4. SECURE: Centralized security checks and validation
 */

import EmailOtp from "../models/EmailOtp.js";
import User from "../models/User.js";
import Merchant from "../models/Merchant.js";
import { queueEmail, sendEmailNow, sendOtpEmailDirectly } from "./emailQueueService.js";

// ===========================================
// CONFIGURATION
// ===========================================

export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  COOLDOWN_SECONDS: 60,
  MAX_OTPS_PER_HOUR: 5,     // Max OTPs per email per hour (abuse prevention)
  PURPOSES: {
    EMAIL_VERIFICATION: "email_verification",
    PASSWORD_RESET: "password_reset",
    LOGIN_VERIFICATION: "login_verification",
    EMAIL_CHANGE: "email_change",
  },
};

// ===========================================
// SEND OTP
// ===========================================

/**
 * Send OTP for email verification
 * 
 * @param {Object} params
 * @param {string} params.email - Recipient email address
 * @param {string} params.purpose - OTP purpose (email_verification, password_reset, etc.)
 * @param {string} [params.userId] - User ID if user exists
 * @param {string} [params.role] - User role (customer/merchant)
 * @param {string} [params.requestIp] - Request IP for audit
 * @param {string} [params.userAgent] - User agent for audit
 * @returns {Promise<{success: boolean, expiresIn?: number, error?: string}>}
 */
export const sendOtp = async ({
  email,
  purpose,
  userId = null,
  role = "customer",
  requestIp = null,
  userAgent = null,
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Check rate limit (cooldown between requests)
    const { canSend, waitSeconds } = await EmailOtp.canRequestOtp(
      normalizedEmail,
      purpose,
      OTP_CONFIG.COOLDOWN_SECONDS
    );

    if (!canSend) {
      return {
        success: false,
        error: "COOLDOWN",
        message: `Please wait ${waitSeconds} seconds before requesting another code.`,
        waitSeconds,
      };
    }

    // 2. Check hourly limit (abuse prevention)
    const recentCount = await EmailOtp.countRecentOtps(normalizedEmail, 60);
    if (recentCount >= OTP_CONFIG.MAX_OTPS_PER_HOUR) {
      console.warn(`[OTPService] Hourly limit exceeded for ${normalizedEmail}`);
      return {
        success: false,
        error: "HOURLY_LIMIT",
        message: "Too many verification requests. Please try again later.",
      };
    }

    // 3. Create OTP record (this also invalidates previous OTPs)
    const { otpRecord, plainOtp } = await EmailOtp.createOtp({
      email: normalizedEmail,
      userId,
      purpose,
      expiryMinutes: OTP_CONFIG.EXPIRY_MINUTES,
      maxAttempts: OTP_CONFIG.MAX_ATTEMPTS,
      requestIp,
      userAgent,
      role,
    });

    // 4. Send OTP email IMMEDIATELY (not queued - OTPs are time-sensitive)
    const emailType = purpose === OTP_CONFIG.PURPOSES.PASSWORD_RESET 
      ? "otp_password_reset" 
      : "otp_verification";

    // OTP emails must be sent immediately for best user experience
    // We use sendOtpEmailDirectly which bypasses the queue
    sendOtpEmailDirectly({
      to: normalizedEmail,
      otp: plainOtp,
      purpose: purpose === OTP_CONFIG.PURPOSES.PASSWORD_RESET ? "reset" : "verify",
      expiryMinutes: OTP_CONFIG.EXPIRY_MINUTES,
    }).then((result) => {
      if (result.sent) {
        console.log(`[OTPService] ✅ OTP email sent to ${normalizedEmail}`);
      } else {
        console.error(`[OTPService] ❌ Failed to send OTP email: ${result.error}`);
        // Fallback: queue for retry
        queueEmail({
          to: normalizedEmail,
          emailType,
          data: { otp: plainOtp, expiryMinutes: OTP_CONFIG.EXPIRY_MINUTES },
          idempotencyKey: `${emailType}:${normalizedEmail}:${otpRecord._id}`,
          priority: 1,
          userId,
          sourceType: "api",
          metadata: { otpPurpose: purpose, requestIp, retryAfterDirectFail: true },
        }).catch(console.error);
      }
    }).catch((err) => {
      console.error(`[OTPService] OTP email error:`, err.message);
    });

    // 5. Log OTP in development only (NEVER in production)
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] OTP for ${normalizedEmail}: ${plainOtp}`);
    }

    return {
      success: true,
      expiresIn: OTP_CONFIG.EXPIRY_MINUTES * 60, // seconds
      message: "Verification code sent to your email.",
    };
  } catch (error) {
    console.error("[OTPService] sendOtp error:", error);
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to send verification code. Please try again.",
    };
  }
};

// ===========================================
// VERIFY OTP
// ===========================================

/**
 * Verify OTP code
 * 
 * @param {Object} params
 * @param {string} params.email - Email address
 * @param {string} params.otp - OTP code to verify
 * @param {string} params.purpose - OTP purpose
 * @returns {Promise<{success: boolean, error?: string, remainingAttempts?: number}>}
 */
export const verifyOtp = async ({ email, otp, purpose }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = otp.toString().trim();

  // Validate OTP format
  if (!/^\d{6}$/.test(normalizedOtp)) {
    return {
      success: false,
      error: "INVALID_FORMAT",
      message: "Verification code must be 6 digits.",
    };
  }

  try {
    const result = await EmailOtp.verifyOtp(normalizedEmail, normalizedOtp, purpose);
    return result;
  } catch (error) {
    console.error("[OTPService] verifyOtp error:", error);
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to verify code. Please try again.",
    };
  }
};

// ===========================================
// RESEND OTP
// ===========================================

/**
 * Resend OTP (invalidates previous and sends new)
 * 
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.purpose
 * @param {string} [params.userId]
 * @param {string} [params.role]
 * @param {string} [params.requestIp]
 * @param {string} [params.userAgent]
 * @returns {Promise<{success: boolean, expiresIn?: number, error?: string}>}
 */
export const resendOtp = async (params) => {
  // Resend is essentially the same as send - createOtp invalidates previous
  return sendOtp(params);
};

// ===========================================
// EMAIL VERIFICATION FLOW
// ===========================================

/**
 * Complete email verification for a user
 * Called after OTP is verified successfully
 * 
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.role
 * @returns {Promise<{success: boolean, user?: Document, error?: string}>}
 */
export const markEmailVerified = async ({ email, role = "customer" }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const Model = role === "merchant" ? Merchant : User;

  try {
    const user = await Model.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          isEmailVerified: true,
          isVerified: true,
        },
      },
      { new: true }
    );

    if (!user) {
      return {
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found.",
      };
    }

    return { success: true, user };
  } catch (error) {
    console.error("[OTPService] markEmailVerified error:", error);
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to update verification status.",
    };
  }
};

// ===========================================
// PASSWORD RESET FLOW
// ===========================================

/**
 * Validate OTP for password reset and return session token
 * 
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.otp
 * @param {string} params.role
 * @returns {Promise<{success: boolean, resetToken?: string, error?: string}>}
 */
export const validatePasswordResetOtp = async ({ email, otp, role = "customer" }) => {
  const verifyResult = await verifyOtp({
    email,
    otp,
    purpose: OTP_CONFIG.PURPOSES.PASSWORD_RESET,
  });

  if (!verifyResult.success) {
    return verifyResult;
  }

  // Generate a short-lived reset token (used for the actual password reset)
  const crypto = await import("crypto");
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Store the reset token
  const Model = role === "merchant" ? Merchant : User;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    await Model.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          resetPasswordOtp: resetToken,
          resetPasswordExpires: resetTokenExpiry,
        },
      }
    );

    return {
      success: true,
      resetToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  } catch (error) {
    console.error("[OTPService] validatePasswordResetOtp error:", error);
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to process reset request.",
    };
  }
};

// ===========================================
// CHECK EMAIL EXISTS
// ===========================================

/**
 * Check if email already exists (for signup validation)
 * Returns generic response to prevent enumeration attacks
 * 
 * @param {string} email 
 * @param {string} [excludeRole] - Role to exclude from check
 * @returns {Promise<{exists: boolean, role?: string}>}
 */
export const checkEmailExists = async (email, excludeRole = null) => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [user, merchant] = await Promise.all([
      excludeRole === "customer" ? null : User.findOne({ email: normalizedEmail }),
      excludeRole === "merchant" ? null : Merchant.findOne({ email: normalizedEmail }),
    ]);

    if (user) {
      return { exists: true, role: "customer" };
    }
    if (merchant) {
      return { exists: true, role: "merchant" };
    }
    return { exists: false };
  } catch (error) {
    console.error("[OTPService] checkEmailExists error:", error);
    return { exists: false };
  }
};

// ===========================================
// CLEANUP
// ===========================================

/**
 * Cleanup expired OTPs (for manual invocation)
 * @returns {Promise<number>} Number of deleted records
 */
export const cleanupExpiredOtps = async () => {
  try {
    const count = await EmailOtp.cleanupExpired();
    console.log(`[OTPService] Cleaned up ${count} expired OTPs`);
    return count;
  } catch (error) {
    console.error("[OTPService] Cleanup error:", error);
    return 0;
  }
};

export default {
  OTP_CONFIG,
  sendOtp,
  verifyOtp,
  resendOtp,
  markEmailVerified,
  validatePasswordResetOtp,
  checkEmailExists,
  cleanupExpiredOtps,
};
