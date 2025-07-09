// SocialApp/hooks/useModernAnimatedHeader.js - ENHANCED: Sub-tabs move up to main tab position
import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

const TAB_BAR_HEIGHT = 44; // Main tab bar height
const SUB_TAB_HEIGHT = 50; // Sub-tab bar height (EventsHub)
const SCROLL_THRESHOLD = 50; // Threshold for hiding tab bar
const SHOW_THRESHOLD = 30; // Threshold for showing tab bar

export const useModernAnimatedHeader = () => {
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const subTabTranslateY = useRef(new Animated.Value(0)).current; // NEW: For sub-tabs
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const isTabBarVisible = useRef(true);

  const animateTabBars = useCallback((mainTabToValue, subTabToValue) => {
    Animated.parallel([
      Animated.timing(tabBarTranslateY, {
        toValue: mainTabToValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(subTabTranslateY, {
        toValue: subTabToValue,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();
  }, [tabBarTranslateY, subTabTranslateY]);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Determine scroll direction
    if (scrollDelta > 5) {
      scrollDirection.current = 'down';
    } else if (scrollDelta < -5) {
      scrollDirection.current = 'up';
    }

    // Handle tab bar visibility logic
    if (currentScrollY <= 0) {
      // At the top - show both tab bars in original positions
      if (!isTabBarVisible.current) {
        isTabBarVisible.current = true;
        animateTabBars(0, 0); // Main tabs: 0, Sub tabs: 0
      }
    } else if (scrollDirection.current === 'down' && currentScrollY > SCROLL_THRESHOLD) {
      // Scrolling down - hide main tabs, move sub-tabs up to take their place
      if (isTabBarVisible.current) {
        isTabBarVisible.current = false;
        animateTabBars(
          -TAB_BAR_HEIGHT - 10, // Hide main tabs completely
          -TAB_BAR_HEIGHT        // Move sub-tabs up to main tab position
        );
      }
    } else if (scrollDirection.current === 'up' && Math.abs(scrollDelta) > SHOW_THRESHOLD) {
      // Scrolling up - show main tabs, move sub-tabs back to original position
      if (!isTabBarVisible.current) {
        isTabBarVisible.current = true;
        animateTabBars(0, 0); // Both back to original positions
      }
    }

    lastScrollY.current = currentScrollY;
  }, [animateTabBars]);

  const resetTabBar = useCallback(() => {
    // Reset to visible state (for tab switches, refreshes, etc.)
    isTabBarVisible.current = true;
    lastScrollY.current = 0;
    animateTabBars(0, 0); // Reset both to original positions
  }, [animateTabBars]);

  const getTabBarStyle = useCallback(() => ({
    transform: [{ translateY: tabBarTranslateY }],
  }), [tabBarTranslateY]);

  const getSubTabStyle = useCallback(() => ({
    transform: [{ translateY: subTabTranslateY }],
  }), [subTabTranslateY]);

  return {
    handleScroll,
    resetTabBar,
    getTabBarStyle,
    getSubTabStyle, // NEW: Return sub-tab style
    isTabBarVisible: isTabBarVisible.current,
  };
};