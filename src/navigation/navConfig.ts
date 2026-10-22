import {
  Home, Bell, ListChecks, Sprout, HeartPulse, Stethoscope, ClipboardList, Sparkles, LayoutDashboard, Users, Columns3,
  UserPlus, Package, FileText, CalendarClock, Activity, BarChart3, UserCircle, MessagesSquare, ShieldCheck, GitBranch,
  Megaphone, ScrollText, Settings, CloudRain, ShoppingBag, ShoppingCart, Truck, BookOpen, MessageSquare, AlertTriangle,
  Thermometer, TrendingUp, Gauge, Phone, CalendarDays, MapPin, Target,
} from 'lucide-react-native';
import { UserRole } from '../types/domain';

export interface NavItem {
  label: string;
  icon: any;
  screen: string;
  params?: object;
  show?: (ctx: NavCtx) => boolean;
}
export interface NavSection { title: string; items: NavItem[]; show?: (ctx: NavCtx) => boolean }
export interface NavCtx { role: UserRole; can: (p: string) => boolean }

const isAdmin = ({ role }: NavCtx) => role === 'ADMIN' || role === 'SUPER_ADMIN';
const isSuper = ({ role }: NavCtx) => role === 'SUPER_ADMIN';
const isCustomer = ({ role }: NavCtx) => role === 'FARMER';
const internal = (c: NavCtx) => !isCustomer(c);

/** Home route for each role's stack. */
export const homeRoute = (role: UserRole): { screen: string; params?: object } =>
  role === 'FARMER' ? { screen: 'FarmerTabs', params: { screen: 'Home' } }
    : role === 'ADMIN' || role === 'SUPER_ADMIN' ? { screen: 'AdminTabs', params: { screen: 'Dashboard' } }
    : { screen: 'WorkHome' };

/**
 * Sectioned sidebar. Only sections/items the current role may use are shown;
 * every screen is also protected server-side, so hiding here is convenience only.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', icon: Home, screen: '__home__' },
      { label: 'Platform overview', icon: Gauge, screen: 'AdminOverview', show: isAdmin },
      { label: 'Notifications', icon: Bell, screen: 'Notifications' },
      { label: 'My Tasks', icon: ListChecks, screen: 'TaskList', show: internal },
    ],
  },
  {
    title: 'Farming',
    show: isCustomer,
    items: [
      { label: 'My Farm', icon: Home, screen: 'FarmerTabs', params: { screen: 'Home' } },
      { label: 'My Crops', icon: Sprout, screen: 'CropTrackingHome' },
      { label: 'Crop Health', icon: HeartPulse, screen: 'Symptoms' },
      { label: 'Get Suggestions from Experts', icon: Stethoscope, screen: 'ConsultationRequest' },
      { label: 'My Consultations', icon: ClipboardList, screen: 'ConsultationList' },
      { label: 'AI Farming Assistant', icon: Sparkles, screen: 'AiAssistant' },
      { label: 'Weather', icon: CloudRain, screen: 'RainUpdates' },
      { label: 'Expert Advice (older requests)', icon: BookOpen, screen: 'ExpertAdvice' },
    ],
  },
  {
    title: 'Shop',
    show: isCustomer,
    items: [
      { label: 'Fertilizer Store', icon: ShoppingBag, screen: 'FertilizerList' },
      { label: 'Cart', icon: ShoppingCart, screen: 'Cart' },
      { label: 'Order Track', icon: Truck, screen: 'PurchaseHistory' },
      { label: 'My Quotations', icon: FileText, screen: 'QuotationList' },
      { label: 'Contact Support', icon: MessageSquare, screen: 'Enquiry' },
    ],
  },
  {
    title: 'Consultations',
    show: c => c.role === 'EXPERT' || isAdmin(c) || c.role === 'STAFF',
    items: [
      { label: 'Consultation requests', icon: Stethoscope, screen: 'ConsultationList' },
      { label: 'Unassigned', icon: AlertTriangle, screen: 'ConsultationList', params: { status: 'AWAITING_ASSIGNMENT' }, show: isAdmin },
      { label: 'AI Assistant', icon: Sparkles, screen: 'AiAssistant' },
    ],
  },
  {
    title: 'CRM',
    show: c => c.can('crm.view'),
    items: [
      { label: 'CRM Dashboard', icon: LayoutDashboard, screen: 'CrmDashboard' },
      { label: 'All Leads', icon: Users, screen: 'LeadList', params: { view: 'all' }, show: c => c.can('crm.view_all') },
      { label: 'My Leads', icon: Users, screen: 'LeadList', params: { view: 'mine' }, show: c => c.role !== 'EXPERT' },
      { label: 'Consultation Leads', icon: Users, screen: 'LeadList', params: { source: 'EXPERT_CONSULTATION' } },
      { label: 'Manual Leads', icon: UserPlus, screen: 'LeadList', params: { source: 'MANUAL' }, show: c => c.role !== 'EXPERT' },
      { label: 'Pipeline Board', icon: Columns3, screen: 'Pipeline' },
      { label: 'Products', icon: Package, screen: 'FertilizerList' },
      { label: 'Quotations', icon: FileText, screen: 'QuotationList', show: c => c.can('quotation.view') },
      { label: 'Calls & WhatsApp', icon: Phone, screen: 'ActivityFeed' },
      { label: 'Follow-ups', icon: ListChecks, screen: 'TaskList', params: { kind: 'FOLLOW_UP' } },
      { label: 'Appointments', icon: CalendarClock, screen: 'TaskList', params: { kind: 'APPOINTMENT' } },
      { label: 'Activities', icon: Activity, screen: 'ActivityFeed' },
      { label: 'Reports', icon: BarChart3, screen: 'CrmReports' },
    ],
  },
  {
    title: 'Activities',
    show: c => c.can('tasks.manage'),
    items: [
      { label: 'Calendar', icon: CalendarDays, screen: 'Calendar' },
      { label: 'Tasks', icon: ListChecks, screen: 'TaskList', params: { kind: 'TASK' } },
      { label: 'Daily Report', icon: ClipboardList, screen: 'DailyReport' },
      { label: 'Field Work', icon: MapPin, screen: 'TaskList', params: { kind: 'FIELD_VISIT' } },
      { label: 'Staff Performance', icon: BarChart3, screen: 'Performance', show: c => c.can('reports.team') },
      { label: 'Sales Targets', icon: Target, screen: 'Targets', show: c => c.role !== 'EXPERT' },
    ],
  },
  {
    title: 'Customer Care',
    show: isAdmin,
    items: [
      { label: 'Customer Profiles', icon: UserCircle, screen: 'AddCustomer' },
      { label: 'Consultation History', icon: ClipboardList, screen: 'ConsultationList' },
      { label: 'Communication History', icon: MessagesSquare, screen: 'ActivityFeed' },
      { label: 'Enquiries', icon: MessageSquare, screen: 'EnquiryList' },
    ],
  },
  {
    title: 'Operations',
    show: isAdmin,
    items: [
      { label: 'Manage Stock', icon: Package, screen: 'ManageStock' },
      { label: 'Orders', icon: Truck, screen: 'OrderList' },
      { label: 'Sales Report', icon: TrendingUp, screen: 'SalesReport' },
      { label: 'Register Farmer', icon: UserPlus, screen: 'CreateCustomer' },
      { label: 'Symptom Alerts', icon: AlertTriangle, screen: 'AlertsList' },
      { label: 'Symptom Records', icon: Thermometer, screen: 'SymptomsList' },
      { label: 'Expert Advice (older requests)', icon: BookOpen, screen: 'ExpertAdviceList' },
      { label: 'Update Weather', icon: CloudRain, screen: 'UpdateRain' },
    ],
  },
  {
    title: 'Administration',
    show: c => c.can('users.manage') || c.can('announcements.send') || c.can('ai.configure') || c.can('audit.view') || c.can('integrations.configure'),
    items: [
      { label: 'User Management', icon: Users, screen: 'UserManagement', show: c => c.can('users.manage') },
      { label: 'Add Super Admin / Admin', icon: UserPlus, screen: 'AddAdmin', show: isSuper },
      { label: 'Role Management', icon: ShieldCheck, screen: 'RolePermissions', show: c => c.can('settings.permissions') },
      { label: 'Expert Specializations', icon: Stethoscope, screen: 'ExpertCoverage', show: c => c.can('consultation.assign') },
      { label: 'Assignment Rules', icon: GitBranch, screen: 'AssignmentRules', show: isAdmin },
      { label: 'Quotation Settings', icon: FileText, screen: 'QuotationSettings', show: isAdmin },
      { label: 'Notification Management', icon: Megaphone, screen: 'Announcements', show: c => c.can('announcements.send') },
      { label: 'AI Configuration', icon: Sparkles, screen: 'AiConfig', show: c => c.can('ai.configure') },
      { label: 'WhatsApp Business', icon: MessagesSquare, screen: 'WhatsAppConfig', show: c => c.can('integrations.configure') },
      { label: 'Audit Logs', icon: ScrollText, screen: 'AuditLog', show: c => c.can('audit.view') },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', icon: Settings, screen: 'Settings' },
    ],
  },
];

export const visibleSections = (ctx: NavCtx) =>
  NAV_SECTIONS
    .filter(s => !s.show || s.show(ctx))
    .map(s => ({ ...s, items: s.items.filter(i => !i.show || i.show(ctx)) }))
    .filter(s => s.items.length);
