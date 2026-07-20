/**
 * BillDoor — Shared Constants
 * 
 * Naming convention (§12):
 *   Orbitex  = the company
 *   BillDoor = the product / website name
 *   Billit   = the billing module inside BillDoor's client panel
 * 
 * These three names are never interchangeable.
 */

// ============================================================
// Brand names — single source of truth
// ============================================================
export const BRAND = {
  company: 'Orbitex',
  product: 'BillDoor',
  billingModule: 'Billit',
} as const;

// ============================================================
// Module keys (match clients.modules_enabled jsonb keys)
// ============================================================
export type ModuleKey = 'billit' | 'appointer' | 'review_flow' | 'whatsapp_auto';

export interface ModulesEnabled {
  billit: boolean;
  appointer: boolean;
  review_flow: boolean;
  whatsapp_auto: boolean;
}

// ============================================================
// Navigation items — fixed display order (§10)
// Dashboard → Billit → Appointer → Review Flow → WhatsApp Auto
//   [divider]
//   Orbitex Services → Settings
//
// Order optimizes for how a business owner thinks about their day,
// independent of build order (§15 builds Review Flow before Billit).
// ============================================================
export interface NavItem {
  key: string;
  label: string;
  href: string;
  /** Lucide icon name — one family, never mixed (§10b) */
  icon: string;
  /** If set, only visible when this module is enabled */
  moduleKey?: ModuleKey;
  /** If true, render a divider ABOVE this item */
  dividerAbove?: boolean;
  /** If true, this item has its own module-scoped settings */
  hasModuleSettings?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    key: 'billit',
    label: 'Billit',
    href: '/dashboard/billit',
    icon: 'Receipt',
    moduleKey: 'billit',
    hasModuleSettings: true,
  },
  {
    key: 'appointer',
    label: 'Appointer',
    href: '/dashboard/appointer',
    icon: 'CalendarClock',
    moduleKey: 'appointer',
    hasModuleSettings: true,
  },
  {
    key: 'review-flow',
    label: 'Review Flow',
    href: '/dashboard/review-flow',
    icon: 'Star',
    moduleKey: 'review_flow',
    hasModuleSettings: true,
  },
  {
    key: 'whatsapp-auto',
    label: 'WhatsApp Auto',
    href: '/dashboard/whatsapp-auto',
    icon: 'MessageCircle',
    moduleKey: 'whatsapp_auto',
    hasModuleSettings: true,
  },
  // §10: Orbitex Services visually separated (divider above)
  // It's a request gateway to the agency, not a self-serve tool
  {
    key: 'orbitex-services',
    label: 'Orbitex Services',
    href: '/dashboard/orbitex-services',
    icon: 'Briefcase',
    dividerAbove: true,
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/dashboard/settings',
    icon: 'Settings',
  },
];

// ============================================================
// Admin nav items (separate portal, §3)
// ============================================================
export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    key: 'clients',
    label: 'Clients',
    href: '/dashboard/clients',
    icon: 'Users',
  },
  {
    key: 'license-keys',
    label: 'License Keys',
    href: '/dashboard/license-keys',
    icon: 'Key',
  },
  {
    key: 'audit-log',
    label: 'Audit Log',
    href: '/dashboard/audit-log',
    icon: 'ScrollText',
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/dashboard/settings',
    icon: 'Settings',
    dividerAbove: true,
  },
];

// ============================================================
// Billit keyboard shortcuts (§10a)
// Show hint on the button itself so it's discoverable.
// Alt-only combos — test across browsers, can collide with
// OS/browser menu mnemonics on Windows.
// ============================================================
export const BILLIT_SHORTCUTS = {
  clear: { key: 'Alt+C', label: 'Clear bill' },
  whatsapp: { key: 'Alt+W', label: 'WhatsApp send' },
  print: { key: 'Alt+P', label: 'Print' },
} as const;

// ============================================================
// Notification types (§9b — global bell, every module writes here)
// ============================================================
export const NOTIFICATION_TYPES = {
  bill_sent: { label: 'Bill Sent', icon: 'CheckCircle', color: 'success' },
  bill_failed: { label: 'Bill Failed', icon: 'XCircle', color: 'error' },
  appointment_booked: { label: 'Appointment Booked', icon: 'CalendarCheck', color: 'info' },
  appointment_reminder: { label: 'Appointment Reminder', icon: 'Clock', color: 'warning' },
  feedback_received: { label: 'Feedback Received', icon: 'MessageSquare', color: 'accent' },
  orbitex_update: { label: 'Orbitex Update', icon: 'Briefcase', color: 'info' },
  subscription_due: { label: 'Subscription Due', icon: 'CreditCard', color: 'warning' },
  whatsapp_disconnected: { label: 'WhatsApp Disconnected', icon: 'AlertTriangle', color: 'error' },
} as const;

// ============================================================
// Service request types (§9a — Orbitex Services)
// ============================================================
export const SERVICE_TYPES = [
  { key: 'website', label: 'Website', icon: 'Globe' },
  { key: 'seo', label: 'SEO', icon: 'Search' },
  { key: 'ads', label: 'Ads', icon: 'Megaphone' },
  { key: 'branding', label: 'Branding', icon: 'Palette' },
  { key: 'support', label: 'Support', icon: 'HeadphonesIcon' },
] as const;

// ============================================================
// Reward settings defaults (§4/§9 — spans modules)
// ============================================================
export const DEFAULT_REWARD_SETTINGS = {
  triggers: {
    feedback: false,
    bill_created: false,
    appointment_completed: false,
  },
  reward_type: 'percent_discount' as 'percent_discount' | 'flat_discount' | 'free_item',
  reward_value: 10,
  review_reward_mode: 'all_feedback' as 'all_feedback' | 'positive_only',
  max_per_customer_per_day: 1,
};

// ============================================================
// Theme
// ============================================================
export type Theme = 'light' | 'dark';

// ============================================================
// Max 3 clicks to any primary action from Dashboard (§10b)
// These are the quick-action routes from the dashboard.
// ============================================================
export const DASHBOARD_QUICK_ACTIONS = [
  { label: 'Create Bill', href: '/dashboard/billit/create', icon: 'PlusCircle', moduleKey: 'billit' as ModuleKey },
  { label: 'Book Appointment', href: '/dashboard/appointer/book', icon: 'CalendarPlus', moduleKey: 'appointer' as ModuleKey },
  { label: 'View Reviews', href: '/dashboard/review-flow', icon: 'Star', moduleKey: 'review_flow' as ModuleKey },
  { label: 'Request Service', href: '/dashboard/orbitex-services', icon: 'Briefcase' },
] as const;
