import mongoose from "mongoose";

/**
 * EmailLog Schema - Email Delivery Audit Trail
 * 
 * WHY THIS MODEL:
 * 1. AUDITABILITY: Track every email sent for compliance and debugging
 * 2. RETRY LOGIC: Track failed emails for retry processing
 * 3. ANALYTICS: Understand email delivery rates and issues
 * 4. IDEMPOTENCY: Prevent duplicate emails using idempotencyKey
 * 5. DEBUGGING: Quick lookup of email history per user
 * 
 * DELIVERY STATUSES:
 * - queued: Email is waiting to be sent
 * - sending: Currently being processed
 * - sent: Successfully sent to SendGrid
 * - delivered: SendGrid confirmed delivery (via webhook)
 * - failed: Send attempt failed
 * - bounced: Email bounced (via webhook)
 * - blocked: Suppressed due to unsubscribe/spam
 */

const emailLogSchema = new mongoose.Schema(
  {
    // Recipient information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    recipientName: {
      type: String,
      trim: true,
      default: null,
    },

    // Email content
    emailType: {
      type: String,
      enum: [
        "otp_verification",      // Email verification OTP
        "otp_password_reset",    // Password reset OTP
        "welcome",               // Welcome email
        "bill_reminder",         // Bill due reminder
        "bill_due_today",        // Bill due today alert
        "bill_overdue",          // Bill overdue alert
        "password_changed",      // Password change confirmation
        "account_deleted",       // Account deletion confirmation
        "security_alert",        // Suspicious activity alert
        "marketing",             // Promotional (opt-in only)
        "system",                // System notifications
      ],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // Template ID for SendGrid dynamic templates (preferred)
    templateId: {
      type: String,
      default: null,
    },
    // Dynamic data for template
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Raw HTML fallback (used when no template)
    htmlContent: {
      type: String,
      default: null,
      select: false, // Don't load by default (can be large)
    },

    // Delivery tracking
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "delivered", "failed", "bounced", "blocked"],
      default: "queued",
      index: true,
    },
    
    // SendGrid response data
    sendGridMessageId: {
      type: String,
      default: null,
      index: true,
    },
    sendGridResponse: {
      statusCode: Number,
      headers: mongoose.Schema.Types.Mixed,
      body: mongoose.Schema.Types.Mixed,
    },

    // Error tracking
    errorMessage: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
    errorStack: {
      type: String,
      default: null,
      select: false,
    },

    // Retry logic
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },

    // Timestamps
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },

    // Idempotency (prevent duplicate sends)
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true, // Allow nulls
      index: true,
    },

    // Source tracking
    sourceType: {
      type: String,
      enum: ["api", "scheduler", "webhook", "manual", "system"],
      default: "api",
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Priority (for queue ordering)
    priority: {
      type: Number,
      default: 5, // 1 = highest, 10 = lowest
      min: 1,
      max: 10,
      index: true,
    },

    // Metadata
    metadata: {
      billId: mongoose.Schema.Types.ObjectId,
      billName: String,
      dueDate: Date,
      amount: Number,
      otpPurpose: String,
      requestIp: String,
      userAgent: String,
    },
  },
  {
    timestamps: true,
  }
);

// ===========================================
// INDEXES
// ===========================================

// Queue processing index
emailLogSchema.index({ status: 1, priority: 1, queuedAt: 1 });

// Retry processing index
emailLogSchema.index({ status: 1, nextRetryAt: 1 });

// User email history
emailLogSchema.index({ userId: 1, createdAt: -1 });

// Email type analytics
emailLogSchema.index({ emailType: 1, status: 1, createdAt: -1 });

// TTL index - auto-delete old logs after 90 days
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Queue an email for sending
 * @param {Object} emailData 
 * @returns {Promise<Document>}
 */
emailLogSchema.statics.queueEmail = async function (emailData) {
  const {
    userId = null,
    recipientEmail,
    recipientName = null,
    emailType,
    subject,
    templateId = null,
    templateData = {},
    htmlContent = null,
    idempotencyKey = null,
    priority = 5,
    sourceType = "api",
    sourceId = null,
    metadata = {},
  } = emailData;

  // Check for duplicate using idempotency key
  if (idempotencyKey) {
    const existing = await this.findOne({ idempotencyKey });
    if (existing) {
      console.log(`[EmailLog] Duplicate email prevented: ${idempotencyKey}`);
      return { duplicate: true, existing };
    }
  }

  const log = await this.create({
    userId,
    recipientEmail: recipientEmail.toLowerCase(),
    recipientName,
    emailType,
    subject,
    templateId,
    templateData,
    htmlContent,
    idempotencyKey,
    priority,
    sourceType,
    sourceId,
    metadata,
    status: "queued",
    queuedAt: new Date(),
  });

  return { duplicate: false, log };
};

/**
 * Get next batch of emails to send
 * @param {number} batchSize 
 * @returns {Promise<Document[]>}
 */
emailLogSchema.statics.getQueuedEmails = async function (batchSize = 10) {
  const now = new Date();
  
  return this.find({
    $or: [
      { status: "queued" },
      { 
        status: "failed", 
        attempts: { $lt: 3 },
        nextRetryAt: { $lte: now },
      },
    ],
  })
    .select("+htmlContent")
    .sort({ priority: 1, queuedAt: 1 })
    .limit(batchSize);
};

/**
 * Mark email as sending (lock for processing)
 * @param {string} emailId 
 * @returns {Promise<Document|null>}
 */
emailLogSchema.statics.markAsSending = async function (emailId) {
  return this.findOneAndUpdate(
    { _id: emailId, status: { $in: ["queued", "failed"] } },
    { 
      $set: { 
        status: "sending", 
        lastAttemptAt: new Date(),
      },
      $inc: { attempts: 1 },
    },
    { new: true }
  );
};

/**
 * Mark email as sent successfully
 * @param {string} emailId 
 * @param {Object} sendGridResponse 
 * @returns {Promise<Document>}
 */
emailLogSchema.statics.markAsSent = async function (emailId, sendGridResponse = {}) {
  return this.findByIdAndUpdate(
    emailId,
    {
      $set: {
        status: "sent",
        sentAt: new Date(),
        sendGridMessageId: sendGridResponse.messageId || null,
        sendGridResponse: {
          statusCode: sendGridResponse.statusCode,
          headers: sendGridResponse.headers,
        },
        errorMessage: null,
        errorCode: null,
      },
    },
    { new: true }
  );
};

/**
 * Mark email as failed with retry scheduling
 * @param {string} emailId 
 * @param {Error} error 
 * @returns {Promise<Document>}
 */
emailLogSchema.statics.markAsFailed = async function (emailId, error) {
  const log = await this.findById(emailId);
  if (!log) return null;

  const sendGridResponse = error?.response
    ? {
        statusCode: error?.code || error?.response?.statusCode,
        headers: error?.response?.headers,
        body: error?.response?.body,
      }
    : undefined;

  // Calculate next retry with exponential backoff
  // Retry delays: 1min, 5min, 15min
  const retryDelays = [1, 5, 15];
  const nextRetryMinutes = retryDelays[log.attempts - 1] || 15;
  const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000);

  const isFinalAttempt = log.attempts >= log.maxAttempts;

  return this.findByIdAndUpdate(
    emailId,
    {
      $set: {
        status: "failed",
        failedAt: new Date(),
        errorMessage: error.message,
        errorCode: error.code || error.response?.body?.errors?.[0]?.message,
        errorStack: error.stack,
        ...(sendGridResponse ? { sendGridResponse } : {}),
        nextRetryAt: isFinalAttempt ? null : nextRetryAt,
      },
    },
    { new: true }
  );
};

/**
 * Get email delivery stats for a time period
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Object>}
 */
emailLogSchema.statics.getDeliveryStats = async function (startDate, endDate) {
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const byType = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { type: "$emailType", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  return { byStatus: stats, byTypeAndStatus: byType };
};

/**
 * Check if email was recently sent (spam prevention)
 * @param {string} email 
 * @param {string} emailType 
 * @param {number} windowMinutes 
 * @returns {Promise<boolean>}
 */
emailLogSchema.statics.wasRecentlySent = async function (email, emailType, windowMinutes = 5) {
  const recent = await this.findOne({
    recipientEmail: email.toLowerCase(),
    emailType,
    status: { $in: ["queued", "sending", "sent", "delivered"] },
    createdAt: { $gt: new Date(Date.now() - windowMinutes * 60 * 1000) },
  });
  return !!recent;
};

const EmailLog = mongoose.model("EmailLog", emailLogSchema);

export default EmailLog;
