// SlipShare design system, from the Claude Design split screen redesign.
// Grey page, white cards, one strong blue for actions, and a colour per person.

export const Colors = {
  light: {
    text: '#10181B',
    textSecondary: '#62676E',
    /** The grey page behind cards. */
    background: '#F5F6F8',
    /** Cards, inputs, sheets and bars. */
    surface: '#FFFFFF',
    /** Quiet fills: tags, pressed rows, empty states. */
    backgroundElement: '#EEF0F3',
    backgroundSelected: '#E2E5EA',
    border: '#D5D8DD',
    hairline: '#E6E8EC',
    primary: '#1768D1',
    onPrimary: '#FFFFFF',
    /** Pale blue behind something selected or highlighted. */
    primarySoft: '#E9F1FC',
    primaryTint: '#F4F7FE',
    success: '#12715B',
    successSoft: '#E3F4EE',
    warning: '#9A4A08',
    warningSoft: '#FDF1E4',
    danger: '#B3261E',
    dangerSoft: '#FCECEB',
    /** Solid red behind a white icon, like the swipe-to-delete button. */
    destructive: '#D92D20',
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
    success: '#4CC29F',
    successSoft: '#143229',
    warning: '#F0A65A',
    warningSoft: '#3A2814',
    danger: '#FF7A6E',
    dangerSoft: '#3D1D1A',
    destructive: '#D92D20',
  },
} as const

export type ThemeColors = { [K in keyof typeof Colors.light]: string }

/** One colour per person, in the order they join the bill. White text sits on each. */
export const PersonColors = ['#1768D1', '#C3410D', '#0E766D', '#7A3EB1', '#B4235F', '#5E6B12', '#8A5A00', '#2F4F9E'] as const

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
