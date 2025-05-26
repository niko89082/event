// theme.js   – central design tokens
export const palette = {
  /* ---- core brand ---- */
  brandBlue: '#1877F2',          // Facebook-ish blue
  brandBlueDark: '#145DB2',
  white: '#FFFFFF',
  grey:  '#6B7280',
  black: '#111827',

  /* ---- semantic ---- */
  bg:      '#FFFFFF',
  surface: '#F9FAFB',
  border:  '#E5E7EB',
};

/* ---- typography ---- */
export const font = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
};
export const light = {
  brandBlue : '#1877F2',
  surface   : '#FFFFFF',
  surfaceAlt: '#F2F3F5',
  border    : '#E6E8EB',
  text      : '#050505',
  textDim   : '#606770',
  danger    : '#E24343',
};

export const dark = {
  brandBlue : '#4590FF',
  surface   : '#050505',
  surfaceAlt: '#1C1E21',
  border    : '#2F3033',
  text      : '#E4E6EB',
  textDim   : '#B0B3B8',
  danger    : '#F25C5C',
};

/* ---- helpers ---- */
export const spacing = (mult = 1) => 4 * mult;  // 4-pt scale
export const radius  = { card:12, avatar:6, thumb:4, btn:10 };
/**
 * call changePalette({...}) anywhere (e.g. Settings screen)
 * to hot-swap colours without touching components.
 */
export const changePalette = (overrides = {}) => {
  Object.assign(palette, overrides);
};

export const shadow = {
  shadowColor:'#000', shadowOpacity:0.1, shadowOffset:{width:0,height:2}, shadowRadius:4,
  elevation:2, // Android
};