/**
 * BillDoor Native Mobile App — Design Tokens & Dynamic Theme Engine
 * Supports Light & Dark themes dynamically with backwards compatible theme object.
 */

export interface ThemeColors {
  accent: string;
  accentHover: string;
  accentSubtle: string;
  accentText: string;
  bgPrimary: string;
  bgSecondary: string;
  bgElevated: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSubtle: string;
  borderFocus: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  error: string;
  errorSubtle: string;
  info: string;
  infoSubtle: string;
}

export const lightTheme: ThemeColors = {
  accent: '#088395',
  accentHover: '#056674',
  accentSubtle: '#E6F3F5',
  accentText: '#FFFFFF',
  bgPrimary: '#FFFFFF',
  bgSecondary: '#FAFAFA',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#6B6B6F',
  textTertiary: '#9A9A9E',
  border: '#EAEAEA',
  borderSubtle: '#F5F5F5',
  borderFocus: '#088395',
  success: '#2D9F6F',
  successSubtle: '#E8F7F0',
  warning: '#D4873E',
  warningSubtle: '#FDF3E9',
  error: '#D94452',
  errorSubtle: '#FDE8EA',
  info: '#3B82B8',
  infoSubtle: '#E8F0FA',
};

export const darkTheme: ThemeColors = {
  accent: '#088395',
  accentHover: '#056674',
  accentSubtle: 'rgba(8, 131, 149, 0.2)',
  accentText: '#FFFFFF',
  bgPrimary: '#111111',
  bgSecondary: '#1A1A1A',
  bgElevated: '#222222',
  bgCard: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A5',
  textTertiary: '#66666B',
  border: '#2E2E32',
  borderSubtle: '#222225',
  borderFocus: '#088395',
  success: '#2D9F6F',
  successSubtle: 'rgba(45, 159, 111, 0.15)',
  warning: '#D4873E',
  warningSubtle: 'rgba(212, 135, 62, 0.15)',
  error: '#D94452',
  errorSubtle: 'rgba(217, 68, 82, 0.15)',
  info: '#3B82B8',
  infoSubtle: 'rgba(59, 130, 184, 0.15)',
};

export const themeDimensions = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    full: 9999,
  },
  typography: {
    fontXs: 12,
    fontSm: 13,
    fontBase: 14,
    fontMd: 16,
    fontLg: 18,
    fontXl: 22,
    font2xl: 26,
  },
};

export const theme = {
  colors: darkTheme,
  spacing: themeDimensions.spacing,
  radius: themeDimensions.radius,
  typography: themeDimensions.typography,
};
