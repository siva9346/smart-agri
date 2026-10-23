/**
 * Typed clients for the consultation, CRM, quotation, task, notification,
 * AI, team and settings APIs. All business rules (pricing, permissions,
 * status transitions) live on the backend; these are thin wrappers.
 */
import { api } from './api';

type Page<T> = { items: T[]; nextCursor?: string | null };
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

// ── Consultations ────────────────────────────────────────────────────────────

export interface ConsultationMessage { by: string; byName: string; role: string; text: string; at: string; internal?: boolean }
export interface Consultation {
  consultationId: string; customerId: string; customerName: string; cropName: string; variety?: string;
  growthStage?: string; problemCategory: string; symptoms: string; severity: string; affectedArea?: string;
  farmLocation?: string; soilInfo?: string; irrigationInfo?: string; previousTreatments?: string; comments?: string;
  preferredContact: string; photoKeys?: string[]; photoUrls?: string[]; status: string; expertId?: string;
  expertName?: string; leadId?: string; messages: ConsultationMessage[]; createdAt: string; updatedAt: string;
  recommendation?: { text: string; productIds?: string[]; byName: string; at: string; aiAssisted?: boolean };
  /** Customer view only: the expert recommended products, which will arrive as a quotation. */
  quotationToFollow?: boolean;
  /** Internal view only. */
  recommendedProducts?: { productId: string; name: string; unit: string; price: number; imageUrl?: string }[];
  assignmentHistory?: { expertName?: string; tier: string; reason: string; at: string; by: string }[];
  assignmentTier?: string; followUpAt?: string;
  customer?: { userId: string; name: string; phone: string; village?: string; district?: string };
  expert?: { name?: string; qualifications?: string; experienceYears?: number; specializations?: string[] };
}

export const consultationApi = {
  list: (status?: string, cursor?: string) => api.get<Page<Consultation>>(`/consultations${qs({ status, cursor })}`),
  get: (id: string) => api.get<Consultation>(`/consultations/${id}`),
  create: (body: object) => api.post<Consultation>('/consultations', body),
  submitDraft: (id: string) => api.post<Consultation>(`/consultations/${id}/submit`, {}),
  uploadPhoto: (image: string, contentType: string) => api.post<{ key: string; url: string }>('/consultations/upload-photo', { image, contentType }),
  setStatus: (id: string, status: string, note?: string) => api.put<Consultation>(`/consultations/${id}/status`, { status, note }),
  message: (id: string, text: string, opts: { requestInfo?: boolean; internal?: boolean } = {}) =>
    api.post<Consultation>(`/consultations/${id}/messages`, { text, ...opts }),
  recommend: (id: string, body: { text: string; productIds: string[]; followUpAt?: string | null; aiAssisted?: boolean }) =>
    api.post<Consultation>(`/consultations/${id}/recommendation`, body),
  assign: (id: string, expertId?: string, reason?: string) => api.post<Consultation>(`/consultations/${id}/assign`, { expertId, reason }),
};

// ── CRM ──────────────────────────────────────────────────────────────────────

export interface Lead {
  leadId: string; customerName: string; phone: string; location: string; source: string; stage: string;
  priority: string; ownerId: string; ownerName?: string; expertId?: string; expertName?: string; cropName?: string;
  requirement: string; createdAt: string; updatedAt: string; lastActivityAt?: string; consultationId?: string;
  customerId?: string; email?: string; farmSize?: string; budget?: number; productInterest?: string; notes?: string;
  lostReason?: string; whatsappOptOut?: boolean; lastContactedAt?: string;
}
export interface Activity {
  leadId: string; activityId: string; type: string; text: string; actorName: string; actorRole: string;
  createdAt: string; data?: Record<string, any>;
}
export interface Task {
  taskId: string; kind: 'FOLLOW_UP' | 'APPOINTMENT' | 'TASK' | 'FIELD_VISIT'; purpose?: string; visitReport?: string;
  checkIns?: { at: string; lat: number; lng: number; accuracyM?: number }[]; title: string; description?: string; assigneeId: string;
  assigneeName: string; dueAt: string; priority: string; status: string; leadId?: string; consultationId?: string;
  customerId?: string; customerName?: string; followUpType?: string; meetingMethod?: string; location?: string;
  notes?: string; outcome?: string; isOverdue?: boolean; history?: { at: string; by: string; event: string }[];
}
export interface LeadDetail extends Lead {
  activities: Activity[];
  quotations: { quotationId: string; quotationNumber: string; status: string; grandTotal: number; createdAt: string; validUntil: string }[];
  tasks: Task[];
  consultations: { consultationId: string; cropName: string; status: string; severity: string; expertName?: string; createdAt: string }[];
  permissions: { edit: boolean; assign: boolean; quote: boolean; communicate: boolean; claim: boolean };
}
export interface CrmDashboard {
  scope: string;
  leads: { total: number; new: number; createdLast7Days: number; byStage: Record<string, number>; manual: number;
           expertConsultation: number; unassigned: number; won: number; lost: number; conversionRate: number | null };
  tasks: { followUpsDueToday: number; overdue: number; upcomingAppointments: number; openTotal: number };
  quotations: { created: number; pendingApproval: number; shared: number; accepted: number; byStatus: Record<string, number> };
  recentActivities: Activity[];
}

export const LEAD_STAGES = ['NEW', 'CONTACT_PENDING', 'CONTACTED', 'REQUIREMENT_IDENTIFIED', 'EXPERT_CONSULTATION',
  'RECOMMENDATION_PROVIDED', 'QUOTATION_SHARED', 'NEGOTIATION', 'WON', 'LOST'];
export const LEAD_SOURCES = ['PHONE_CALL', 'WHATSAPP', 'FIELD_VISIT', 'REFERRAL', 'CAMPAIGN', 'WEBSITE', 'EXPERT_CONSULTATION', 'OTHER'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const crmApi = {
  dashboard: () => api.get<CrmDashboard>('/crm/dashboard'),
  pipeline: () => api.get<{ stages: { stage: string; count: number; items: Lead[] }[] }>('/crm/pipeline'),
  reports: () => api.get<any>('/crm/reports'),
  activities: () => api.get<{ items: Activity[] }>('/crm/activities'),
  leads: (p: { view?: string; stage?: string; source?: string; q?: string }, cursor?: string) =>
    api.get<Page<Lead>>(`/crm/leads${qs({ ...p, cursor })}`),
  duplicates: (phone: string) => api.get<{ items: Lead[] }>(`/crm/leads/duplicates${qs({ phone })}`),
  create: (body: object) => api.post<Lead>('/crm/leads', body),
  get: (id: string) => api.get<LeadDetail>(`/crm/leads/${id}`),
  update: (id: string, body: object) => api.put<Lead>(`/crm/leads/${id}`, body),
  stage: (id: string, stage: string, reason?: string) => api.put<Lead>(`/crm/leads/${id}/stage`, { stage, reason }),
  owner: (id: string, ownerId: string) => api.put<Lead>(`/crm/leads/${id}/owner`, { ownerId }),
  expert: (id: string, expertId: string) => api.put<Lead>(`/crm/leads/${id}/expert`, { expertId }),
  note: (id: string, text: string) => api.post<Activity>(`/crm/leads/${id}/notes`, { text }),
  call: (id: string, body: { outcome: string; notes?: string; durationSec?: number; nextFollowUpAt?: string | null }) =>
    api.post<Activity>(`/crm/leads/${id}/calls`, body),
  whatsapp: (id: string, kind: string, text?: string, send = false) =>
    api.post<{ url?: string; text: string; sent?: boolean }>(`/crm/leads/${id}/whatsapp`, { kind, text, send }),
  customer: (customerId: string) => api.get<any>(`/crm/customers/${customerId}`),
  dailyReport: (date?: string, userId?: string) => api.get<any>(`/crm/daily-report${qs({ date, userId })}`),
  performance: (days = 30) => api.get<{ days: number; since: string; items: any[] }>(`/crm/performance${qs({ days })}`),
  targets: (month?: string) => api.get<{ month: string; items: any[]; note: string }>(`/crm/targets${qs({ month })}`),
  setTarget: (body: { month: string; userId: string; revenue: number; wonLeads: number }) => api.put<any>('/crm/targets', body),
};

// ── Quotations ───────────────────────────────────────────────────────────────

export interface QuotationItem {
  /** Omitted in the customer view — customers have no catalogue access. */
  productId?: string; name: string; description?: string; unit: string; quantity: number; unitPrice: number;
  discountPct: number; discountAmount: number; taxRatePct: number; taxAmount: number; subtotal: number; lineTotal: number;
}
export interface Quotation {
  quotationId: string; quotationNumber: string; leadId?: string; customerId?: string; customerName: string;
  customerPhone?: string; customerLocation?: string; items: QuotationItem[]; subtotal: number; discountTotal: number;
  taxTotal: number; deliveryCharge: number; grandTotal: number; validUntil: string; validityDays: number;
  paymentTerms: string; deliveryTerms: string; notes?: string; status: string; createdByName?: string;
  approvedByName?: string; createdAt: string; requiresApproval?: boolean; warnings?: string[]; rejectionReason?: string;
  customerComment?: string; approvalHistory?: { event: string; byName: string; note?: string; at: string }[];
  permissions?: { edit: boolean; approve: boolean; share: boolean; recordResponse: boolean };
  /** Customer view only. */
  companyContact?: string;
  /** Internal view only: questions the customer asked about this quotation. */
  clarifications?: { message: string; at: string }[];
}
export type QuoteLineInput = { productId: string; quantity: number; discountPct?: number };

export const quotationApi = {
  list: (p: { status?: string; leadId?: string }, cursor?: string) => api.get<Page<Quotation>>(`/quotations${qs({ ...p, cursor })}`),
  get: (id: string) => api.get<Quotation>(`/quotations/${id}`),
  preview: (items: QuoteLineInput[], deliveryCharge: number) =>
    api.post<Omit<Quotation, 'quotationId'>>('/quotations/preview', { items, deliveryCharge }),
  create: (body: object) => api.post<Quotation>('/quotations', body),
  update: (id: string, body: object) => api.put<Quotation>(`/quotations/${id}`, body),
  submit: (id: string) => api.post<Quotation>(`/quotations/${id}/submit`, {}),
  approve: (id: string, note?: string) => api.post<Quotation>(`/quotations/${id}/approve`, { note }),
  reject: (id: string, reason: string) => api.post<Quotation>(`/quotations/${id}/reject`, { reason }),
  share: (id: string, channel: 'WHATSAPP' | 'WHATSAPP_API' | 'IN_APP') =>
    api.post<{ quotation: Quotation; text: string; url?: string }>(`/quotations/${id}/share`, { channel }),
  respond: (id: string, decision: 'ACCEPT' | 'REJECT', comment?: string) =>
    api.post<Quotation>(`/quotations/${id}/respond`, { decision, comment }),
  cancel: (id: string, reason?: string) => api.post<Quotation>(`/quotations/${id}/cancel`, { reason }),
  clarify: (id: string, message: string) => api.post<{ sent: boolean }>(`/quotations/${id}/clarify`, { message }),
  document: (id: string) => api.get<{ html: string; fileName: string }>(`/quotations/${id}/document`),
};

// ── Tasks ────────────────────────────────────────────────────────────────────

export const taskApi = {
  list: (p: { scope?: string; kind?: string; status?: string; leadId?: string; overdue?: string; from?: string; to?: string }, cursor?: string) =>
    api.get<Page<Task>>(`/tasks${qs({ ...p, cursor })}`),
  get: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: (body: object) => api.post<Task>('/tasks', body),
  update: (id: string, body: object) => api.put<Task>(`/tasks/${id}`, body),
};

// ── Notification inbox & announcements ──────────────────────────────────────

export interface InboxItem {
  userId: string; recipientKey: string; notifId: string; title: string; message: string; type: string;
  priority: string; actionLink?: string; createdAt: string; expiresAt?: string; isRead: boolean; readAt?: string;
  isDismissed: boolean; dismissedAt?: string; bannerVisible: boolean; isExpired: boolean;
}
export const inboxApi = {
  list: (cursor?: string) => api.get<Page<InboxItem>>(`/notifications/inbox${qs({ cursor })}`),
  banners: () => api.get<{ items: InboxItem[] }>('/notifications/inbox/banners'),
  unreadCount: () => api.get<{ count: number }>('/notifications/inbox/unread-count'),
  read: (key: string) => api.post<InboxItem>(`/notifications/inbox/${encodeURIComponent(key)}/read`, {}),
  dismiss: (key: string) => api.post<InboxItem>(`/notifications/inbox/${encodeURIComponent(key)}/dismiss`, {}),
  readAll: () => api.post<{ updated: number }>('/notifications/inbox/read-all', {}),
};
export const announcementApi = {
  list: (cursor?: string) => api.get<Page<any>>(`/notifications${qs({ cursor })}`),
  create: (body: object) => api.post<any>('/notifications', body),
  stats: (id: string) => api.get<{ recipients: number; delivered: number; read: number; dismissed: number; deliveryStatus: string; channelStatus: Record<string, string>; push?: Record<string, number> }>(`/notifications/${id}/stats`),
  remove: (id: string) => api.delete(`/notifications/${id}`),
};

// ── AI ───────────────────────────────────────────────────────────────────────

export interface AiStatus {
  enabled: boolean; anyAvailable: boolean; message: string | null;
  features: Record<string, { available: boolean; reason: string | null; label: string }>;
}
export interface AiResult {
  feature: string; text: string; provider: string; model: string; disclaimer?: string | null; fallbackUsed: boolean;
  suggestedProducts?: { productId: string; name: string; unit: string; price: number; quantity: number; reason: string }[];
  droppedSuggestions?: number;
}
export const aiApi = {
  status: () => api.get<AiStatus>('/ai/status'),
  assist: (body: { feature: string; mode?: string; prompt?: string; leadId?: string; consultationId?: string;
                   imageBase64?: string; imageType?: string }) => api.post<AiResult>('/ai/assist', body),
  config: () => api.get<any>('/ai/config'),
  saveConfig: (body: object) => api.put<any>('/ai/config', body),
  test: (provider: string, body: { apiKey?: string; model?: string } = {}) =>
    api.post<{ ok: boolean; models: string[]; generationOk: boolean | null; error: string | null }>(`/ai/test/${provider}`, body),
  usage: () => api.get<{ days: any[] }>('/ai/usage'),
};

// ── Team, profile, admin ─────────────────────────────────────────────────────

export interface TeamUser {
  userId: string; name: string; phone: string; email?: string; role: string; isActive: boolean;
  specializations?: string[]; isAvailable?: boolean; activeConsultationCount?: number; maxActiveConsultations?: number;
  department?: string; jobTitle?: string; responsibilities?: string; qualifications?: string; experienceYears?: number;
  createdAt?: string;
}
export const teamApi = {
  list: (role?: string, q?: string) => api.get<{ items: TeamUser[] }>(`/users${qs({ role, q })}`),
  get: (id: string) => api.get<TeamUser>(`/users/${id}`),
  create: (body: object) => api.post<TeamUser>('/users', body),
  update: (id: string, body: object) => api.put<TeamUser>(`/users/${id}`, body),
  assignable: (role: 'STAFF' | 'EXPERT' | 'ADMIN') => api.get<{ items: TeamUser[] }>(`/users/assignable${qs({ role })}`),
  experts: () => api.get<{ experts: any[]; coverage: { crop: string; tier: string }[]; awaitingAssignment: number; hasGeneralExpert: boolean }>('/users/experts'),
};
export const profileApi = {
  get: () => api.get<any>('/profile'),
  update: (body: object) => api.put<any>('/profile', body),
  photo: (image: string, contentType: string) => api.post<any>('/profile/photo', { image, contentType }),
};
export const adminApi = {
  dashboard: () => api.get<any>('/dashboard'),
  setting: (key: 'assignment' | 'quotation' | 'permissions') => api.get<any>(`/admin/settings/${key}`),
  saveSetting: (key: 'assignment' | 'quotation' | 'permissions', value: object) => api.put<any>(`/admin/settings/${key}`, { value }),
  permissions: () => api.get<any>('/admin/permissions'),
  audit: (p: { day?: string; entityId?: string }, cursor?: string) => api.get<Page<any>>(`/admin/audit-logs${qs({ ...p, cursor })}`),
};
export const productApi = {
  list: (cursor?: string) => api.get<Page<{ productId: string; name: string; price: number; unit: string; stock: number;
                                            category: string; description: string; imageUrl?: string; isActive: boolean }>>(`/products${qs({ cursor })}`),
};

// ── Automation rule builder ──────────────────────────────────────────────────

export interface AutomationRule {
  enabled: boolean; label: string; description: string;
  followUpAfterHours?: number; requiresApproval?: boolean; failureThreshold?: number;
}
export interface AutomationRun {
  runId: string; ruleId: string; targetType: string; targetId: string; period: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  detail: string; createdAt: string; attempts: number; payload?: { suggestedMessage?: string; quotationNumber?: string };
}
export const automationApi = {
  rules: () => api.get<{ rules: Record<string, AutomationRule> }>('/automation/rules'),
  updateRule: (ruleId: string, body: object) => api.put<AutomationRule>(`/automation/rules/${ruleId}`, body),
  runs: (p: { ruleId?: string; status?: string } = {}) => api.get<{ items: AutomationRun[] }>(`/automation/runs${qs(p)}`),
  retry: (runId: string) => api.post<AutomationRun>(`/automation/runs/${runId}/retry`, {}),
  approve: (runId: string) => api.post<AutomationRun>(`/automation/runs/${runId}/approve`, {}),
  reject: (runId: string) => api.post<AutomationRun>(`/automation/runs/${runId}/reject`, {}),
};

// ── WhatsApp Business ───────────────────────────────────────────────────────

export const whatsappApi = {
  status: () => api.get<{ enabled: boolean }>('/whatsapp/status'),
  config: () => api.get<any>('/whatsapp/config'),
  saveConfig: (body: object) => api.put<any>('/whatsapp/config', body),
  test: (to: string) => api.post<{ ok: boolean; error?: string; messageId?: string; note?: string }>('/whatsapp/test', { to }),
};
