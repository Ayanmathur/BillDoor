'use server';

/**
 * WhatsApp Settings — Server Actions
 *
 * Handles encrypted credential storage, connection testing,
 * automation toggle, and config management.
 *
 * Security: api_credentials_encrypted is NEVER returned to the client.
 * Only a `hasCredentials` boolean and a masked tail are sent.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { encryptCredential, maskCredential, decryptCredential } from '@/lib/encryption';

// ---- Zod Schemas ----
const credentialSchema = z.object({
  phoneNumberId: z.string().min(5, 'Phone Number ID is required'),
  accessToken: z.string().min(10, 'Access Token is required'),
});

const automationSchema = z.object({
  enabled: z.boolean(),
});

// ---- Fetch Settings (safe — never returns raw credentials) ----
export async function fetchWhatsAppSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', config: null };

  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('client_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return { error: 'Failed to fetch settings.', config: null };
  }

  // No config row yet — return defaults
  if (!data) {
    return {
      config: {
        hasCredentials: false,
        credentialMask: '',
        connectionStatus: 'disconnected' as const,
        qualityRating: 'unknown',
        automationEnabled: false,
        monthlyMessageCount: 0,
      },
    };
  }

  return {
    config: {
      hasCredentials: !!data.api_credentials_encrypted,
      credentialMask: data.api_credentials_encrypted
        ? maskCredential(data.api_credentials_encrypted)
        : '',
      connectionStatus: data.connection_status as 'connected' | 'disconnected' | 'error',
      qualityRating: data.quality_rating || 'unknown',
      automationEnabled: data.automation_enabled,
      monthlyMessageCount: data.monthly_message_count,
    },
  };
}

// ---- Save Credentials (encrypts before storage) ----
export async function saveWhatsAppCredentialsAction(input: {
  phoneNumberId: string;
  accessToken: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = credentialSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  // Encrypt credentials as a JSON blob
  const credentialBlob = JSON.stringify({
    phoneNumberId: parsed.data.phoneNumberId,
    accessToken: parsed.data.accessToken,
  });
  const encrypted = encryptCredential(credentialBlob);

  // Upsert: insert if missing, update if exists
  const { data: existing } = await supabase
    .from('whatsapp_config')
    .select('id')
    .eq('client_id', user.id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('whatsapp_config')
      .update({
        api_credentials_encrypted: encrypted,
        connection_status: 'disconnected', // reset status on credential change
      })
      .eq('client_id', user.id);

    if (error) return { error: 'Failed to save credentials.' };
  } else {
    const { error } = await supabase
      .from('whatsapp_config')
      .insert({
        client_id: user.id,
        api_credentials_encrypted: encrypted,
        connection_status: 'disconnected',
      });

    if (error) return { error: 'Failed to save credentials.' };
  }

  return { success: true };
}

// ---- Test Connection ----
export async function testWhatsAppConnectionAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('api_credentials_encrypted')
    .eq('client_id', user.id)
    .single();

  if (!config?.api_credentials_encrypted) {
    return { error: 'No credentials saved. Enter your API credentials first.' };
  }

  try {
    const decrypted = decryptCredential(config.api_credentials_encrypted);
    const creds = JSON.parse(decrypted);

    // Call Meta Graph API to verify credentials
    // TODO: Replace with actual Meta API call when live
    // const response = await fetch(
    //   `https://graph.facebook.com/v21.0/${creds.phoneNumberId}?access_token=${creds.accessToken}`
    // );
    // const result = await response.json();

    // STUB: Simulate a successful connection for now
    const stubConnected = true;
    const stubQuality = 'GREEN';

    if (stubConnected) {
      await supabase
        .from('whatsapp_config')
        .update({
          connection_status: 'connected',
          quality_rating: stubQuality,
        })
        .eq('client_id', user.id);

      return {
        connectionStatus: 'connected' as const,
        qualityRating: stubQuality,
      };
    }

    await supabase
      .from('whatsapp_config')
      .update({ connection_status: 'error' })
      .eq('client_id', user.id);

    return {
      error: 'Connection failed. Check your credentials.',
      connectionStatus: 'error' as const,
    };
  } catch {
    await supabase
      .from('whatsapp_config')
      .update({ connection_status: 'error' })
      .eq('client_id', user.id);

    return { error: 'Failed to decrypt credentials. Please re-enter them.' };
  }
}

// ---- Toggle Automation ----
export async function toggleAutomationAction(input: { enabled: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = automationSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input.' };

  // Upsert
  const { data: existing } = await supabase
    .from('whatsapp_config')
    .select('id')
    .eq('client_id', user.id)
    .single();

  if (existing) {
    await supabase
      .from('whatsapp_config')
      .update({ automation_enabled: parsed.data.enabled })
      .eq('client_id', user.id);
  } else {
    await supabase
      .from('whatsapp_config')
      .insert({
        client_id: user.id,
        automation_enabled: parsed.data.enabled,
      });
  }

  return { success: true };
}
