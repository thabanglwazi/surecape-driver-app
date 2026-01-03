// SureCape Brand Colors
export const Colors = {
  // Primary Brand Colors
  primary: '#008080',          // SureCape Teal
  primaryDark: '#006666',      // Darker Teal
  primaryLight: '#00A0A0',     // Lighter Teal
  
  // Status Colors
  success: '#34C759',          // Green
  warning: '#FF9500',          // Orange
  error: '#FF3B30',            // Red
  info: '#007AFF',             // Blue
  
  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  gray: '#8E8E93',
  grayLight: '#C7C7CC',
  grayLighter: '#E5E5EA',
  background: '#F5F5F5',
  
  // Text Colors
  textPrimary: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',
  
  // Status-specific colors
  statusAssigned: '#FF9500',
  statusConfirmed: '#008080',
  statusInProgress: '#006666',
  statusCompleted: '#34C759',
  statusCancelled: '#FF3B30',
};

// Typography
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: Colors.textPrimary,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: 'normal' as const,
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    color: Colors.textLight,
  },
};

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

// Shadows
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Brand Information
export const Brand = {
  name: 'SureCape Transport',
  shortName: 'SureCape',
  tagline: 'Your trusted transportation partner',
  supportEmail: 'support@surecape.co.za',
  supportPhone: '+27 XX XXX XXXX',
  website: 'https://surecape.co.za',
};
