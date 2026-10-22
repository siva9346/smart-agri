import { useEffect, useState } from 'react';
import { whatsappApi } from '../services/platform';

let cached: { at: number; enabled: boolean } | null = null;

/** Whether the WhatsApp Business API is connected (else the app falls back to click-to-chat). */
export function useWhatsAppEnabled() {
  const [enabled, setEnabled] = useState(cached?.enabled ?? false);
  useEffect(() => {
    if (cached && Date.now() - cached.at < 60_000) return;
    whatsappApi.status().then(s => { cached = { at: Date.now(), enabled: s.enabled }; setEnabled(s.enabled); }).catch(() => {});
  }, []);
  return enabled;
}
