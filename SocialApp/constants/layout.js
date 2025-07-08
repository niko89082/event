// constants/layout.js - Shared layout constants for consistent measurements
import { Platform, StatusBar, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Status bar height calculation
export const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

// Header dimensions
export const MAIN_HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 56;
export const SUB_TAB_HEIGHT = 56;
export const TOTAL_HEADER_HEIGHT = STATUS_BAR_HEIGHT + MAIN_HEADER_HEIGHT + SUB_TAB_HEIGHT;

// Tab dimensions for main Posts/Events tabs
export const MAIN_TAB_COUNT = 2;
export const MAIN_TAB_WIDTH = SCREEN_WIDTH / MAIN_TAB_COUNT;
export const MAIN_TAB_INDICATOR_WIDTH = 120;
export const MAIN_TAB_INDICATOR_OFFSET = (MAIN_TAB_WIDTH - MAIN_TAB_INDICATOR_WIDTH) / 2;

// Sub-tab dimensions for Following/For You tabs  
export const SUB_TAB_COUNT = 2;
export const SUB_TAB_WIDTH = (SCREEN_WIDTH - 80) / SUB_TAB_COUNT; // Account for margins
export const SUB_TAB_INDICATOR_WIDTH = 60;
export const SUB_TAB_INDICATOR_OFFSET = (SUB_TAB_WIDTH - SUB_TAB_INDICATOR_WIDTH) / 2;

// Content padding
export const CONTENT_PADDING_TOP = TOTAL_HEADER_HEIGHT + 10;

// Screen dimensions
export { SCREEN_WIDTH, SCREEN_HEIGHT };

// Animation constants
export const ANIMATION_DURATION = 300;
export const SPRING_CONFIG = {
  tension: 150,
  friction: 8,
  useNativeDriver: true,
};

// Z-index layers
export const Z_INDEX = {
  CONTENT: 1,
  SUB_HEADER: 999,
  MAIN_HEADER: 1000,
  MODAL: 2000,
  TOAST: 3000,
};

console.log('📏 Layout Constants Loaded:', {
  STATUS_BAR_HEIGHT,
  MAIN_HEADER_HEIGHT,
  SUB_TAB_HEIGHT,
  TOTAL_HEADER_HEIGHT,
  CONTENT_PADDING_TOP,
});