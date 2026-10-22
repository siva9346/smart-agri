import { navigationRef } from './navigationRef';

/**
 * Notifications carry an `actionLink` like "consultation/<id>" or "lead/<id>".
 * Map it to a screen registered in the current role's stack; unknown links are
 * ignored (the notification itself is still readable in the Notification Center).
 */
export const openActionLink = (link?: string | null, role?: string) => {
  if (!link || !navigationRef.isReady()) return false;
  const [kind, id] = link.split('/');
  const nav = navigationRef as any;
  const internal = role && role !== 'FARMER';
  switch (kind) {
    case 'consultation': nav.navigate('ConsultationDetail', { id }); return true;
    case 'quotation':    nav.navigate('QuotationDetail', { id }); return true;
    case 'lead':         if (internal) { nav.navigate('LeadDetail', { id }); return true; } return false;
    case 'task':         if (internal) { nav.navigate('TaskForm', { taskId: id }); return true; } return false;
    default:             return false;
  }
};
