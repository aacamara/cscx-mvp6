/**
 * CSCX.AI Font Settings Types
 * PRD-274: Font Size Customization
 *
 * Type definitions for font size customization feature
 * including scale presets, user preferences, and keyboard shortcuts.
 */

// ============================================
// Font Size Scale Types
// ============================================

/**
 * Available font size preset names
 */
export type FontSizePreset = 'small' | 'normal' | 'large' | 'xlarge' | 'xxlarge';

/**
 * Font scale values (multipliers)
 */
export const FONT_SCALES: Record<FontSizePreset, number> = {
  small: 0.875,    // 87.5% - 14px base
  normal: 1,       // 100% - 16px base
  large: 1.125,    // 112.5% - 18px base
  xlarge: 1.25,    // 125% - 20px base
  xxlarge: 1.5,    // 150% - 24px base
} as const;

/**
 * Font size metadata for UI display
 */
export interface FontSizeOption {
  preset: FontSizePreset;
  scale: number;
  label: string;
  percentage: string;
  baseSize: string;
}

/**
 * All font size options with display metadata
 */
export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { preset: 'small', scale: 0.875, label: 'Small', percentage: '87.5%', baseSize: '14px' },
  { preset: 'normal', scale: 1, label: 'Normal', percentage: '100%', baseSize: '16px' },
  { preset: 'large', scale: 1.125, label: 'Large', percentage: '112.5%', baseSize: '18px' },
  { preset: 'xlarge', scale: 1.25, label: 'Extra Large', percentage: '125%', baseSize: '20px' },
  { preset: 'xxlarge', scale: 1.5, label: 'Maximum', percentage: '150%', baseSize: '24px' },
];

// ============================================
// User Preferences Types
// ============================================

/**
 * Font settings stored in user preferences
 */
export interface FontPreferences {
  fontSize: FontSizePreset;
  fontScale: number;
  respectOSPreference: boolean;
  lastUpdated?: string;
}

/**
 * Default font preferences
 */
export const DEFAULT_FONT_PREFERENCES: FontPreferences = {
  fontSize: 'normal',
  fontScale: 1,
  respectOSPreference: true,
};

// ============================================
// API Types
// ============================================

/**
 * Request body for saving font preferences
 */
export interface SaveFontPreferencesRequest {
  fontSize: FontSizePreset;
  fontScale: number;
  respectOSPreference?: boolean;
}

/**
 * Response from font preferences endpoint
 */
export interface FontPreferencesResponse {
  success: boolean;
  data?: FontPreferences;
  error?: string;
}

// ============================================
// Context Types
// ============================================

/**
 * Font size context value type
 */
export interface FontSizeContextValue {
  // Current state
  fontSize: FontSizePreset;
  fontScale: number;
  respectOSPreference: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setFontSize: (preset: FontSizePreset) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  setRespectOSPreference: (value: boolean) => void;

  // Metadata
  fontScales: typeof FONT_SCALES;
  fontSizeOptions: typeof FONT_SIZE_OPTIONS;
  getCurrentOption: () => FontSizeOption;
}

// ============================================
// Keyboard Shortcut Types
// ============================================

/**
 * Keyboard shortcut configuration
 */
export interface FontSizeKeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  action: 'increase' | 'decrease' | 'reset';
  description: string;
}

/**
 * Default keyboard shortcuts for font size control
 */
export const FONT_SIZE_SHORTCUTS: FontSizeKeyboardShortcut[] = [
  { key: '=', ctrlKey: true, action: 'increase', description: 'Increase font size' },
  { key: '+', ctrlKey: true, action: 'increase', description: 'Increase font size' },
  { key: '-', ctrlKey: true, action: 'decrease', description: 'Decrease font size' },
  { key: '0', ctrlKey: true, action: 'reset', description: 'Reset font size' },
  // Mac support with Cmd key
  { key: '=', metaKey: true, action: 'increase', description: 'Increase font size' },
  { key: '+', metaKey: true, action: 'increase', description: 'Increase font size' },
  { key: '-', metaKey: true, action: 'decrease', description: 'Decrease font size' },
  { key: '0', metaKey: true, action: 'reset', description: 'Reset font size' },
];

// ============================================
// Testing Matrix Types (for documentation)
// ============================================

/**
 * Expected computed sizes at each scale
 * Used for testing and verification
 */
export interface FontSizeTestMatrix {
  preset: FontSizePreset;
  scale: number;
  bodyText: string;
  headers: string;
  buttons: string;
}

export const FONT_SIZE_TEST_MATRIX: FontSizeTestMatrix[] = [
  { preset: 'small', scale: 0.875, bodyText: '14px', headers: '21px', buttons: '12px' },
  { preset: 'normal', scale: 1, bodyText: '16px', headers: '24px', buttons: '14px' },
  { preset: 'large', scale: 1.125, bodyText: '18px', headers: '27px', buttons: '16px' },
  { preset: 'xlarge', scale: 1.25, bodyText: '20px', headers: '30px', buttons: '18px' },
  { preset: 'xxlarge', scale: 1.5, bodyText: '24px', headers: '36px', buttons: '21px' },
];

// ============================================
// Utility Functions
// ============================================

/**
 * Get the next larger font size preset
 */
export function getNextLargerPreset(current: FontSizePreset): FontSizePreset | null {
  const presets: FontSizePreset[] = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];
  const currentIndex = presets.indexOf(current);
  if (currentIndex < presets.length - 1) {
    return presets[currentIndex + 1];
  }
  return null;
}

/**
 * Get the next smaller font size preset
 */
export function getNextSmallerPreset(current: FontSizePreset): FontSizePreset | null {
  const presets: FontSizePreset[] = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];
  const currentIndex = presets.indexOf(current);
  if (currentIndex > 0) {
    return presets[currentIndex - 1];
  }
  return null;
}

/**
 * Get font size option by preset name
 */
export function getFontSizeOption(preset: FontSizePreset): FontSizeOption {
  return FONT_SIZE_OPTIONS.find(opt => opt.preset === preset) || FONT_SIZE_OPTIONS[1];
}

/**
 * Validate if a string is a valid font size preset
 */
export function isValidFontSizePreset(value: string): value is FontSizePreset {
  return ['small', 'normal', 'large', 'xlarge', 'xxlarge'].includes(value);
}
