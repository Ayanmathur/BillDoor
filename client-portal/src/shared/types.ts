/**
 * BillDoor — Shared TypeScript Types
 * 
 * Maps directly to the DB schema (00001_core_schema.sql).
 * DB: snake_case → Code: camelCase (§12)
 */

// ============================================================
// Platform Settings (singleton)
// ============================================================
export interface PlatformSettings {
  id: string;
  adminWhatsappNumber: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Admin Users
// ============================================================
export interface AdminUser {
  id: string;
  username: string;
  /** Never sent to client */
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// License Keys
// ============================================================
export type LicenseKeyStatus = 'unused' | 'activated';

export interface LicenseKey {
  id: string;
  /** The raw key is only shown once at generation, stored hashed */
  keyHash: string;
  mobileNumber: string;
  status: LicenseKeyStatus;
  clientId: string | null;
  /** Optional pre-fill fields (paid setup service) */
  businessName: string | null;
  slug: string | null;
  googlePlaceId: string | null;
  about: string | null;
  createdAt: string;
}

// ============================================================
// Clients
// ============================================================
export type ClientStatus = 'active' | 'revoked';

export interface ModulesEnabled {
  reviewFlow: boolean;
  billit: boolean;
  appointer: boolean;
  whatsappAuto: boolean;
}

export interface RewardSettings {
  triggers: {
    feedback: boolean;
    billCreated: boolean;
    appointmentCompleted: boolean;
  };
  rewardType: 'percent_discount' | 'flat_discount' | 'free_item';
  rewardValue: number;
  reviewRewardMode: 'all_feedback' | 'positive_only';
  maxPerCustomerPerDay: number;
}

export interface Client {
  id: string;
  businessName: string;
  slug: string;
  businessType: string;
  googlePlaceId: string | null;
  about: string;
  licenseKeyId: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  phone: string;
  registeredAt: string;
  validTill: string;
  status: ClientStatus;
  modulesEnabled: ModulesEnabled;
  hasGst: boolean;
  gstNumber: string | null;
  ownerName: string;
  address: string;
  logoUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  showBarcodeOnBill: boolean;
  rewardSettings: RewardSettings;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Customers (shared across Billit, Appointer, Review Flow)
// ============================================================
export interface Customer {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  email: string | null;
  optedIn: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Resources (Appointer)
// ============================================================
export interface Resource {
  id: string;
  clientId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Catalog Items (Billit — unified products + services)
// ============================================================
export type CatalogItemType = 'product' | 'service';

export interface CatalogItem {
  id: string;
  clientId: string;
  name: string;
  type: CatalogItemType;
  price: number;
  unit: string;
  defaultGstPercent: number;
  defaultResourceId: string | null;
  defaultDurationMin: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Bills (Billit)
// ============================================================
export interface BillLineItem {
  catalogItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  itemDiscount: number;
  gstPercent: number;
  lineTotal: number;
}

export type BillSentVia = 'auto' | 'manual' | 'none';

export interface Bill {
  id: string;
  clientId: string;
  customerId: string;
  billNumber: string;
  billSlug: string;
  items: BillLineItem[];
  subtotal: number;
  discount: number;
  gst: number;
  extraCharges: number;
  grandTotal: number;
  whatsappSent: boolean;
  sentVia: BillSentVia;
  sentAt: string | null;
  createdAt: string;
}

// ============================================================
// Payments (v1, minimal)
// ============================================================
export type PaymentMethod = 'cash' | 'upi' | 'card';

export interface Payment {
  id: string;
  billId: string;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
}

// ============================================================
// Review Sessions
// ============================================================
export type ReviewSource = 'qr' | 'bill_page';

export interface ReviewSession {
  id: string;
  clientId: string;
  billId: string | null;
  source: ReviewSource;
  stars: number | null;
  rewardIssued: boolean;
  createdAt: string;
}

// ============================================================
// Google Review Events
// ============================================================
export type GoogleReviewEvent = 'redirected' | 'copied' | 'skipped';

export interface GoogleReviewEventRow {
  id: string;
  reviewSessionId: string;
  event: GoogleReviewEvent;
  createdAt: string;
}

// ============================================================
// Reviews
// ============================================================
export interface Review {
  id: string;
  clientId: string;
  billId: string | null;
  customerId: string | null;
  stars: number;
  feedbackText: string | null;
  aiReviewText: string | null;
  read: boolean;
  archived: boolean;
  createdAt: string;
}

// ============================================================
// Reward Codes
// ============================================================
export type RewardSourceType = 'feedback' | 'bill_created' | 'appointment_completed';
export type RewardType = 'percent_discount' | 'flat_discount' | 'free_item';

export interface RewardCode {
  id: string;
  clientId: string;
  customerId: string | null;
  sourceType: RewardSourceType;
  sourceId: string | null;
  code: string;
  type: RewardType;
  value: number;
  redeemed: boolean;
  redeemedAt: string | null;
  redeemedBillId: string | null;
  createdAt: string;
}

// ============================================================
// Appointments (Appointer)
// ============================================================
export type AppointmentStatus = 'booked' | 'walkin' | 'completed' | 'no_show' | 'cancelled';

export interface Appointment {
  id: string;
  clientId: string;
  resourceId: string;
  customerId: string;
  slotStart: string;
  slotEnd: string;
  estimatedDurationMin: number;
  status: AppointmentStatus;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Notifications (§9b — global bell, every module writes here)
// ============================================================
export type NotificationType =
  | 'bill_sent'
  | 'bill_failed'
  | 'appointment_booked'
  | 'appointment_reminder'
  | 'appointment_no_show'
  | 'appointment_completed'
  | 'feedback_received'
  | 'orbitex_update'
  | 'subscription_due'
  | 'whatsapp_disconnected';

export interface Notification {
  id: string;
  clientId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// ============================================================
// Service Requests (§9a — Orbitex Services)
// ============================================================
export type ServiceType = 'website' | 'seo' | 'ads' | 'branding' | 'support';
export type ServiceRequestStatus = 'requested' | 'in_progress' | 'done';

export interface ServiceRequest {
  id: string;
  clientId: string;
  serviceType: ServiceType;
  status: ServiceRequestStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// WhatsApp Templates
// ============================================================
export type WhatsAppTemplateType = 'billit' | 'appointer_reminder' | 'broadcast';

export interface WhatsAppTemplate {
  id: string;
  clientId: string;
  type: WhatsAppTemplateType;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// WhatsApp Config
// ============================================================
export type WhatsAppConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface WhatsAppConfig {
  id: string;
  clientId: string;
  /** Encrypted, never returned to client-side */
  apiCredentialsEncrypted?: string;
  connectionStatus: WhatsAppConnectionStatus;
  qualityRating: string;
  automationEnabled: boolean;
  monthlyMessageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Broadcast Campaigns
// ============================================================
export interface BroadcastCampaign {
  id: string;
  clientId: string;
  templateId: string;
  audienceFilter: Record<string, unknown>;
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
}

// ============================================================
// Audit Log
// ============================================================
export type AuditActorType = 'admin' | 'client' | 'system';

export interface AuditLogEntry {
  id: string;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ============================================================
// DB → Code field mapping utility type
// snake_case DB columns → camelCase TS fields
// ============================================================
export type SnakeToCamel<S extends string> =
  S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamel<U>>}`
    : S;
