import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * EmailOtp Schema - Dedicated OTP Storage
 * 
 * WHY SEPARATE TABLE:
 * 1. SECURITY: OTPs are isolated from user data, preventing accidental exposure
 * 2. CLEANUP: Easy to purge expired OTPs without touching user collection
 * 3. AUDIT: Complete history of OTP requests for security analysis
 * 4. SCALABILITY: Can shard OTP collection independently
 * 
 * SECURITY MEASURES:
 * - OTP is ALWAYS hashed with bcrypt (never stored in plaintext)
 * - Attempts counter prevents brute force
 * - `used` flag ensures one-time use
 * - Auto-expiry with TTL index
 * - Rate limiting tracked via createdAt
 */

const emailOtpSchema = new mongoose.Schema(
  {
    // User reference (optional for pre-signup verification)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    // Email address (for pre-signup where userId doesn't exist yet)
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Hashed OTP using bcrypt (NEVER store plaintext)
    hashedOtp: {
      type: String,
      required: true,
    },
    // OTP purpose for multi-use system
    purpose: {
      type: String,
      enum: [
        "email_verification",   // New user email verification
        "password_reset",       // Forgot password flow
        "login_verification",   // 2FA login (future)
        "email_change",         // Changing email address (future)
      ],
      required: true,
      index: true,
    },
    // Expiry timestamp (TTL index will auto-delete)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Failed verification attempts (brute force protection)
    attempts: {
      type: Number,
      default: 0,
      max: 10, // Hard cap for safety
    },
    // Max allowed attempts before lockout
    maxAttempts: {
      type: Number,
      default: 5,
    },
    // One-time use flag
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    // When OTP was used (for audit)
    usedAt: {
      type: Date,
      default: null,
    },
    // IP address of requester (for audit/abuse detection)
    requestIp: {
      type: String,
      default: null,
    },
    // User agent (for audit)
    userAgent: {
      type: String,
      default: null,
    },
    // Session tracking for multi-device scenarios
    sessionId: {
      type: String,
      default: null,
    },
    // Metadata for additional context
    metadata: {
      role: {
        type: String,
        enum: ["customer", "merchant"],
        default: "customer",
      },
      deviceInfo: String,
      country: String,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ===========================================
// INDEXES
// ===========================================

// Compound index for finding active OTPs efficiently
emailOtpSchema.index({ email: 1, purpose: 1, used: 0, expiresAt: 1 });

// TTL index - auto-delete documents 24 hours after expiry (cleanup buffer)
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

// Rate limiting index - find recent OTPs for an email
emailOtpSchema.index({ email: 1, createdAt: -1 });

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Create a new OTP record with hashed code
 * @param {Object} data - OTP creation data
 * @returns {Promise<{otpRecord: Document, plainOtp: string}>}
 */
emailOtpSchema.statics.createOtp = async function (data) {
  const {
    email,
    userId = null,
    purpose,
    expiryMinutes = 10,
    requestIp = null,
    userAgent = null,
    role = "customer",
    maxAttempts = 5,
  } = data;

  // Generate cryptographically secure 6-digit OTP
  const crypto = await import("crypto");
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  const plainOtp = String(100000 + (randomNumber % 900000));

  // Hash OTP with bcrypt (cost factor 10 for balance of security and speed)
  const hashedOtp = await bcrypt.hash(plainOtp, 10);

  // Calculate expiry
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate any existing active OTPs for this email+purpose
  await this.updateMany(
    { email: email.toLowerCase(), purpose, used: false },
    { $set: { used: true, usedAt: new Date() } }
  );

  // Create new OTP record
  const otpRecord = await this.create({
    email: email.toLowerCase(),
    userId,
    hashedOtp,
    purpose,
    expiresAt,
    maxAttempts,
    requestIp,
    userAgent,
    metadata: { role },
  });

  return { otpRecord, plainOtp };
};

/**
 * Find active OTP for verification
 * @param {string} email 
 * @param {string} purpose 
 * @returns {Promise<Document|null>}
 */
emailOtpSchema.statics.findActiveOtp = async function (email, purpose) {
  return this.findOne({
    email: email.toLowerCase(),
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * Verify OTP with timing-safe comparison
 * @param {string} email 
 * @param {string} plainOtp 
 * @param {string} purpose 
 * @returns {Promise<{success: boolean, error?: string, otpRecord?: Document}>}
 */
emailOtpSchema.statics.verifyOtp = async function (email, plainOtp, purpose) {
  const otpRecord = await this.findActiveOtp(email, purpose);

  if (!otpRecord) {
    return {
      success: false,
      error: "NO_ACTIVE_OTP",
      message: "No active verification code found. Please request a new one.",
    };
  }

  // Check if locked out due to too many attempts
  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    return {
      success: false,
      error: "MAX_ATTEMPTS_EXCEEDED",
      message: "Too many failed attempts. Please request a new code.",
    };
  }

  // Increment attempts before verification (prevents timing attacks)
  otpRecord.attempts += 1;
  await otpRecord.save();

  // Verify OTP using bcrypt (timing-safe)
  const isValid = await bcrypt.compare(plainOtp, otpRecord.hashedOtp);

  if (!isValid) {
    const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
    return {
      success: false,
      error: "INVALID_OTP",
      message: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
      remainingAttempts,
    };
  }

  // Mark as used (one-time use)
  otpRecord.used = true;
  otpRecord.usedAt = new Date();
  await otpRecord.save();

  return { success: true, otpRecord };
};

/**
 * Check if user can request a new OTP (rate limiting)
 * @param {string} email 
 * @param {string} purpose 
 * @param {number} cooldownSeconds 
 * @returns {Promise<{canSend: boolean, waitSeconds?: number}>}
 */
emailOtpSchema.statics.canRequestOtp = async function (email, purpose, cooldownSeconds = 60) {
  const recentOtp = await this.findOne({
    email: email.toLowerCase(),
    purpose,
    createdAt: { $gt: new Date(Date.now() - cooldownSeconds * 1000) },
  }).sort({ createdAt: -1 });

  if (!recentOtp) {
    return { canSend: true };
  }

  const elapsed = Date.now() - new Date(recentOtp.createdAt).getTime();
  const waitSeconds = Math.ceil((cooldownSeconds * 1000 - elapsed) / 1000);

  return { canSend: false, waitSeconds };
};

/**
 * Count OTPs sent in a time window (for abuse detection)
 * @param {string} email 
 * @param {number} windowMinutes 
 * @returns {Promise<number>}
 */
emailOtpSchema.statics.countRecentOtps = async function (email, windowMinutes = 60) {
  return this.countDocuments({
    email: email.toLowerCase(),
    createdAt: { $gt: new Date(Date.now() - windowMinutes * 60 * 1000) },
  });
};

/**
 * Cleanup expired OTPs (for manual cleanup if TTL is slow)
 * @returns {Promise<number>} - Number of deleted records
 */
emailOtpSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

// ===========================================
// INSTANCE METHODS
// ===========================================

/**
 * Check if OTP is expired
 * @returns {boolean}
 */
emailOtpSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

/**
 * Check if OTP is locked out
 * @returns {boolean}
 */
emailOtpSchema.methods.isLockedOut = function () {
  return this.attempts >= this.maxAttempts;
};

/**
 * Get remaining time in seconds
 * @returns {number}
 */
emailOtpSchema.methods.getRemainingSeconds = function () {
  const remaining = this.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
};

const EmailOtp = mongoose.model("EmailOtp", emailOtpSchema);

export default EmailOtp;
