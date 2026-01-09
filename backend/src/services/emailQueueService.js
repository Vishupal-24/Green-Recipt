/**
 * Email Queue Service
 * 
 * Production-grade background email processing system.
 * 
 * WHY THIS DESIGN:
 * 1. NON-BLOCKING: Emails are queued and sent in background
 * 2. IDEMPOTENT: Each email has unique idempotency key to prevent duplicates
 * 3. RETRY LOGIC: Failed emails are retried with exponential backoff
 * 4. GRACEFUL: Handles SendGrid downtime without losing emails
 * 5. BATCHED: Processes emails in batches for efficiency
 * 6. AUDITED: Full logging of every send attempt
 * 
 * ARCHITECTURE:
 * - Emails are queued to MongoDB (EmailLog collection)
 * - Background worker polls queue every 10 seconds
 * - Worker processes batch, updates status, handles retries
 * - TTL index auto-cleans old logs after 90 days
 */

import sgMail from "@sendgrid/mail";
import EmailLog from "../models/EmailLog.js";

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  BATCH_SIZE: 20,           // Process this many emails per cycle
  POLL_INTERVAL: 10000,     // Check queue every 10 seconds
  MAX_RETRIES: 3,           // Max retry attempts per email
  ENABLED: true,            // Master switch for queue processing
};

// Initialize SendGrid
let isInitialized = false;

const initializeSendGrid = () => {
  if (isInitialized) return true;
  
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[EmailQueue] ⚠️ SENDGRID_API_KEY not configured");
    return false;
  }
  
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  isInitialized = true;
  return true;
};

// ===========================================
// EMAIL TEMPLATES
// ===========================================

const EMAIL_TEMPLATES = {
  otp_verification: {
    getSubject: () => "Verify your GreenReceipt account 🔐",
    getHtml: ({ otp, expiryMinutes = 10 }) => generateOtpEmailHtml(otp, "verify", expiryMinutes),
  },
  otp_password_reset: {
    getSubject: () => "Reset your GreenReceipt password 🔑",
    getHtml: ({ otp, expiryMinutes = 10 }) => generateOtpEmailHtml(otp, "reset", expiryMinutes),
  },
  bill_reminder: {
    getSubject: ({ billName, daysUntilDue }) => {
      if (daysUntilDue === 0) return `⏰ ${billName} is due today!`;
      if (daysUntilDue === 1) return `📅 ${billName} is due tomorrow`;
      return `📅 ${billName} due in ${daysUntilDue} days`;
    },
    getHtml: (data) => generateBillReminderHtml(data),
  },
  bill_due_today: {
    getSubject: ({ billName }) => `⏰ ${billName} is due today!`,
    getHtml: (data) => generateBillReminderHtml({ ...data, daysUntilDue: 0 }),
  },
  welcome: {
    getSubject: () => "Welcome to GreenReceipt! 🌱",
    getHtml: ({ name }) => generateWelcomeHtml(name),
  },
  password_changed: {
    getSubject: () => "Your GreenReceipt password was changed 🔒",
    getHtml: ({ name }) => generatePasswordChangedHtml(name),
  },
};

// ===========================================
// QUEUE OPERATIONS
// ===========================================

/**
 * Queue an email for background sending
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.emailType - Type of email (from EMAIL_TEMPLATES)
 * @param {Object} options.data - Template data
 * @param {string} [options.idempotencyKey] - Unique key to prevent duplicates
 * @param {number} [options.priority] - 1-10, lower is higher priority
 * @param {string} [options.userId] - User ID for tracking
 * @returns {Promise<{queued: boolean, emailLog?: Document}>}
 */
export const queueEmail = async ({
  to,
  emailType,
  data = {},
  idempotencyKey = null,
  priority = 5,
  userId = null,
  sourceType = "api",
  metadata = {},
}) => {
  try {
    // Get template configuration
    const template = EMAIL_TEMPLATES[emailType];
    if (!template) {
      console.error(`[EmailQueue] Unknown email type: ${emailType}`);
      return { queued: false, error: "UNKNOWN_EMAIL_TYPE" };
    }

    // Generate subject and HTML
    const subject = template.getSubject(data);
    const htmlContent = template.getHtml(data);

    // Queue the email
    const result = await EmailLog.queueEmail({
      userId,
      recipientEmail: to,
      recipientName: data.name || null,
      emailType,
      subject,
      htmlContent,
      templateData: data,
      idempotencyKey,
      priority,
      sourceType,
      metadata,
    });

    if (result.duplicate) {
      console.log(`[EmailQueue] ⚠️ Duplicate prevented: ${idempotencyKey}`);
      return { queued: false, duplicate: true, existing: result.existing };
    }

    console.log(`[EmailQueue] ✅ Queued ${emailType} to ${to}`);
    return { queued: true, emailLog: result.log };
  } catch (error) {
    console.error(`[EmailQueue] ❌ Queue error:`, error.message);
    return { queued: false, error: error.message };
  }
};

/**
 * Send an email immediately (bypasses queue)
 * Used for critical emails that must be sent synchronously
 * 
 * @param {Object} options
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
export const sendEmailNow = async ({ to, subject, html, emailType = "system" }) => {
  if (!initializeSendGrid()) {
    console.log(`[EmailQueue] SendGrid not configured, skipping email to: ${to}`);
    return { sent: false, error: "SENDGRID_NOT_CONFIGURED" };
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!fromEmail) {
    console.error("[EmailQueue] SENDGRID_FROM_EMAIL not configured");
    return { sent: false, error: "FROM_EMAIL_NOT_CONFIGURED" };
  }

  try {
    const [response] = await sgMail.send({
      to,
      from: { email: fromEmail, name: "GreenReceipt" },
      subject,
      html,
    });

    console.log(`[EmailQueue] ✅ Sent ${emailType} to ${to}`);
    return { 
      sent: true, 
      messageId: response.headers?.["x-message-id"],
      statusCode: response.statusCode,
    };
  } catch (error) {
    console.error(`[EmailQueue] ❌ Send failed to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
};

// ===========================================
// BACKGROUND WORKER
// ===========================================

let workerInterval = null;
let isProcessing = false;

/**
 * Process queued emails in batch
 * Called by the background worker
 */
export const processEmailQueue = async () => {
  if (!CONFIG.ENABLED || isProcessing) return;
  
  if (!initializeSendGrid()) {
    return { processed: 0, error: "SENDGRID_NOT_CONFIGURED" };
  }

  isProcessing = true;
  const startTime = Date.now();
  let sent = 0;
  let failed = 0;

  try {
    // Get batch of emails to process
    const emails = await EmailLog.getQueuedEmails(CONFIG.BATCH_SIZE);
    
    if (emails.length === 0) {
      isProcessing = false;
      return { processed: 0, sent: 0, failed: 0 };
    }

    console.log(`[EmailQueue] 📬 Processing ${emails.length} emails...`);

    for (const emailLog of emails) {
      try {
        // Mark as sending (lock)
        const locked = await EmailLog.markAsSending(emailLog._id);
        if (!locked) {
          // Already being processed by another worker
          continue;
        }

        // Send the email
        const fromEmail = process.env.SENDGRID_FROM_EMAIL;
        const [response] = await sgMail.send({
          to: emailLog.recipientEmail,
          from: { email: fromEmail, name: "GreenReceipt" },
          subject: emailLog.subject,
          html: emailLog.htmlContent,
        });

        // Mark as sent
        await EmailLog.markAsSent(emailLog._id, {
          messageId: response.headers?.["x-message-id"],
          statusCode: response.statusCode,
          headers: response.headers,
        });

        sent++;
        console.log(`[EmailQueue] ✅ Sent to ${emailLog.recipientEmail}`);
      } catch (error) {
        // Mark as failed (will retry if attempts < max)
        await EmailLog.markAsFailed(emailLog._id, error);
        failed++;
        console.error(`[EmailQueue] ❌ Failed ${emailLog.recipientEmail}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[EmailQueue] 📊 Batch complete: ${sent} sent, ${failed} failed (${duration}ms)`);
    
    return { processed: emails.length, sent, failed, duration };
  } catch (error) {
    console.error("[EmailQueue] 💥 Worker error:", error);
    return { processed: 0, error: error.message };
  } finally {
    isProcessing = false;
  }
};

/**
 * Start the background email worker
 */
export const startEmailWorker = () => {
  if (workerInterval) {
    console.log("[EmailQueue] Worker already running");
    return;
  }

  // Initial check after 5 seconds
  setTimeout(() => {
    processEmailQueue().catch(console.error);
  }, 5000);

  // Poll every 10 seconds
  workerInterval = setInterval(() => {
    processEmailQueue().catch(console.error);
  }, CONFIG.POLL_INTERVAL);

  console.log("[EmailQueue] 🚀 Email worker started (polls every 10s)");
};

/**
 * Stop the background email worker
 */
export const stopEmailWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[EmailQueue] Email worker stopped");
  }
};

/**
 * Get queue status for monitoring
 */
export const getQueueStatus = async () => {
  const [queued, sending, failed, sent24h] = await Promise.all([
    EmailLog.countDocuments({ status: "queued" }),
    EmailLog.countDocuments({ status: "sending" }),
    EmailLog.countDocuments({ 
      status: "failed", 
      attempts: { $lt: CONFIG.MAX_RETRIES },
    }),
    EmailLog.countDocuments({
      status: "sent",
      sentAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    queued,
    sending,
    pendingRetry: failed,
    sent24h,
    workerRunning: !!workerInterval,
    isProcessing,
  };
};

// ===========================================
// EMAIL HTML GENERATORS
// ===========================================

function generateOtpEmailHtml(otp, purpose, expiryMinutes = 10) {
  const config = purpose === "verify" 
    ? {
        heading: "Verify your email",
        description: "Use the verification code below to complete your GreenReceipt registration.",
        ctaText: "Enter this code to verify your email",
        headerColor: "#10b981",
        headerEmoji: "🔐",
      }
    : {
        heading: "Password Reset",
        description: "We received a request to reset your password. Use the code below to set a new password.",
        ctaText: "Enter this code to reset your password",
        headerColor: "#f59e0b",
        headerEmoji: "🔑",
      };

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, ${config.headerColor} 0%, ${adjustColor(config.headerColor, -20)} 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
          ${config.headerEmoji} GreenReceipt
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
          ${config.heading}
        </p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px; background: #ffffff;">
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
          ${config.description}
        </p>
        
        <!-- OTP Box -->
        <div style="background: #f8fafc; border: 2px dashed ${config.headerColor}; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
            Your verification code
          </p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: 'Courier New', monospace;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0 0;">
            Valid for ${expiryMinutes} minutes
          </p>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
          ${config.ctaText}
        </p>
        
        <!-- Security Notice -->
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin-top: 25px;">
          <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
            <strong>⚠️ Security tip:</strong> Never share this code with anyone. 
            GreenReceipt will never ask for this code via phone or chat.
          </p>
        </div>
        
        <p style="color: #94a3b8; font-size: 13px; margin: 25px 0 0 0; text-align: center;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} GreenReceipt. All rights reserved.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">
          Secure • Private • Paperless 🌿
        </p>
      </div>
    </div>
  `;
}

function generateBillReminderHtml({ billName, amount, currency, dueDate, daysUntilDue, category, notes }) {
  const dueDateFormatted = new Date(dueDate).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const amountText = amount 
    ? `${currency || "INR"} ${amount.toLocaleString("en-IN")}` 
    : "Variable amount";
  
  const urgencyColor = daysUntilDue === 0 ? "#ef4444" : daysUntilDue <= 2 ? "#f59e0b" : "#10b981";
  const urgencyText = daysUntilDue === 0 ? "Due Today!" : daysUntilDue === 1 ? "Due Tomorrow" : `Due in ${daysUntilDue} days`;
  const clientUrl = process.env.CLIENT_URL || "https://green-recipt.vercel.app";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
          🌱 GreenReceipt
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
          Bill Reminder
        </p>
      </div>
      
      <!-- Content -->
      <div style="padding: 40px 30px; background: #ffffff;">
        <!-- Urgency Badge -->
        <div style="text-align: center; margin-bottom: 30px;">
          <span style="display: inline-block; background: ${urgencyColor}; color: white; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 14px;">
            ⏰ ${urgencyText}
          </span>
        </div>
        
        <!-- Bill Details Card -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
          <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">
            ${billName}
          </h2>
          
          <div style="margin-bottom: 12px;">
            <span style="color: #64748b; display: inline-block; width: 100px;">Amount:</span>
            <span style="color: #1e293b; font-weight: 600;">${amountText}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="color: #64748b; display: inline-block; width: 100px;">Due Date:</span>
            <span style="color: #1e293b; font-weight: 600;">${dueDateFormatted}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="color: #64748b; display: inline-block; width: 100px;">Category:</span>
            <span style="color: #1e293b; font-weight: 600; text-transform: capitalize;">${(category || "other").replace("_", " ")}</span>
          </div>
          
          ${notes ? `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 13px;">Notes:</span>
              <p style="color: #475569; margin: 4px 0 0 0; font-size: 14px;">${notes}</p>
            </div>
          ` : ""}
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center;">
          <a href="${clientUrl}/customer/bills" 
             style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            View My Bills →
          </a>
        </div>
        
        <!-- Calm reminder -->
        <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 24px;">
          Stay on top of your bills with GreenReceipt. 
          <br/>We're here to help you stay organized!
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px;">
        <p style="color: #64748b; margin: 0; font-size: 13px;">
          You're receiving this because you have bill reminders enabled.
        </p>
        <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 12px;">
          <a href="${clientUrl}/customer/profile#notifications" style="color: #64748b;">Manage email preferences</a>
        </p>
        <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 12px;">
          © ${new Date().getFullYear()} GreenReceipt - Go Paperless
        </p>
      </div>
    </div>
  `;
}

function generateWelcomeHtml(name) {
  const clientUrl = process.env.CLIENT_URL || "https://green-recipt.vercel.app";
  
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
          🌱 GreenReceipt
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
          Your Digital Receipt Companion
        </p>
      </div>
      
      <!-- Content -->
      <div style="padding: 40px 30px; background: #ffffff;">
        <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">
          Welcome, ${name}! 👋
        </h2>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Your account has been created successfully. You're now part of the paperless revolution!
        </p>
        
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
          <h3 style="color: #166534; margin: 0 0 10px 0; font-size: 16px;">
            🧾 What you can do now:
          </h3>
          <ul style="color: #166534; margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>Scan QR codes to save receipts instantly</li>
            <li>Track all your purchases in one place</li>
            <li>Set up bill reminders to never miss a payment</li>
            <li>Get spending insights and analytics</li>
          </ul>
        </div>
        
        <!-- CTA -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${clientUrl}/customer/home" 
             style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Go to Dashboard →
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
          If you have any questions, just reply to this email. We're here to help!
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} GreenReceipt. All rights reserved.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">
          Secure • Private • Paperless 🌿
        </p>
      </div>
    </div>
  `;
}

function generatePasswordChangedHtml(name) {
  const clientUrl = process.env.CLIENT_URL || "https://green-recipt.vercel.app";
  const now = new Date();
  const timestamp = now.toLocaleString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
          🔒 GreenReceipt
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
          Security Alert
        </p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px; background: #ffffff;">
        ${name ? `<p style="color: #1e293b; font-size: 16px; margin: 0 0 15px 0;">Hi ${name},</p>` : ''}
        
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
          Your GreenReceipt password was successfully changed.
        </p>
        
        <!-- Info Box -->
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
          <p style="color: #166534; font-size: 14px; margin: 0; line-height: 1.6;">
            <strong>When:</strong> ${timestamp}
          </p>
        </div>
        
        <!-- Security Warning -->
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
            <strong>⚠️ Didn't make this change?</strong><br/>
            If you didn't change your password, your account may be compromised. 
            Please secure your account immediately by resetting your password.
          </p>
        </div>
        
        <!-- CTA -->
        <div style="text-align: center; margin: 25px 0;">
          <a href="${clientUrl}/forgot-password" 
             style="display: inline-block; background: #ef4444; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Secure My Account
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
          If you made this change, no action is needed. You can safely ignore this email.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          This is an automated security notification from GreenReceipt.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">
          © ${new Date().getFullYear()} GreenReceipt. All rights reserved.
        </p>
      </div>
    </div>
  `;
}

function adjustColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export default {
  queueEmail,
  sendEmailNow,
  processEmailQueue,
  startEmailWorker,
  stopEmailWorker,
  getQueueStatus,
};