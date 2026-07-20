/**
 * BillDoor — AES-256-GCM Credential Encryption (Server-Side Only)
 *
 * Used to encrypt/decrypt WhatsApp Business API credentials before
 * storing in whatsapp_config.api_credentials_encrypted.
 *
 * NEVER import this from client-side code.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'WHATSAPP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext credential string.
 * Returns base64-encoded string in format: iv:authTag:ciphertext
 */
export function encryptCredential(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a credential string produced by encryptCredential.
 * Input: base64-encoded string in format: iv:authTag:ciphertext
 */
export function decryptCredential(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format. Expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Returns the last 4 hex characters of the encrypted value for masking display.
 * e.g. "••••••••ab3f"
 */
export function maskCredential(encrypted: string): string {
  if (!encrypted) return '';
  // Take last 4 chars of the raw ciphertext portion
  const parts = encrypted.split(':');
  const cipher = parts[2] || encrypted;
  const tail = cipher.slice(-4);
  return `••••••••${tail}`;
}
