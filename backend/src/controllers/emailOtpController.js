/**
 * Email OTP Controller
 * 
 * Handles all email OTP-related HTTP endpoints:
 * - POST /auth/email/send-otp      - Send OTP for email verification
 * - POST /auth/email/verify-otp    - Verify OTP code
 * - POST /auth/email/resend-otp    - Resend OTP (with cooldown)
 * 
 * WHY SEPARATE CONTROLLER:
 * 1. CLEAN ARCHITECTURE: OTP logic isolated from general auth
 * 2. SINGLE RESPONSIBILITY: Only handles OTP-related requests
 * 3. MAINTAINABLE: Easy to extend with new OTP features
 * 4. SECURE: Centralized security checks
 */

import User from "../models/User.js";
import Merchant from "../models/Merchant.js";
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  markEmailVerified,
  checkEmailExists,
  OTP_CONFIG,
} from "../services/otpService.js";
import { queueEmail } from "../services/emailQueueService.js";

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Extract client info from request for audit logging
 */
const getClientInfo = (req) => ({
  requestIp: req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
  userAgent: req.headers["user-agent"] || null,
});

/**
 * Generic error response (prevents information leakage)
 */
const genericError = (res, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message: "An error occurred. Please try again.",
    code: "INTERNAL_ERROR",
  });
};

// ===========================================
// SEND OTP ENDPOINT
// ===========================================

/**
 * POST /auth/email/send-otp
 * 
 * Send OTP to email for verification during signup.
 * This is called BEFORE account creation.
 * 
 * Request body:
 * - email: string (required)
 * - role: "customer" | "merchant" (optional, defaults to "customer")
 * 
 * Response:
 * - 200: OTP sent successfully
 * - 400: Email already registered
 * - 429: Too many requests (cooldown)
 * - 500: Internal error
 */
export const sendEmailOtp = async (req, res) => {
  try {
    const { email, role = "customer" } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const clientInfo = getClientInfo(req);

    // 1. Check if email is already registered and verified
    const { exists, role: existingRole } = await checkEmailExists(normalizedEmail);
    
    if (exists) {
      // Check if it's a verified account
      const Model = existingRole === "merchant" ? Merchant : User;
      const existingUser = await Model.findOne({ email: normalizedEmail });
      
      if (existingUser?.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "This email is already registered. Please login instead.",
          code: "EMAIL_EXISTS",
        });
      }
      // If exists but not verified, allow resending OTP
    }

    // 2. Send OTP
    const result = await sendOtp({
      email: normalizedEmail,
      purpose: OTP_CONFIG.PURPOSES.EMAIL_VERIFICATION,
      role,
      ...clientInfo,
    });

    if (!result.success) {
      const statusCode = result.error === "COOLDOWN" ? 429 : 
                         result.error === "HOURLY_LIMIT" ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        code: result.error,
        waitSeconds: result.waitSeconds,
      });
    }

    // 3. Success response
    res.json({
      success: true,
      message: result.message,
      email: normalizedEmail,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    console.error("[EmailOtpController] sendEmailOtp error:", error);
    genericError(res);
  }
};

// ===========================================
// VERIFY OTP ENDPOINT
// ===========================================

/**
 * POST /auth/email/verify-otp
 * 
 * Verify OTP code during signup flow.
 * On success, completes user registration.
 * 
 * Request body:
 * - email: string (required)
 * - otp: string (required, 6 digits)
 * - password: string (required, min 6 chars)
 * - role: "customer" | "merchant" (optional)
 * - name: string (required for customer)
 * - shopName: string (required for merchant)
 * 
 * Response:
 * - 200: Email verified, account created
 * - 400: Invalid/expired OTP
 * - 500: Internal error
 */
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp, password, role = "customer", name, shopName } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify the OTP
    const verifyResult = await verifyOtp({
      email: normalizedEmail,
      otp,
      purpose: OTP_CONFIG.PURPOSES.EMAIL_VERIFICATION,
    });

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
        code: verifyResult.error,
        remainingAttempts: verifyResult.remainingAttempts,
      });
    }

    // 2. OTP verified - now create or complete the user account
    const Model = role === "merchant" ? Merchant : User;
    
    // Check if pending account exists
    let user = await Model.findOne({ 
      email: normalizedEmail,
      isEmailVerified: false,
    });

    if (user) {
      // Complete the pending account
      if (role === "merchant") {
        user.shopName = shopName;
      } else {
        user.name = name;
      }
      user.password = password; // Will be hashed by pre-save hook
      user.isEmailVerified = true;
      user.isVerified = true;
      await user.save();
    } else {
      // Create new account (fresh signup)
      const userData = {
        email: normalizedEmail,
        password, // Will be hashed by pre-save hook
        isEmailVerified: true,
        isVerified: true,
      };

      if (role === "merchant") {
        userData.shopName = shopName;
        user = new Merchant(userData);
      } else {
        userData.name = name;
        user = new User(userData);
      }
      await user.save();
    }

    // 3. Send welcome email (non-blocking, via queue)
    queueEmail({
      to: normalizedEmail,
      emailType: "welcome",
      data: { name: role === "merchant" ? shopName : name },
      idempotencyKey: `welcome:${user._id}`,
      priority: 3,
      userId: user._id,
      sourceType: "api",
    }).catch((err) => {
      console.error("[EmailOtpController] Welcome email queue error:", err.message);
    });

    // 4. Success response
    res.status(201).json({
      success: true,
      message: "Email verified successfully! Your account has been created.",
      email: normalizedEmail,
      role,
      redirect: role === "merchant" ? "/merchant-login" : "/customer-login",
    });
  } catch (error) {
    console.error("[EmailOtpController] verifyEmailOtp error:", error);
    
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered. Please login instead.",
        code: "EMAIL_EXISTS",
      });
    }
    
    genericError(res);
  }
};

// ===========================================
// RESEND OTP ENDPOINT
// ===========================================

/**
 * POST /auth/email/resend-otp
 * 
 * Resend OTP with cooldown protection.
 * Invalidates any previous OTPs.
 * 
 * Request body:
 * - email: string (required)
 * - role: "customer" | "merchant" (optional)
 * - purpose: string (optional, defaults to email_verification)
 * 
 * Response:
 * - 200: New OTP sent
 * - 429: Cooldown active
 * - 500: Internal error
 */
export const resendEmailOtp = async (req, res) => {
  try {
    const { email, role = "customer", purpose = OTP_CONFIG.PURPOSES.EMAIL_VERIFICATION } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const clientInfo = getClientInfo(req);

    // Resend OTP (same logic as send, but explicitly for resend)
    const result = await resendOtp({
      email: normalizedEmail,
      purpose,
      role,
      ...clientInfo,
    });

    if (!result.success) {
      const statusCode = result.error === "COOLDOWN" ? 429 : 
                         result.error === "HOURLY_LIMIT" ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        code: result.error,
        waitSeconds: result.waitSeconds,
      });
    }

    res.json({
      success: true,
      message: "A new verification code has been sent to your email.",
      email: normalizedEmail,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    console.error("[EmailOtpController] resendEmailOtp error:", error);
    genericError(res);
  }
};

// ===========================================
// CHECK OTP STATUS ENDPOINT
// ===========================================

/**
 * GET /auth/email/otp-status
 * 
 * Check if there's an active OTP for an email.
 * Used by frontend to show timer/resend button.
 * 
 * Query params:
 * - email: string (required)
 * - purpose: string (optional)
 * 
 * Response:
 * - 200: Status info
 */
export const getOtpStatus = async (req, res) => {
  try {
    const { email, purpose = OTP_CONFIG.PURPOSES.EMAIL_VERIFICATION } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
        code: "EMAIL_REQUIRED",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Import EmailOtp model to check status
    const EmailOtp = (await import("../models/EmailOtp.js")).default;
    
    const activeOtp = await EmailOtp.findActiveOtp(normalizedEmail, purpose);
    
    if (!activeOtp) {
      return res.json({
        success: true,
        hasActiveOtp: false,
        canResend: true,
      });
    }

    // Calculate remaining time and resend eligibility
    const remainingSeconds = activeOtp.getRemainingSeconds();
    const { canSend, waitSeconds } = await EmailOtp.canRequestOtp(
      normalizedEmail,
      purpose,
      OTP_CONFIG.COOLDOWN_SECONDS
    );

    res.json({
      success: true,
      hasActiveOtp: true,
      expiresIn: remainingSeconds,
      canResend: canSend,
      resendWaitSeconds: waitSeconds,
      attemptsUsed: activeOtp.attempts,
      maxAttempts: activeOtp.maxAttempts,
    });
  } catch (error) {
    console.error("[EmailOtpController] getOtpStatus error:", error);
    genericError(res);
  }
};

// ===========================================
// PASSWORD RESET OTP ENDPOINTS
// ===========================================

/**
 * POST /auth/password/send-otp
 * 
 * Send OTP for password reset.
 * 
 * Request body:
 * - email: string (required)
 * - role: "customer" | "merchant" (optional)
 */
export const sendPasswordResetOtp = async (req, res) => {
  try {
    const { email, role = "customer" } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const clientInfo = getClientInfo(req);

    // 1. Check if email exists
    const { exists, role: existingRole } = await checkEmailExists(normalizedEmail);
    
    // Always return success to prevent email enumeration
    // But only actually send if email exists
    if (!exists) {
      // Fake success response (security best practice)
      return res.json({
        success: true,
        message: "If this email is registered, you will receive a password reset code.",
        expiresIn: OTP_CONFIG.EXPIRY_MINUTES * 60,
      });
    }

    // 2. Verify the role matches
    if (role !== existingRole) {
      // Fake success response
      return res.json({
        success: true,
        message: "If this email is registered, you will receive a password reset code.",
        expiresIn: OTP_CONFIG.EXPIRY_MINUTES * 60,
      });
    }

    // 3. Get user ID for tracking
    const Model = role === "merchant" ? Merchant : User;
    const user = await Model.findOne({ email: normalizedEmail });

    // 4. Send OTP
    const result = await sendOtp({
      email: normalizedEmail,
      purpose: OTP_CONFIG.PURPOSES.PASSWORD_RESET,
      userId: user?._id,
      role,
      ...clientInfo,
    });

    if (!result.success && result.error !== "COOLDOWN" && result.error !== "HOURLY_LIMIT") {
      // Internal errors - return generic success to prevent enumeration
      console.error("[EmailOtpController] Password reset OTP error:", result.error);
    }

    // Always return success-like response
    res.json({
      success: true,
      message: "If this email is registered, you will receive a password reset code.",
      expiresIn: OTP_CONFIG.EXPIRY_MINUTES * 60,
      // Only include cooldown info if applicable
      ...(result.error === "COOLDOWN" && { waitSeconds: result.waitSeconds }),
    });
  } catch (error) {
    console.error("[EmailOtpController] sendPasswordResetOtp error:", error);
    // Return success to prevent enumeration
    res.json({
      success: true,
      message: "If this email is registered, you will receive a password reset code.",
    });
  }
};

/**
 * POST /auth/password/verify-otp
 * 
 * Verify password reset OTP and get reset token.
 * 
 * Request body:
 * - email: string (required)
 * - otp: string (required)
 * - role: "customer" | "merchant" (optional)
 */
export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp, role = "customer" } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP
    const verifyResult = await verifyOtp({
      email: normalizedEmail,
      otp,
      purpose: OTP_CONFIG.PURPOSES.PASSWORD_RESET,
    });

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
        code: verifyResult.error,
        remainingAttempts: verifyResult.remainingAttempts,
      });
    }

    // Generate reset token for the password change step
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token
    const Model = role === "merchant" ? Merchant : User;
    await Model.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          resetPasswordOtp: resetToken,
          resetPasswordExpires: resetTokenExpiry,
        },
      }
    );

    res.json({
      success: true,
      message: "OTP verified. You can now reset your password.",
      resetToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    });
  } catch (error) {
    console.error("[EmailOtpController] verifyPasswordResetOtp error:", error);
    genericError(res);
  }
};

/**
 * POST /auth/password/reset
 * 
 * Reset password using the reset token.
 * 
 * Request body:
 * - email: string (required)
 * - resetToken: string (required)
 * - newPassword: string (required)
 * - role: "customer" | "merchant" (optional)
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword, role = "customer" } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const Model = role === "merchant" ? Merchant : User;
    
    // Find user with valid reset token
    const user = await Model.findOne({ email: normalizedEmail })
      .select("+resetPasswordOtp +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. Please try again.",
        code: "INVALID_REQUEST",
      });
    }

    // Validate reset token
    if (!user.resetPasswordOtp || user.resetPasswordOtp !== resetToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new one.",
        code: "INVALID_TOKEN",
      });
    }

    // Check token expiry
    if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: "Reset token has expired. Please request a new one.",
        code: "TOKEN_EXPIRED",
      });
    }

    // Update password and clear reset token
    user.password = newPassword; // Will be hashed by pre-save hook
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    
    // Invalidate all refresh tokens (force re-login everywhere)
    if (user.tokenVersion !== undefined) {
      user.tokenVersion += 1;
    }
    
    await user.save();

    // Queue password change notification email
    queueEmail({
      to: normalizedEmail,
      emailType: "password_changed",
      data: { name: role === "merchant" ? user.shopName : user.name },
      idempotencyKey: `password_changed:${user._id}:${Date.now()}`,
      priority: 2,
      userId: user._id,
      sourceType: "api",
    }).catch((err) => {
      console.error("[EmailOtpController] Password change email error:", err.message);
    });

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
      redirect: role === "merchant" ? "/merchant-login" : "/customer-login",
    });
  } catch (error) {
    console.error("[EmailOtpController] resetPassword error:", error);
    genericError(res);
  }
};

export default {
  sendEmailOtp,
  verifyEmailOtp,
  resendEmailOtp,
  getOtpStatus,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
};
