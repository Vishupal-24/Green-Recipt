/**
 * Email OTP Validation Schemas
 * 
 * Zod schemas for email OTP endpoints.
 * Validates request body, query params, and provides clear error messages.
 */

import { z } from "zod";

// ===========================================
// SHARED SCHEMAS
// ===========================================

const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .transform((val) => val.trim().toLowerCase());

const otpSchema = z
  .string()
  .trim()
  .length(6, "Verification code must be 6 digits")
  .regex(/^\d{6}$/, "Verification code must be 6 digits");

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password is too long");

const roleSchema = z
  .enum(["customer", "merchant"], {
    errorMap: () => ({ message: "Role must be 'customer' or 'merchant'" }),
  })
  .default("customer");

const purposeSchema = z
  .enum(["email_verification", "password_reset", "login_verification", "email_change"])
  .default("email_verification");

// ===========================================
// SEND EMAIL OTP SCHEMA
// ===========================================

export const sendEmailOtpSchema = {
  body: z.object({
    email: emailSchema,
    role: roleSchema,
  }),
};

// ===========================================
// VERIFY EMAIL OTP SCHEMA (SIGNUP COMPLETION)
// ===========================================

export const verifyEmailOtpSchema = {
  body: z
    .object({
      email: emailSchema,
      otp: otpSchema,
      password: passwordSchema,
      role: roleSchema,
      // Customer-specific
      name: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name is too long")
        .optional(),
      // Merchant-specific
      shopName: z
        .string()
        .min(1, "Shop name is required")
        .max(200, "Shop name is too long")
        .optional(),
    })
    .refine(
      (data) => {
        if (data.role === "customer") return !!data.name;
        if (data.role === "merchant") return !!data.shopName;
        return true;
      },
      {
        message: "Name is required for customers, shop name is required for merchants",
        path: ["name"],
      }
    ),
};

// ===========================================
// VERIFY EXISTING ACCOUNT EMAIL OTP SCHEMA
// ===========================================

export const verifyExistingEmailOtpSchema = {
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
    role: roleSchema,
  }),
};

// ===========================================
// RESEND EMAIL OTP SCHEMA
// ===========================================

export const resendEmailOtpSchema = {
  body: z.object({
    email: emailSchema,
    role: roleSchema,
    purpose: purposeSchema,
  }),
};

// ===========================================
// OTP STATUS CHECK SCHEMA (QUERY PARAMS)
// ===========================================

export const otpStatusSchema = {
  query: z.object({
    email: z
      .string()
      .email("Please enter a valid email address")
      .transform((val) => val.trim().toLowerCase()),
    purpose: purposeSchema.optional(),
  }),
};

// ===========================================
// PASSWORD RESET SCHEMAS
// ===========================================

export const sendPasswordResetOtpSchema = {
  body: z.object({
    email: emailSchema,
    role: roleSchema,
  }),
};

export const verifyPasswordResetOtpSchema = {
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
    role: roleSchema,
  }),
};

export const resetPasswordWithTokenSchema = {
  body: z.object({
    email: emailSchema,
    resetToken: z
      .string()
      .min(32, "Invalid reset token")
      .max(128, "Invalid reset token"),
    newPassword: passwordSchema,
    role: roleSchema,
  }),
};

// ===========================================
// EMAIL PREFERENCE UPDATE SCHEMA
// ===========================================

export const updateEmailPreferencesSchema = {
  body: z.object({
    enabled: z.boolean().optional(),
    billReminders: z.boolean().optional(),
    reminderFrequency: z
      .enum(["all", "daily_digest", "important_only"])
      .optional(),
    marketing: z.boolean().optional(),
    productUpdates: z.boolean().optional(),
  }),
};

// ===========================================
// UNSUBSCRIBE SCHEMA
// ===========================================

export const unsubscribeSchema = {
  query: z.object({
    token: z.string().min(32, "Invalid unsubscribe token").max(128),
    type: z
      .enum(["all", "billReminders", "marketing", "productUpdates"])
      .optional()
      .default("all"),
  }),
};

export default {
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  verifyExistingEmailOtpSchema,
  resendEmailOtpSchema,
  otpStatusSchema,
  sendPasswordResetOtpSchema,
  verifyPasswordResetOtpSchema,
  resetPasswordWithTokenSchema,
  updateEmailPreferencesSchema,
  unsubscribeSchema,
};
