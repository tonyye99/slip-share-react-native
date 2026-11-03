export const Colors = {
  light: {
    text: '#10181B',
    textSecondary: '#62676E',
    background: '#F5F6F8',
    surface: '#FFFFFF',
    backgroundElement: '#EEF0F3',
    backgroundSelected: '#E2E5EA',
    border: '#D5D8DD',
    hairline: '#E6E8EC',
    primary: '#1768D1',
    onPrimary: '#FFFFFF',
    primarySoft: '#E9F1FC',
    primaryTint: '#F4F7FE',
    panelTint: '#ECF1F7',
    success: '#12715B',
    successSoft: '#E3F4EE',
    warning: '#9A4A08',
    warningSoft: '#FDF1E4',
    danger: '#B3261E',
    dangerSoft: '#FCECEB',
    destructive: '#D92D20',
    glass: 'rgba(255, 255, 255, 0.84)',
    onPerson: '#FFFFFF',
  },
  dark: {
    text: '#ECEEF0',
    textSecondary: '#A3A8AF',
    background: '#0E1114',
    surface: '#181C20',
    backgroundElement: '#22272C',
    backgroundSelected: '#2C3238',
    border: '#3A4047',
    hairline: '#2A2F35',
    primary: '#4A90E2',
    onPrimary: '#FFFFFF',
    primarySoft: '#1B2C44',
    primaryTint: '#152234',
    panelTint: '#152234',
    success: '#4CC29F',
    successSoft: '#143229',
    warning: '#F0A65A',
    warningSoft: '#3A2814',
    danger: '#FF7A6E',
    dangerSoft: '#3D1D1A',
    destructive: '#D92D20',
    glass: 'rgba(24, 28, 32, 0.84)',
    onPerson: '#0E1114',
  },
} as const

export type ThemeColors = { [K in keyof typeof Colors.light]: string }

export const PersonColors = ['#1768D1', '#C3410D', '#0E766D', '#7A3EB1', '#B4235F', '#5E6B12', '#8A5A00', '#2F4F9E'] as const
export const PersonColorsDark = ['#5AA8F5', '#F2A06B', '#3CC4A6', '#B794F4', '#F48FB1', '#B5C36A', '#E3B04B', '#8FA8F0'] as const

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
  pill: 999,
} as const

export const MaxContentWidth = 800
