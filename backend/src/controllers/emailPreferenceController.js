/**
 * Email Preference Controller
 * 
 * Manages user email notification preferences:
 * - Get current preferences
 * - Update preferences
 * - One-click unsubscribe via token
 * 
 * SECURITY:
 * - Requires authentication for preference updates
 * - Unsubscribe uses secure token (no login required)
 */

import User from "../models/User.js";

// ===========================================
// GET EMAIL PREFERENCES
// ===========================================

/**
 * GET /api/user/email-preferences
 * Get current user's email preferences
 * 
 * Requires: Authentication
 */
export const getEmailPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("emailPreferences timezone");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.json({
      success: true,
      preferences: {
        enabled: user.emailPreferences?.enabled ?? true,
        billReminders: user.emailPreferences?.billReminders ?? true,
        reminderFrequency: user.emailPreferences?.reminderFrequency ?? "all",
        marketing: user.emailPreferences?.marketing ?? false,
        productUpdates: user.emailPreferences?.productUpdates ?? true,
        securityAlerts: true, // Always enabled
      },
      timezone: user.timezone || "Asia/Kolkata",
    });
  } catch (error) {
    console.error("[EmailPref] getEmailPreferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get preferences",
      code: "INTERNAL_ERROR",
    });
  }
};

// ===========================================
// UPDATE EMAIL PREFERENCES
// ===========================================

/**
 * PUT /api/user/email-preferences
 * Update user's email preferences
 * 
 * Body: {
 *   enabled?: boolean,
 *   billReminders?: boolean,
 *   reminderFrequency?: "all" | "daily_digest" | "important_only",
 *   marketing?: boolean,
 *   productUpdates?: boolean
 * }
 * 
 * Requires: Authentication
 */
export const updateEmailPreferences = async (req, res) => {
  try {
    const { enabled, billReminders, reminderFrequency, marketing, productUpdates, timezone } = req.body;

    // Build update object
    const updates = {};
    
    if (enabled !== undefined) {
      updates["emailPreferences.enabled"] = enabled;
    }
    if (billReminders !== undefined) {
      updates["emailPreferences.billReminders"] = billReminders;
    }
    if (reminderFrequency !== undefined) {
      updates["emailPreferences.reminderFrequency"] = reminderFrequency;
    }
    if (marketing !== undefined) {
      updates["emailPreferences.marketing"] = marketing;
    }
    if (productUpdates !== undefined) {
      updates["emailPreferences.productUpdates"] = productUpdates;
    }
    if (timezone !== undefined) {
      updates.timezone = timezone;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select("emailPreferences timezone");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.json({
      success: true,
      message: "Email preferences updated successfully",
      preferences: {
        enabled: user.emailPreferences?.enabled ?? true,
        billReminders: user.emailPreferences?.billReminders ?? true,
        reminderFrequency: user.emailPreferences?.reminderFrequency ?? "all",
        marketing: user.emailPreferences?.marketing ?? false,
        productUpdates: user.emailPreferences?.productUpdates ?? true,
        securityAlerts: true,
      },
      timezone: user.timezone,
    });
  } catch (error) {
    console.error("[EmailPref] updateEmailPreferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update preferences",
      code: "INTERNAL_ERROR",
    });
  }
};

// ===========================================
// ONE-CLICK UNSUBSCRIBE
// ===========================================

/**
 * GET /api/email/unsubscribe
 * One-click unsubscribe via email link (no login required)
 * 
 * Query: {
 *   token: string (unsubscribe token),
 *   type?: "all" | "billReminders" | "marketing" | "productUpdates"
 * }
 * 
 * This is accessed via links in emails, so it's a GET request
 * and doesn't require authentication.
 */
export const unsubscribeEmail = async (req, res) => {
  try {
    const { token, type = "all" } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Invalid unsubscribe link",
        code: "INVALID_TOKEN",
      });
    }

    // Find user by unsubscribe token
    const user = await User.findOne({ unsubscribeToken: token }).select("+unsubscribeToken");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired unsubscribe link",
        code: "INVALID_TOKEN",
      });
    }

    // Build update based on type
    const updates = {};
    
    switch (type) {
      case "all":
        updates["emailPreferences.enabled"] = false;
        break;
      case "billReminders":
        updates["emailPreferences.billReminders"] = false;
        break;
      case "marketing":
        updates["emailPreferences.marketing"] = false;
        break;
      case "productUpdates":
        updates["emailPreferences.productUpdates"] = false;
        break;
      default:
        updates["emailPreferences.enabled"] = false;
    }

    await User.findByIdAndUpdate(user._id, { $set: updates });

    // Return a user-friendly HTML page
    const typeLabel = type === "all" ? "all emails" : type.replace(/([A-Z])/g, " $1").toLowerCase().trim();
    
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed - GreenReceipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 450px;
          }
          .icon { font-size: 48px; margin-bottom: 20px; }
          h1 { color: #10b981; font-size: 24px; margin-bottom: 12px; }
          p { color: #475569; line-height: 1.6; margin-bottom: 20px; }
          .email { 
            background: #f1f5f9; 
            padding: 12px 20px; 
            border-radius: 8px; 
            font-family: monospace;
            color: #334155;
            margin-bottom: 24px;
          }
          a {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: background 0.2s;
          }
          a:hover { background: #059669; }
          .footer { margin-top: 24px; font-size: 13px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You've been unsubscribed from ${typeLabel}.</p>
          <div class="email">${user.email}</div>
          <p>You can manage your email preferences anytime in your account settings.</p>
          <a href="${process.env.CLIENT_URL || "https://green-recipt.vercel.app"}/customer/profile">
            Go to Settings
          </a>
          <p class="footer">© ${new Date().getFullYear()} GreenReceipt</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("[EmailPref] unsubscribeEmail error:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - GreenReceipt</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #ef4444; }
        </style>
      </head>
      <body>
        <h1>Something went wrong</h1>
        <p>We couldn't process your unsubscribe request. Please try again or contact support.</p>
      </body>
      </html>
    `);
  }
};

// ===========================================
// RESUBSCRIBE (EMERGENCY UNDO)
// ===========================================

/**
 * POST /api/email/resubscribe
 * Re-enable email notifications after unsubscribe
 * 
 * Body: { token: string }
 */
export const resubscribeEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        code: "INVALID_TOKEN",
      });
    }

    const user = await User.findOneAndUpdate(
      { unsubscribeToken: token },
      { $set: { "emailPreferences.enabled": true } },
      { new: true }
    ).select("email emailPreferences");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    res.json({
      success: true,
      message: "Email notifications re-enabled",
      email: user.email,
    });
  } catch (error) {
    console.error("[EmailPref] resubscribeEmail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resubscribe",
      code: "INTERNAL_ERROR",
    });
  }
};

export default {
  getEmailPreferences,
  updateEmailPreferences,
  unsubscribeEmail,
  resubscribeEmail,
};
