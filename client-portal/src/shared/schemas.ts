/**
 * BillDoor — Server-Side Zod Schemas
 * 
 * SECURITY: Server Actions are public HTTP POST endpoints.
 * Every Server Action MUST:
 *   1. Verify auth state FIRST
 *   2. Validate input with Zod safeParse() — NEVER parse()
 *   3. Then process data
 * 
 * These schemas are the ENFORCEMENT layer.
 * Client-side validation (shared/validation.ts) is UX only.
 * 
 * Uses safeParse() to prevent unhandled exceptions
 * (OWASP A10:2025 — Mishandling of Exceptional Conditions)
 */

import { z } from 'zod';

// ============================================================
// Common field schemas (reusable)
// ============================================================

const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(/^(\+?91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number'));

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Must contain at least one letter')
  .regex(/\d/, 'Must contain at least one number');

const slugSchema = z
  .string()
  .trim()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Only lowercase letters, numbers, and hyphens');

const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .max(255);

const gstSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
    'Enter a valid 15-character GST number'
  );

const urlSchema = z.string().trim().url('Enter a valid URL').max(500);

// UUIDs — prevent Mass Assignment (OWASP API3:2023)
// Never trust client-supplied IDs without validating format
const uuidSchema = z.string().uuid('Invalid ID format');

// ============================================================
// Auth schemas
// ============================================================

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const activationSchema = z
  .object({
    licenseKey: z.string().trim().min(1, 'License key is required').max(64),
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    businessName: z.string().trim().min(1, 'Business name is required').max(200),
    businessType: z.string().trim().max(100).default(''),
    slug: slugSchema,
    phone: phoneSchema,
    email: emailSchema.optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const passwordResetRequestSchema = z.object({
  licenseKey: z.string().trim().min(1, 'License key is required').max(64),
  email: emailSchema.optional().or(z.literal('')),
});

export const passwordResetSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

// ============================================================
// Admin schemas
// ============================================================

export const generateLicenseKeySchema = z.object({
  mobileNumber: phoneSchema,
  // Optional pre-fill fields (paid setup upsell)
  businessName: z.string().trim().max(200).optional(),
  slug: slugSchema.optional(),
  googlePlaceId: z.string().trim().max(200).optional(),
  about: z.string().trim().max(1000).optional(),
});

export const toggleModulesSchema = z.object({
  clientId: uuidSchema,
  modules: z.object({
    reviewFlow: z.boolean(),
    billit: z.boolean(),
    appointer: z.boolean(),
    whatsappAuto: z.boolean(),
  }),
});

export const extendValiditySchema = z.object({
  clientId: uuidSchema,
  months: z.number().int().min(1).max(24),
});

// ============================================================
// General Settings schemas (§9)
// ============================================================

export const businessSettingsSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  ownerName: z.string().trim().max(200).default(''),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  address: z.string().trim().max(500).default(''),
  hasGst: z.boolean(),
  gstNumber: gstSchema.optional().or(z.literal('')),
  instagramUrl: urlSchema.optional().or(z.literal('')),
  facebookUrl: urlSchema.optional().or(z.literal('')),
  websiteUrl: urlSchema.optional().or(z.literal('')),
  showBarcodeOnBill: z.boolean(),
});

export const rewardSettingsSchema = z.object({
  triggers: z.object({
    feedback: z.boolean(),
    billCreated: z.boolean(),
    appointmentCompleted: z.boolean(),
  }),
  rewardType: z.enum(['percent_discount', 'flat_discount', 'free_item']),
  rewardValue: z.number().min(0).max(10000),
  reviewRewardMode: z.enum(['all_feedback', 'positive_only']),
  maxPerCustomerPerDay: z.number().int().min(1).max(10),
});

export const deleteAccountSchema = z.object({
  confirmation: z.string().trim(),
  businessName: z.string().trim(),
}).refine((data) => data.confirmation === data.businessName, {
  message: 'Type your business name exactly to confirm',
  path: ['confirmation'],
});

// ============================================================
// Billit schemas (§5)
// ============================================================

export const billLineItemSchema = z.object({
  catalogItemId: uuidSchema,
  name: z.string().trim().min(1).max(200),
  qty: z.number().positive('Quantity must be positive').max(99999),
  unitPrice: z.number().min(0).max(9999999.99),
  itemDiscount: z.number().min(0).max(100).default(0),
  gstPercent: z.number().min(0).max(100),
});

export const createBillSchema = z.object({
  customerPhone: phoneSchema,
  customerName: z.string().trim().min(1, 'Customer name is required').max(200),
  items: z.array(billLineItemSchema).min(1, 'At least one item required').max(100),
  discount: z.number().min(0).max(9999999.99).default(0),
  extraCharges: z.number().min(0).max(9999999.99).default(0),
  rewardCode: z.string().trim().max(20).optional(),
  paymentMethod: z.enum(['cash', 'upi', 'card']).optional(),
});

export const catalogItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['product', 'service']),
  price: z.number().min(0).max(9999999.99),
  unit: z.string().trim().max(50).default('unit'),
  defaultGstPercent: z.number().min(0).max(100).default(0),
  defaultResourceId: uuidSchema.optional().nullable(),
  defaultDurationMin: z.number().int().min(1).max(480).optional().nullable(),
});

// ============================================================
// Appointer schemas (§6)
// ============================================================

export const resourceSchema = z.object({
  name: z.string().trim().min(1, 'Resource name is required').max(100),
});

export const bookAppointmentSchema = z.object({
  resourceId: uuidSchema,
  customerPhone: phoneSchema,
  customerName: z.string().trim().min(1).max(200),
  slotStart: z.string().datetime('Invalid datetime'),
  estimatedDurationMin: z.number().int().min(5).max(480).default(30),
  status: z.enum(['booked', 'walkin']).default('booked'),
});

// ============================================================
// Review Flow schemas (§4) — public, no auth
// ============================================================

export const submitReviewSchema = z.object({
  clientSlug: slugSchema,
  stars: z.number().int().min(1).max(5),
  feedbackText: z.string().trim().max(2000).optional(),
  source: z.enum(['qr', 'bill_page']),
  billId: uuidSchema.optional().nullable(),
});

// ============================================================
// WhatsApp schemas (§7, §8)
// ============================================================

export const whatsappTemplateSchema = z.object({
  type: z.enum(['billit', 'appointer_reminder', 'broadcast']),
  name: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(2000),
  isActive: z.boolean().default(true),
});

// ============================================================
// Service Request schemas (§9a)
// ============================================================

export const serviceRequestSchema = z.object({
  serviceType: z.enum(['website', 'seo', 'ads', 'branding', 'support']),
  description: z.string().trim().max(2000).default(''),
});

// ============================================================
// Type exports (infer types from schemas)
// ============================================================
export type LoginInput = z.infer<typeof loginSchema>;
export type ActivationInput = z.infer<typeof activationSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type GenerateLicenseKeyInput = z.infer<typeof generateLicenseKeySchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
export type RewardSettingsInput = z.infer<typeof rewardSettingsSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type CatalogItemInput = z.infer<typeof catalogItemSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type WhatsAppTemplateInput = z.infer<typeof whatsappTemplateSchema>;
export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;
