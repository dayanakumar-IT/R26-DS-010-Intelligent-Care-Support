// One colour family per category (My Journey stage marker, sign chips and
// category badge). `solid` is the -700 shade: at least 4.5:1 against white
// and against `soft`, so it works as text on light chips and as the
// background of white text on solid chips. Colour is never the only cue:
// every chip also has an icon and a word.

export interface ColorFamily {
  name: string
  solid: string
  dark: string
  soft: string
  border: string
  light: string
}

const FAMILIES: Record<string, ColorFamily> = {
  blue: { name: 'blue', solid: '#1d4ed8', dark: '#1e3a8a', soft: '#eff6ff', border: '#bfdbfe', light: '#93c5fd' },
  pink: { name: 'pink', solid: '#be185d', dark: '#831843', soft: '#fdf2f8', border: '#fbcfe8', light: '#f9a8d4' },
  green: { name: 'green', solid: '#15803d', dark: '#14532d', soft: '#f0fdf4', border: '#bbf7d0', light: '#86efac' },
  purple: { name: 'purple', solid: '#7e22ce', dark: '#581c87', soft: '#faf5ff', border: '#e9d5ff', light: '#d8b4fe' },
  teal: { name: 'teal', solid: '#0f766e', dark: '#134e4a', soft: '#f0fdfa', border: '#99f6e4', light: '#5eead4' },
  amber: { name: 'amber', solid: '#b45309', dark: '#78350f', soft: '#fffbeb', border: '#fde68a', light: '#fcd34d' },
  coral: { name: 'coral', solid: '#b93a1f', dark: '#7c2414', soft: '#fff4f0', border: '#fdcbbd', light: '#fb9a80' },
}

const BY_CATEGORY: Record<string, keyof typeof FAMILIES> = {
  greetings: 'blue',
  food_drink: 'pink',
  daily_actions: 'green',
  body_parts: 'purple',
  health_medical: 'teal',
  emotion: 'amber',
  emergency: 'coral',
}

export function categoryColors(categoryKey: string): ColorFamily {
  return FAMILIES[BY_CATEGORY[categoryKey] ?? 'blue']
}

// Level path and level badges use the app's brand blue.
export const LEVEL_COLORS = FAMILIES.blue
