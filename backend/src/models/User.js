import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		password: {
			type: String,
			required: true,
			minlength: 6,
		},
		role: {
			type: String,
			enum: ["customer"],
			default: "customer",
			immutable: true,
		},
		phone: {
			type: String,
			trim: true,
		},
		address: {
			line1: { type: String, trim: true },
			line2: { type: String, trim: true },
			city: { type: String, trim: true },
			state: { type: String, trim: true },
			postalCode: { type: String, trim: true },
			country: { type: String, trim: true },
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		// Email verification OTP (for signup)
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
		emailOtp: {
			type: String,
			select: false,
		},
		emailOtpExpires: {
			type: Date,
			select: false,
		},
		// Password reset OTP
		resetPasswordOtp: {
			type: String,
			select: false,
		},
		resetPasswordExpires: {
			type: Date,
			select: false,
		},
		// Legacy OTP fields (kept for backward compat)
		otpCodeHash: {
			type: String,
			select: false,
		},
		otpExpiresAt: {
			type: Date,
			select: false,
		},
		otpAttempts: {
			type: Number,
			default: 0,
			select: false,
		},
		otpLastSentAt: {
			type: Date,
			select: false,
		},
		// Session tokens
		refreshToken: {
			type: String,
			select: false,
		},
		refreshTokenExpiry: {
			type: Date,
			select: false,
		},
		lastLoginAt: {
			type: Date,
		},
		tokenVersion: {
			type: Number,
			default: 0,
			select: false,
		},
		// ===========================================
		// EMAIL NOTIFICATION PREFERENCES
		// ===========================================
		emailPreferences: {
			// Master switch for all email notifications
			enabled: {
				type: Boolean,
				default: true,
			},
			// Bill reminder emails
			billReminders: {
				type: Boolean,
				default: true,
			},
			// Frequency of bill reminder emails: "all" | "daily_digest" | "important_only"
			// - all: Send each reminder as it occurs
			// - daily_digest: Batch reminders into one daily email
			// - important_only: Only due-today and overdue
			reminderFrequency: {
				type: String,
				enum: ["all", "daily_digest", "important_only"],
				default: "all",
			},
			// Marketing/promotional emails
			marketing: {
				type: Boolean,
				default: false,
			},
			// Product updates and tips
			productUpdates: {
				type: Boolean,
				default: true,
			},
			// Security alerts (cannot be disabled)
			securityAlerts: {
				type: Boolean,
				default: true,
				immutable: true,
			},
		},
		// Unsubscribe token for one-click email unsubscribe
		unsubscribeToken: {
			type: String,
			unique: true,
			sparse: true,
			select: false,
		},
		// Track email engagement for smart sending
		emailEngagement: {
			lastEmailSentAt: {
				type: Date,
				default: null,
			},
			lastEmailOpenedAt: {
				type: Date,
				default: null,
			},
			emailsSent: {
				type: Number,
				default: 0,
			},
			emailsOpened: {
				type: Number,
				default: 0,
			},
			emailsBounced: {
				type: Number,
				default: 0,
			},
		},
		// Timezone for accurate reminder scheduling
		timezone: {
			type: String,
			default: "Asia/Kolkata",
		},
	},
	{ timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
	if (!this.isModified("password")) return next();
	this.password = await bcrypt.hash(this.password, 10);
	next();
});

// Generate unsubscribe token if not exists
userSchema.pre("save", async function generateUnsubscribeToken(next) {
	if (!this.unsubscribeToken) {
		const crypto = await import("crypto");
		this.unsubscribeToken = crypto.randomBytes(32).toString("hex");
	}
	next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
	return bcrypt.compare(candidate, this.password);
};

/**
 * Check if user should receive email notifications
 * @param {string} emailType - Type of email (billReminders, marketing, etc.)
 * @returns {boolean}
 */
userSchema.methods.shouldReceiveEmail = function (emailType) {
	// Master switch check
	if (!this.emailPreferences?.enabled) {
		return false;
	}

	// Security alerts always sent
	if (emailType === "securityAlerts") {
		return true;
	}

	// Check specific preference
	if (this.emailPreferences[emailType] !== undefined) {
		return this.emailPreferences[emailType];
	}

	// Default to true for unknown types
	return true;
};

/**
 * Get reminder frequency preference
 * @returns {string} - "all" | "daily_digest" | "important_only"
 */
userSchema.methods.getReminderFrequency = function () {
	return this.emailPreferences?.reminderFrequency || "all";
};

/**
 * Update email engagement metrics
 * @param {string} action - "sent" | "opened" | "bounced"
 */
userSchema.methods.updateEmailEngagement = async function (action) {
	const updates = {};
	
	if (action === "sent") {
		updates["emailEngagement.lastEmailSentAt"] = new Date();
		updates["emailEngagement.emailsSent"] = (this.emailEngagement?.emailsSent || 0) + 1;
	} else if (action === "opened") {
		updates["emailEngagement.lastEmailOpenedAt"] = new Date();
		updates["emailEngagement.emailsOpened"] = (this.emailEngagement?.emailsOpened || 0) + 1;
	} else if (action === "bounced") {
		updates["emailEngagement.emailsBounced"] = (this.emailEngagement?.emailsBounced || 0) + 1;
	}

	await this.updateOne({ $set: updates });
};

// Indexes - only using schema.index() to avoid duplicates
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ refreshToken: 1 });
userSchema.index({ unsubscribeToken: 1 });
userSchema.index({ "emailPreferences.enabled": 1, "emailPreferences.billReminders": 1 });

const User = mongoose.model("User", userSchema);

export default User;