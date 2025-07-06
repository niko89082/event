// hooks/useAnimatedHeader.js - UPDATED: More aggressive tab movement
import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

const HEADER_HEIGHT = 85; // Reduced header height since no subtitle
const TAB_BAR_HEIGHT = 36; // Actual tab bar height
const SCROLL_THRESHOLD = 30; // Lower threshold for quicker response
const SHOW_THRESHOLD = 20; // Lower threshold for showing

export const useAnimatedHeader = () => {
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const isHeaderVisible = useRef(true);

  const animateHeader = useCallback((headerToValue, tabBarToValue, opacity = null) => {
    const animations = [
      Animated.timing(headerTranslateY, {
        toValue: headerToValue,
        duration: 200, // Faster animation
        useNativeDriver: true,
      }),
      Animated.timing(tabBarTranslateY, {
        toValue: tabBarToValue,
        duration: 200, // Faster animation
        useNativeDriver: true,
      })
    ];

    if (opacity !== null) {
      animations.push(
        Animated.timing(headerOpacity, {
          toValue: opacity,
          duration: 150, // Faster opacity change
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start();
  }, [headerTranslateY, tabBarTranslateY, headerOpacity]);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Determine scroll direction
    if (scrollDelta > 0) {
      scrollDirection.current = 'down';
    } else if (scrollDelta < 0) {
      scrollDirection.current = 'up';
    }

    // Handle header visibility logic
    if (currentScrollY <= 0) {
      // At the top - always show header and tab bar
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        animateHeader(0, 0, 1); // header: 0, tabBar: 0, opacity: 1
      }
    } else if (scrollDirection.current === 'down' && currentScrollY > SCROLL_THRESHOLD) {
      // Scrolling down past threshold - hide header and move tabs up more
      if (isHeaderVisible.current) {
        isHeaderVisible.current = false;
        // FIXED: Move tabs up more aggressively (increased tabBar offset)
        animateHeader(-HEADER_HEIGHT, -TAB_BAR_HEIGHT - 10, 0.2); // Extra -10px for tabs
      }
    } else if (scrollDirection.current === 'up' && Math.abs(scrollDelta) > SHOW_THRESHOLD) {
      // Scrolling up with enough velocity - show header and tab bar
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        animateHeader(0, 0, 1); // header: 0, tabBar: 0, opacity: 1
      }
    }

    lastScrollY.current = currentScrollY;
  }, [animateHeader]);

  const resetHeader = useCallback(() => {
    // Reset to visible state (for tab switches, etc.)
    isHeaderVisible.current = true;
    lastScrollY.current = 0;
    animateHeader(0, 0, 1); // Show both header and tab bar
  }, [animateHeader]);

  const getHeaderStyle = useCallback(() => ({
    transform: [{ translateY: headerTranslateY }],
    opacity: headerOpacity,
  }), [headerTranslateY, headerOpacity]);

  const getTabBarStyle = useCallback(() => ({
    transform: [{ translateY: tabBarTranslateY }],
  }), [tabBarTranslateY]);

  return {
    handleScroll,
    resetHeader,
    getHeaderStyle,
    getTabBarStyle,
    isHeaderVisible: isHeaderVisible.current,
  };
};