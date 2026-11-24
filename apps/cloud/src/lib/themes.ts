export const DAISY_THEME_CHOICES = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'business', label: 'Business dark' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'nord', label: 'Nord' },
  { value: 'winter', label: 'Winter' },
  { value: 'silk', label: 'Silk' },
  { value: 'lofi', label: 'Lo-fi' },
] as const;

export type DaisyTheme = (typeof DAISY_THEME_CHOICES)[number]['value'];

export function isDaisyTheme(value: string): value is DaisyTheme {
  return DAISY_THEME_CHOICES.some((theme) => theme.value === value);
}
