// theme.js – central design tokens
console.log('🟡 Theme: Loading theme configuration');

export const palette = {
  /* ---- core brand ---- */
  brandBlue: '#3797EF',          // Instagram-like blue
  brandBlueDark: '#1877F2',
  white: '#FFFFFF',
  grey:  '#8E8E93',
  black: '#000000',

  /* ---- semantic ---- */
  bg:      '#FFFFFF',
  surface: '#FFFFFF',
  border:  '#E1E1E1',
};

/* ---- typography ---- */
export const font = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
};

export const light = {
  brandBlue : '#3797EF',
  surface   : '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  border    : '#E1E1E1',
  text      : '#000000',
  textDim   : '#8E8E93',
  danger    : '#FF3B30',
};

export const dark = {
  brandBlue : '#4590FF',
  surface   : '#000000',
  surfaceAlt: '#1C1C1E',
  border    : '#2C2C2E',
  text      : '#FFFFFF',
  textDim   : '#8E8E93',
  danger    : '#FF453A',
};

/* ---- helpers ---- */
export const spacing = (mult = 1) => 4 * mult;  // 4-pt scale
export const radius  = { card:12, avatar:16, thumb:8, btn:8 };

/**
 * call changePalette({...}) anywhere (e.g. Settings screen)
 * to hot-swap colours without touching components.
 */
export const changePalette = (overrides = {}) => {
  Object.assign(palette, overrides);
};

export const shadow = {
  shadowColor:'#000', 
  shadowOpacity:0.1, 
  shadowOffset:{width:0,height:2}, 
  shadowRadius:8,
  elevation:4, // Android
};

console.log('🟢 Theme: Configuration loaded successfully');