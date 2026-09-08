/**
 * Outbox Labs Design Tokens
 */

export const TOKENS = {
  colors: {
    // Primary Actions & Branding
    brandPrimary: '#00A343',      // Main green CTA buttons
    brandHover: '#008A38',        // Hover green
    brandSoftBg: '#E8F5E9',       // Google OAuth button & chip backgrounds
    brandBorder: '#A7F3D0',       // Chip border

    // Text hierarchy
    textPrimary: '#111827',       // Dark headers and primary text
    textSecondary: '#6B7280',     // Subtle gray labels and metadata
    textMuted: '#9CA3AF',         // Placeholders

    // Neutral Surfaces & Lines
    bgCanvas: '#FFFFFF',          // Pure white page background
    bgSidebar: '#F9FAFB',         // Subtle sidebar background
    bgInput: '#F3F4F6',           // Login input background
    borderLight: '#E5E7EB',       // Card and table borders

    // Badge Tags
    scheduledTag: {
      bg: '#FEF3C7',              // Soft warm amber pill
      text: '#D97706',            // Amber text
      border: '#FDE68A',
    },
    sentTag: {
      bg: '#E8F5E9',              // Soft green pill
      text: '#008A38',
      border: '#A7F3D0',
    },
    rescheduledTag: {
      bg: '#EDE9FE',              // Soft purple pill
      text: '#6D28D9',
      border: '#DDD6FE',
    },
    failedTag: {
      bg: '#FEE2E2',              // Soft red pill
      text: '#DC2626',
      border: '#FECACA',
    },
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
  },
  borderRadius: {
    button: '8px',
    pill: '9999px',
    card: '12px',
    input: '8px',
  },
} as const;
