export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const typography = {
  display: 30,
  title: 22,
  heading: 17,
  body: 15,
  label: 13,
  caption: 11,
} as const;
export const dark = {
  background: '#07111F',
  surface: '#0D1B2D',
  surfaceRaised: '#13243A',
  border: '#203650',
  text: '#F5F9FF',
  textMuted: '#8FA4BC',
  primary: '#2DA8FF',
  primarySoft: '#102F4B',
  cyan: '#38D5D0',
  success: '#46D49A',
  warning: '#FFB84D',
  danger: '#FF667A',
  overlay: 'rgba(2,8,16,0.72)',
  player: '#02060C',
} as const;
export const light = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceRaised: '#EAF1F8',
  border: '#D5E0EB',
  text: '#102036',
  textMuted: '#5D7088',
  primary: '#0074C8',
  primarySoft: '#E0F2FF',
  cyan: '#008E8A',
  success: '#147A52',
  warning: '#A85C00',
  danger: '#C72F48',
  overlay: 'rgba(6,18,32,0.54)',
  player: '#02060C',
} as const;
export type ThemeColors = typeof dark | typeof light;
