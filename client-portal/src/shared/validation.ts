/**
 * BillDoor — Shared Validation
 * 
 * §12: Forms validated the same way client and server side.
 * Never trust client-side validation alone.
 * 
 * This file runs identically in browser and Node/Edge.
 */

// ============================================================
// Validation result
// ============================================================
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

function ok(): ValidationResult {
  return { valid: true, errors: {} };
}

function fail(errors: Record<string, string>): ValidationResult {
  return { valid: false, errors };
}

// ============================================================
// Field validators
// ============================================================

export function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidPhone(phone: string): boolean {
  // Indian mobile: 10 digits, optionally prefixed with +91 or 91
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+?91)?[6-9]\d{9}$/.test(cleaned);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: string): boolean {
  // 3-30 chars, lowercase letters, numbers, underscores
  return /^[a-z0-9_]{3,30}$/.test(username);
}

export function isValidPassword(password: string): boolean {
  // Min 8 chars, at least one letter and one number
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

export function isValidGstNumber(gst: string): boolean {
  // Indian GST: 15 chars, specific format
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gst.toUpperCase());
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Form validators — one per form in the app
// ============================================================

/** Login form (§2) */
export function validateLogin(data: {
  username?: string;
  password?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(data.username)) {
    errors.username = 'Username is required';
  }
  if (!isNonEmpty(data.password)) {
    errors.password = 'Password is required';
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

/** Client activation form (§2) */
export function validateActivation(data: {
  licenseKey?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  businessName?: string;
  slug?: string;
  phone?: string;
  email?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(data.licenseKey)) {
    errors.licenseKey = 'License key is required';
  }

  if (!isNonEmpty(data.username)) {
    errors.username = 'Username is required';
  } else if (!isValidUsername(data.username!)) {
    errors.username = 'Username must be 3-30 characters: lowercase letters, numbers, underscores';
  }

  if (!isNonEmpty(data.password)) {
    errors.password = 'Password is required';
  } else if (!isValidPassword(data.password!)) {
    errors.password = 'Password must be at least 8 characters with at least one letter and one number';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (!isNonEmpty(data.businessName)) {
    errors.businessName = 'Business name is required';
  }

  if (!isNonEmpty(data.slug)) {
    errors.slug = 'URL slug is required';
  } else if (!isValidSlug(data.slug!)) {
    errors.slug = 'Slug must be 3-50 characters: lowercase letters, numbers, hyphens';
  }

  if (!isNonEmpty(data.phone)) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(data.phone!)) {
    errors.phone = 'Enter a valid Indian mobile number';
  }

  // Email is optional but validated if provided (strongly prompted at signup)
  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Enter a valid email address';
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

/** Password reset request (§2) */
export function validatePasswordReset(data: {
  licenseKey?: string;
  email?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(data.licenseKey)) {
    errors.licenseKey = 'License key is required';
  }

  // Email is optional — if not provided, goes through admin-assisted path
  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Enter a valid email address';
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

/** General Settings — business info (§9) */
export function validateBusinessSettings(data: {
  businessName?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  hasGst?: boolean;
  instagramUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(data.businessName)) {
    errors.businessName = 'Business name is required';
  }

  if (!isNonEmpty(data.phone)) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(data.phone!)) {
    errors.phone = 'Enter a valid Indian mobile number';
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Enter a valid email address';
  }

  if (data.hasGst && data.gstNumber) {
    if (!isValidGstNumber(data.gstNumber)) {
      errors.gstNumber = 'Enter a valid 15-character GST number';
    }
  }

  if (data.instagramUrl && !isValidUrl(data.instagramUrl)) {
    errors.instagramUrl = 'Enter a valid URL';
  }
  if (data.facebookUrl && !isValidUrl(data.facebookUrl)) {
    errors.facebookUrl = 'Enter a valid URL';
  }
  if (data.websiteUrl && !isValidUrl(data.websiteUrl)) {
    errors.websiteUrl = 'Enter a valid URL';
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

/** Admin — license key generation (§2) */
export function validateLicenseKeyGeneration(data: {
  mobileNumber?: string;
  businessName?: string;
  slug?: string;
  googlePlaceId?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(data.mobileNumber)) {
    errors.mobileNumber = 'Client mobile number is required';
  } else if (!isValidPhone(data.mobileNumber!)) {
    errors.mobileNumber = 'Enter a valid Indian mobile number';
  }

  // businessName, slug, googlePlaceId are optional (paid setup upsell)
  if (data.slug && !isValidSlug(data.slug)) {
    errors.slug = 'Slug must be 3-50 characters: lowercase letters, numbers, hyphens';
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

/** Bill creation — customer phone lookup (§5) */
export function validateBillCustomer(data: {
  phone?: string;
  name?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(data.phone)) {
    errors.phone = 'Customer phone is required';
  } else if (!isValidPhone(data.phone!)) {
    errors.phone = 'Enter a valid phone number';
  }

  if (!isNonEmpty(data.name)) {
    errors.name = 'Customer name is required';
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

/** Delete account confirmation (§9) — type business name to confirm */
export function validateDeleteAccount(data: {
  confirmation?: string;
  businessName: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (data.confirmation !== data.businessName) {
    errors.confirmation = `Type "${data.businessName}" to confirm deletion`;
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}
