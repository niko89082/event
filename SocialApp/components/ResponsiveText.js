import React from 'react';
import { Text, Platform } from 'react-native';
import { useDynamicType } from '../hooks/useDynamicType';

export const ResponsiveText = ({ 
  style, 
  fontSize = 16,
  lineHeightMultiplier = 1.2,
  maxFontScale = 1.5,
  children,
  ...props 
}) => {
  const { getScaledFontSize, getScaledLineHeight } = useDynamicType();
  
  const scaledFontSize = getScaledFontSize(fontSize);
  const scaledLineHeight = getScaledLineHeight(fontSize, lineHeightMultiplier);
  
  const responsiveStyle = {
    fontSize: scaledFontSize,
    lineHeight: scaledLineHeight,
    // Always include font padding on iOS for proper text rendering
    includeFontPadding: Platform.OS === 'android' ? true : false,
    textAlignVertical: 'top', // Prevent clipping
  };

  return (
    <Text
      style={[responsiveStyle, style]}
      allowFontScaling={false} // We handle scaling manually
      {...props}
    >
      {children}
    </Text>
  );
};

export default ResponsiveText;