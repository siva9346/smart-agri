import { useEffect, useState } from 'react';
import { whatsappApi } from '../services/platform';
import { useAuth } from './useApi';

let cached: { at: number; enabled: boolean } | null = null;

/** Whether the WhatsApp Business API is connected (else the app falls back to click-to-chat). */
export function useWhatsAppEnabled() {
  const { isInternal } = useAuth();   // the status endpoint is internal-only
  const [enabled, setEnabled] = useState(cached?.enabled ?? false);
  useEffect(() => {
    if (!isInternal || (cached && Date.now() - cached.at < 60_000)) return;
    whatsappApi.status().then(s => { cached = { at: Date.now(), enabled: s.enabled }; setEnabled(s.enabled); }).catch(() => {});
  }, [isInternal]);
  return isInternal && enabled;
}
