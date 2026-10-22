export const COLORS = {
  primary: '#2E7D32', // Green for agriculture
  secondary: '#FF8F00', // Orange/Amber
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  error: '#D32F2F',
  success: '#388E3C',
  border: '#E0E0E0',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
};

// ── Ant Design-inspired tokens for the CRM / consultation / settings screens ──
// Neutral surfaces with agricultural green as the single brand accent. Existing
// screens keep using COLORS/SPACING/BORDER_RADIUS above; these extend them.
export const TOKENS = {
  colorPrimary: COLORS.primary,
  colorPrimaryBg: '#EDF7ED',
  colorPrimaryBorder: '#B7DDB9',
  colorText: '#1F1F1F',
  colorTextSecondary: '#595959',
  colorTextTertiary: '#8C8C8C',
  colorBorder: '#E5E7EB',
  colorSplit: '#F0F0F0',
  colorBgLayout: '#F6F8F6',
  colorBgContainer: '#FFFFFF',
  colorSuccess: '#389E0D',
  colorWarning: '#D48806',
  colorError: '#CF1322',
  colorInfo: '#0958D9',
  radius: 10,
  radiusSm: 6,
  radiusLg: 14,
  controlHeight: 44,      // ≥44pt touch targets
};

export const TYPE = {
  h1: { fontSize: 22, fontWeight: '700' as const, color: TOKENS.colorText },
  h2: { fontSize: 18, fontWeight: '700' as const, color: TOKENS.colorText },
  h3: { fontSize: 15.5, fontWeight: '600' as const, color: TOKENS.colorText },
  body: { fontSize: 14.5, color: TOKENS.colorText, lineHeight: 21 },
  secondary: { fontSize: 13, color: TOKENS.colorTextSecondary, lineHeight: 19 },
  caption: { fontSize: 11.5, color: TOKENS.colorTextTertiary },
  label: { fontSize: 12.5, fontWeight: '600' as const, color: TOKENS.colorTextSecondary, letterSpacing: 0.2 },
};

// Semantic tag palette: [text, background, border]
export const TAG_COLORS: Record<string, [string, string, string]> = {
  green:  ['#237804', '#F6FFED', '#B7EB8F'],
  blue:   ['#0958D9', '#E6F4FF', '#91CAFF'],
  orange: ['#AD4E00', '#FFF7E6', '#FFD591'],
  red:    ['#A8071A', '#FFF1F0', '#FFA39E'],
  purple: ['#531DAB', '#F9F0FF', '#D3ADF7'],
  gold:   ['#874D00', '#FFFBE6', '#FFE58F'],
  cyan:   ['#006D75', '#E6FFFB', '#87E8DE'],
  default:['#434343', '#FAFAFA', '#D9D9D9'],
};
