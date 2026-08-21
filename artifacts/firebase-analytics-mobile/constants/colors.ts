/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#F4F7FB',
    tint: '#FF755C',

    // Core surfaces
    background: '#0B1220',
    foreground: '#F4F7FB',

    // Cards / elevated surfaces
    card: '#111C2E',
    cardForeground: '#F4F7FB',

    // Primary action color (buttons, links, active states)
    primary: '#FF755C',
    primaryForeground: '#0B1220',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#18253A',
    secondaryForeground: '#D7E0EC',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#18253A',
    mutedForeground: '#8B9AB0',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#23344E',
    accentForeground: '#F4F7FB',

    // Destructive actions (delete, error states)
    destructive: '#F56B6B',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#22314A',
    input: '#2B3C56',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
