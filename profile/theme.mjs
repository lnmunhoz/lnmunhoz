// Colours for the light and dark cards. Surfaces match GitHub's own
// (canvas.subtle), so the cards sit naturally on the profile page.
// Series colours are the validated blue/orange pair: both pass the
// colour-blind separation and 3:1 contrast checks on these surfaces.

export const THEMES = {
  light: {
    dark: false,
    surface: '#f6f8fa',
    border: '#d1d9e0',
    text: '#1f2328',
    text2: '#59636e',
    muted: '#6e7781',
    grid: '#e3e8ed',
    axis: '#c4ccd4',
    band: '#eceff3',
    blue: '#2a78d6',
    orange: '#eb6834',
    other: '#8c959f',
    building: '#9fb5d3',
    window: '#f6f8fa',
    nowWindow: '#fde3d4',
  },
  dark: {
    dark: true,
    surface: '#151b23',
    border: '#3d444d',
    text: '#f0f6fc',
    text2: '#9198a1',
    muted: '#7d8590',
    grid: '#262c36',
    axis: '#3d444d',
    band: '#1c232d',
    blue: '#3987e5',
    orange: '#d95926',
    other: '#656c76',
    building: '#2a3a55',
    window: '#f2c66d',
    nowWindow: '#ffd9b8',
  },
};
