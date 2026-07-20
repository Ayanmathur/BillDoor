/**
 * BillDoor — Cryptographic Utilities
 * 
 * AES-256-GCM encryption for license keys (admin can unmask/resend).
 * The hash (SHA-256) is still used for client-side verification.
 * The encrypted version is decryptable only by the admin backend.
 * 
 * SECURITY: LICENSE_KEY_ENCRYPTION_SECRET must be a 32-byte hex string
 * stored in .env.local — NEVER committed, NEVER client-side.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.LICENSE_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'LICENSE_KEY_ENCRYPTION_SECRET is not set or too short. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  // Use first 32 bytes of SHA-256 hash of the secret
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns: iv:ciphertext:authTag (all hex-encoded, colon-separated)
 */
export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input format: iv:ciphertext:authTag (all hex-encoded)
 */
export function decryptKey(encryptedString: string): string {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format.');
  }

  const [ivHex, cipherHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash a license key (SHA-256) for lookup/verification.
 * One-way — used by the client activation flow.
 */
export function hashLicenseKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}
