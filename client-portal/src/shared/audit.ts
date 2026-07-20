/**
 * BillDoor — Audit Logging
 * 
 * OWASP A09:2025 — Security Logging Failures.
 * AI-generated code rarely implements comprehensive audit trails.
 * 
 * Every sensitive action MUST be logged:
 *   - Auth attempts (success + failure)
 *   - Password resets (both paths)
 *   - License key generation
 *   - Client status changes (revoke/reactivate)
 *   - Module toggles
 *   - Account deletion
 *   - Rate limit violations
 * 
 * NEVER log: passwords, tokens, full API keys, PII in plaintext.
 * Log only: action type, actor, target, timestamp, metadata.
 */

import type { AuditActorType } from './types';

export interface AuditEvent {
  actorType: AuditActorType;
  actorId: string;
  action: string;
  target?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Predefined audit actions
// ============================================================
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  ACTIVATION_SUCCESS: 'auth.activation.success',
  ACTIVATION_FAILED: 'auth.activation.failed',
  PASSWORD_RESET_REQUEST: 'auth.password_reset.request',
  PASSWORD_RESET_SUCCESS: 'auth.password_reset.success',
  PASSWORD_RESET_FAILED: 'auth.password_reset.failed',
  PASSWORD_CHANGED: 'auth.password.changed',
  RATE_LIMITED: 'auth.rate_limited',

  // Admin — license keys
  LICENSE_KEY_GENERATED: 'admin.license_key.generated',
  LICENSE_KEY_COPIED: 'admin.license_key.copied',

  // Admin — client management
  CLIENT_REVOKED: 'admin.client.revoked',
  CLIENT_REACTIVATED: 'admin.client.reactivated',
  CLIENT_DELETED: 'admin.client.deleted',
  CLIENT_MODULES_TOGGLED: 'admin.client.modules_toggled',
  CLIENT_VALIDITY_EXTENDED: 'admin.client.validity_extended',
  CLIENT_USERNAME_CHANGED: 'admin.client.username_changed',
  CLIENT_PASSWORD_RESET: 'admin.client.password_reset',

  // Client — settings
  BUSINESS_SETTINGS_UPDATED: 'client.settings.updated',
  REWARD_SETTINGS_UPDATED: 'client.rewards.updated',
  ACCOUNT_DELETED: 'client.account.deleted',

  // Platform
  ADMIN_SETTINGS_UPDATED: 'admin.settings.updated',
  ADMIN_PASSWORD_CHANGED: 'admin.password.changed',
} as const;

/**
 * Create an audit log entry.
 * Called from Server Actions using the service_role Supabase client.
 * 
 * @param supabaseAdmin - Supabase client with service_role key
 * @param event - The audit event to log
 */
export async function logAuditEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  event: AuditEvent
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('audit_log')
    .insert({
      actor_type: event.actorType,
      actor_id: event.actorId,
      action: event.action,
      target: event.target ?? null,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
      metadata: event.metadata ?? {},
    });

  if (error) {
    // Log to server console but never throw — audit failure
    // should not break the primary action
    console.error('[AUDIT] Failed to log event:', event.action, error);
  }
}

/**
 * Sanitize metadata before logging.
 * Strips any accidentally included sensitive fields.
 */
export function sanitizeMetadata(
  data: Record<string, unknown>
): Record<string, unknown> {
  const FORBIDDEN_KEYS = [
    'password', 'passwordHash', 'password_hash',
    'token', 'secret', 'apiKey', 'api_key',
    'serviceRoleKey', 'service_role_key',
    'creditCard', 'credit_card', 'ssn',
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase().replace(/[-_]/g, ''))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
