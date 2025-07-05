// hooks/useAnimatedHeader.js
import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

const HEADER_HEIGHT = 100; // Approximate header height
const TAB_BAR_HEIGHT = 44; // Reduced tab bar height for minimal design
const TOTAL_HIDE_HEIGHT = HEADER_HEIGHT + TAB_BAR_HEIGHT; // Total height to hide
const SCROLL_THRESHOLD = 50; // Minimum scroll to trigger hide
const SHOW_THRESHOLD = 30; // Minimum reverse scroll to show

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
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarTranslateY, {
        toValue: tabBarToValue,
        duration: 250,
        useNativeDriver: true,
      })
    ];

    if (opacity !== null) {
      animations.push(
        Animated.timing(headerOpacity, {
          toValue: opacity,
          duration: 200,
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
      // Scrolling down past threshold - hide header and tab bar
      if (isHeaderVisible.current) {
        isHeaderVisible.current = false;
        animateHeader(-HEADER_HEIGHT, -TAB_BAR_HEIGHT, 0.3); // header: -100, tabBar: -50, opacity: 0.3
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