import { useState, useEffect } from 'react';
import { PixelRatio, Dimensions } from 'react-native';

export const useDynamicType = () => {
  const [fontScale, setFontScale] = useState(PixelRatio.getFontScale());
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setFontScale(PixelRatio.getFontScale());
    });

    return () => subscription?.remove();
  }, []);

  // Helper function to get scaled font size
  const getScaledFontSize = (size) => {
    const maxFontScale = 1.5; // Limit scaling to prevent extreme sizes
    const cappedFontScale = Math.min(fontScale, maxFontScale);
    return Math.ceil(size * cappedFontScale);
  };

  // Helper function to get scaled line height
  const getScaledLineHeight = (fontSize, multiplier = 1.2) => {
    const scaledFontSize = getScaledFontSize(fontSize);
    return Math.ceil(scaledFontSize * multiplier);
  };

  // Helper function to get scaled spacing
  const getScaledSpacing = (spacing) => {
    const maxFontScale = 1.3; // Less aggressive scaling for spacing
    const cappedFontScale = Math.min(fontScale, maxFontScale);
    return Math.ceil(spacing * cappedFontScale);
  };

  return {
    fontScale,
    dimensions,
    getScaledFontSize,
    getScaledLineHeight,
    getScaledSpacing,
    isLargeText: fontScale > 1.0,
    isExtraLargeText: fontScale > 1.3,
  };
};