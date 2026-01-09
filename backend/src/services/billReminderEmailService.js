/**
 * Bill Reminder Email Service
 * 
 * Smart email reminder system that:
 * - Respects user email preferences
 * - Supports daily digest mode (batch reminders)
 * - Prevents duplicate emails
 * - Handles timezone differences
 * - Gracefully handles failures
 * 
 * WHY SEPARATE FROM reminderScheduler.js:
 * - reminderScheduler handles in-app notifications
 * - This service handles EMAIL notifications specifically
 * - Different batching and preference logic for emails
 * - Cleaner separation of concerns
 */

import RecurringBill from "../models/RecurringBill.js";
import User from "../models/User.js";
import EmailLog from "../models/EmailLog.js";
import { queueEmail } from "./emailQueueService.js";

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  // Batch size for processing
  BATCH_SIZE: 50,
  // Daily digest time (in user's timezone)
  DIGEST_HOUR: 8, // 8 AM
  // Important reminders (for "important_only" preference)
  IMPORTANT_OFFSETS: [0, 1], // Due today, due tomorrow
};

// ===========================================
// SMART REMINDER LOGIC
// ===========================================

/**
 * Determine if an email reminder should be sent based on user preferences
 * 
 * @param {Document} user - User document with preferences
 * @param {Document} bill - RecurringBill document
 * @param {number} offset - Days until due (0 = due today)
 * @returns {boolean}
 */
const shouldSendEmailReminder = (user, bill, offset) => {
  // 1. Check if user has email enabled
  if (!user.emailPreferences?.enabled) {
    return false;
  }

  // 2. Check if bill reminders are enabled
  if (!user.emailPreferences?.billReminders) {
    return false;
  }

  // 3. Check frequency preference
  const frequency = user.emailPreferences?.reminderFrequency || "all";

  switch (frequency) {
    case "important_only":
      // Only send for due-today (0) and due-tomorrow (1)
      return CONFIG.IMPORTANT_OFFSETS.includes(offset);

    case "daily_digest":
      // Don't send individual emails - handled by digest job
      return false;

    case "all":
    default:
      // Send all reminders
      return true;
  }
};

/**
 * Generate idempotency key for email to prevent duplicates
 */
const generateEmailIdempotencyKey = (billId, dueDate, offset) => {
  const dueDateStr = dueDate.toISOString().split("T")[0];
  return `bill_reminder:${billId}:${dueDateStr}:${offset}`;
};

/**
 * Check if email was already sent for this reminder
 */
const wasEmailAlreadySent = async (idempotencyKey) => {
  const existing = await EmailLog.findOne({
    idempotencyKey,
    status: { $in: ["queued", "sending", "sent", "delivered"] },
  });
  return !!existing;
};

// ===========================================
// INDIVIDUAL REMINDER EMAILS
// ===========================================

/**
 * Process and send email for a single bill reminder
 * 
 * @param {Document} bill - RecurringBill with populated userId
 * @param {number} offset - Days until due
 * @param {Date} dueDate - Due date
 * @returns {Promise<{sent?: boolean, skipped?: boolean, reason?: string}>}
 */
export const sendBillReminderEmail = async (bill, offset, dueDate) => {
  const user = bill.userId;
  
  // Skip if user not populated or no email
  if (!user || !user.email) {
    return { skipped: true, reason: "NO_USER_EMAIL" };
  }

  // Check user preferences
  if (!shouldSendEmailReminder(user, bill, offset)) {
    return { skipped: true, reason: "USER_PREFERENCE" };
  }

  // Generate idempotency key
  const idempotencyKey = generateEmailIdempotencyKey(bill._id, dueDate, offset);

  // Check for duplicate
  const alreadySent = await wasEmailAlreadySent(idempotencyKey);
  if (alreadySent) {
    return { skipped: true, reason: "ALREADY_SENT" };
  }

  // Queue the email
  const result = await queueEmail({
    to: user.email,
    emailType: offset === 0 ? "bill_due_today" : "bill_reminder",
    data: {
      name: user.name,
      billName: bill.name,
      amount: bill.amount,
      currency: bill.currency || "INR",
      dueDate,
      daysUntilDue: offset,
      category: bill.category,
      notes: bill.notes,
    },
    idempotencyKey,
    priority: offset === 0 ? 2 : offset <= 2 ? 4 : 6, // Higher priority for urgent
    userId: user._id,
    sourceType: "scheduler",
    sourceId: bill._id,
    metadata: {
      billId: bill._id,
      billName: bill.name,
      dueDate,
      amount: bill.amount,
    },
  });

  if (result.duplicate) {
    return { skipped: true, reason: "DUPLICATE_QUEUED" };
  }

  if (result.queued) {
    console.log(`[BillEmailService] 📧 Queued email: ${bill.name} (${offset} days) → ${user.email}`);
    return { sent: true };
  }

  return { skipped: true, reason: result.error || "QUEUE_FAILED" };
};

// ===========================================
// DAILY DIGEST EMAILS
// ===========================================

/**
 * Generate and send daily digest email for a user
 * Combines all upcoming bill reminders into one email
 * 
 * @param {string} userId - User ID
 * @returns {Promise<{sent?: boolean, count?: number, error?: string}>}
 */
export const sendDailyDigestEmail = async (userId) => {
  try {
    // Get user with preferences
    const user = await User.findById(userId);
    if (!user) {
      return { error: "USER_NOT_FOUND" };
    }

    // Check preferences
    if (!user.emailPreferences?.enabled || !user.emailPreferences?.billReminders) {
      return { skipped: true, reason: "USER_PREFERENCE" };
    }

    if (user.emailPreferences?.reminderFrequency !== "daily_digest") {
      return { skipped: true, reason: "NOT_DIGEST_MODE" };
    }

    // Get user's active bills
    const now = new Date();
    const bills = await RecurringBill.find({
      userId,
      status: "active",
    });

    if (bills.length === 0) {
      return { skipped: true, reason: "NO_BILLS" };
    }

    // Collect reminders for today's digest
    const reminders = [];
    
    for (const bill of bills) {
      // Skip if marked as paid
      if (bill.markedPaidUntil && new Date(bill.markedPaidUntil) > now) {
        continue;
      }

      // Calculate next due date
      const nextDueDate = bill.calculateNextDueDate(now);
      const daysUntilDue = Math.ceil((nextDueDate - now) / (1000 * 60 * 60 * 24));

      // Include if due within 7 days
      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        reminders.push({
          billName: bill.name,
          amount: bill.amount,
          currency: bill.currency || "INR",
          dueDate: nextDueDate,
          daysUntilDue,
          category: bill.category,
        });
      }
    }

    if (reminders.length === 0) {
      return { skipped: true, reason: "NO_UPCOMING_BILLS" };
    }

    // Sort by due date
    reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // Generate idempotency key (one digest per user per day)
    const today = now.toISOString().split("T")[0];
    const idempotencyKey = `daily_digest:${userId}:${today}`;

    // Check for duplicate
    const alreadySent = await wasEmailAlreadySent(idempotencyKey);
    if (alreadySent) {
      return { skipped: true, reason: "ALREADY_SENT" };
    }

    // Queue digest email
    const result = await queueEmail({
      to: user.email,
      emailType: "bill_reminder", // Use existing template, customize in HTML
      data: {
        name: user.name,
        isDigest: true,
        reminders,
        totalBills: reminders.length,
        dueTodayCount: reminders.filter(r => r.daysUntilDue === 0).length,
      },
      idempotencyKey,
      priority: 3,
      userId: user._id,
      sourceType: "scheduler",
      metadata: {
        isDigest: true,
        billCount: reminders.length,
      },
    });

    if (result.queued) {
      console.log(`[BillEmailService] 📧 Queued digest: ${reminders.length} bills → ${user.email}`);
      return { sent: true, count: reminders.length };
    }

    return { error: result.error || "QUEUE_FAILED" };
  } catch (error) {
    console.error("[BillEmailService] Digest error:", error);
    return { error: error.message };
  }
};

// ===========================================
// BATCH PROCESSING
// ===========================================

/**
 * Process all pending bill reminder emails
 * Called by the scheduler
 * 
 * @returns {Promise<{processed: number, sent: number, skipped: number, errors: number}>}
 */
export const processBillReminderEmails = async () => {
  console.log("[BillEmailService] 📬 Processing bill reminder emails...");
  const startTime = Date.now();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Get all active bills with user preferences
    const bills = await RecurringBill.find({ status: "active" })
      .populate({
        path: "userId",
        select: "email name emailPreferences timezone",
      })
      .limit(CONFIG.BATCH_SIZE);

    const now = new Date();

    for (const bill of bills) {
      try {
        // Skip if user not populated
        if (!bill.userId) continue;

        // Skip if marked as paid
        if (bill.markedPaidUntil && new Date(bill.markedPaidUntil) > now) {
          continue;
        }

        // Skip if past end date
        if (bill.endDate && new Date(bill.endDate) < now) {
          continue;
        }

        // Calculate next due date
        const nextDueDate = bill.calculateNextDueDate(now);

        // Check each reminder offset
        for (const offset of bill.reminderOffsets) {
          // Calculate reminder date
          const reminderDate = new Date(nextDueDate);
          reminderDate.setDate(reminderDate.getDate() - offset);

          // Should trigger today?
          const reminderDateStr = reminderDate.toISOString().split("T")[0];
          const nowStr = now.toISOString().split("T")[0];

          if (nowStr !== reminderDateStr) {
            continue; // Not today
          }

          processed++;

          // Send email reminder
          const result = await sendBillReminderEmail(bill, offset, nextDueDate);

          if (result.sent) {
            sent++;
          } else if (result.skipped) {
            skipped++;
          } else {
            errors++;
          }
        }
      } catch (billError) {
        console.error(`[BillEmailService] Bill ${bill._id} error:`, billError.message);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[BillEmailService] ✅ Complete in ${duration}ms - Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);

    return { processed, sent, skipped, errors, duration };
  } catch (error) {
    console.error("[BillEmailService] Fatal error:", error);
    throw error;
  }
};

/**
 * Process daily digest emails for all users with digest preference
 * Should be called once per day (e.g., 8 AM server time)
 * 
 * @returns {Promise<{processed: number, sent: number, skipped: number, errors: number}>}
 */
export const processDigestEmails = async () => {
  console.log("[BillEmailService] 📧 Processing daily digest emails...");
  const startTime = Date.now();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Find users who want digest emails
    const users = await User.find({
      "emailPreferences.enabled": true,
      "emailPreferences.billReminders": true,
      "emailPreferences.reminderFrequency": "daily_digest",
    }).select("_id");

    for (const user of users) {
      processed++;

      try {
        const result = await sendDailyDigestEmail(user._id);

        if (result.sent) {
          sent++;
        } else if (result.skipped) {
          skipped++;
        } else {
          errors++;
        }
      } catch (userError) {
        console.error(`[BillEmailService] Digest for ${user._id} error:`, userError.message);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[BillEmailService] ✅ Digest complete in ${duration}ms - Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);

    return { processed, sent, skipped, errors, duration };
  } catch (error) {
    console.error("[BillEmailService] Digest fatal error:", error);
    throw error;
  }
};

// ===========================================
// SCHEDULER INTEGRATION
// ===========================================

let emailReminderInterval = null;
let digestInterval = null;

/**
 * Start the email reminder scheduler
 * Runs every hour for individual reminders
 * Runs once daily for digest emails
 */
export const startEmailReminderScheduler = () => {
  // Process individual reminders every hour
  const REMINDER_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  // Initial run after 10 seconds
  setTimeout(() => {
    processBillReminderEmails().catch(console.error);
  }, 10000);

  emailReminderInterval = setInterval(() => {
    processBillReminderEmails().catch(console.error);
  }, REMINDER_INTERVAL);

  // Process digests once per day at 8 AM server time
  // For production, use a proper cron library (node-cron)
  const DIGEST_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  
  // Check if it's around 8 AM to run digest
  const checkAndRunDigest = () => {
    const now = new Date();
    if (now.getHours() === CONFIG.DIGEST_HOUR) {
      processDigestEmails().catch(console.error);
    }
  };

  // Check every hour if it's digest time
  digestInterval = setInterval(checkAndRunDigest, 60 * 60 * 1000);

  console.log("[BillEmailService] 🚀 Email reminder scheduler started");
};

/**
 * Stop the email reminder scheduler
 */
export const stopEmailReminderScheduler = () => {
  if (emailReminderInterval) {
    clearInterval(emailReminderInterval);
    emailReminderInterval = null;
  }
  if (digestInterval) {
    clearInterval(digestInterval);
    digestInterval = null;
  }
  console.log("[BillEmailService] Scheduler stopped");
};

export default {
  sendBillReminderEmail,
  sendDailyDigestEmail,
  processBillReminderEmails,
  processDigestEmails,
  startEmailReminderScheduler,
  stopEmailReminderScheduler,
};
