// components/activities/ActivityActionButton.js - Reusable Action Button
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActivityActionButton = ({
  title,
  onPress,
  style = {},
  textStyle = {},
  icon = null,
  iconPosition = 'left', // 'left' or 'right'
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost'
  size = 'medium', // 'small', 'medium', 'large'
  fullWidth = false,
}) => {
  
  const getVariantStyles = () => {
    const variants = {
      primary: {
        button: styles.primaryButton,
        text: styles.primaryButtonText,
      },
      secondary: {
        button: styles.secondaryButton,
        text: styles.secondaryButtonText,
      },
      outline: {
        button: styles.outlineButton,
        text: styles.outlineButtonText,
      },
      ghost: {
        button: styles.ghostButton,
        text: styles.ghostButtonText,
      },
    };
    return variants[variant] || variants.primary;
  };

  const getSizeStyles = () => {
    const sizes = {
      small: {
        button: styles.smallButton,
        text: styles.smallButtonText,
      },
      medium: {
        button: styles.mediumButton,
        text: styles.mediumButtonText,
      },
      large: {
        button: styles.largeButton,
        text: styles.largeButtonText,
      },
    };
    return sizes[size] || sizes.medium;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const isDisabled = disabled || loading;

  const buttonStyles = [
    styles.baseButton,
    variantStyles.button,
    sizeStyles.button,
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabledButton,
    style,
  ];

  const textStyles = [
    styles.baseText,
    variantStyles.text,
    sizeStyles.text,
    isDisabled && styles.disabledText,
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size="small" 
            color={variantStyles.text.color}
          />
          <Text style={[textStyles, styles.loadingText]}>
            {title}
          </Text>
        </View>
      );
    }

    if (icon) {
      return (
        <View style={[
          styles.contentContainer,
          iconPosition === 'right' && styles.contentContainerReverse
        ]}>
          {iconPosition === 'left' && (
            <Ionicons 
              name={icon} 
              size={sizeStyles.text.fontSize} 
              color={variantStyles.text.color}
              style={styles.iconLeft}
            />
          )}
          <Text style={textStyles}>{title}</Text>
          {iconPosition === 'right' && (
            <Ionicons 
              name={icon} 
              size={sizeStyles.text.fontSize} 
              color={variantStyles.text.color}
              style={styles.iconRight}
            />
          )}
        </View>
      );
    }

    return <Text style={textStyles}>{title}</Text>;
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Base styles
  baseButton: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
  },
  baseText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  
  // Size variants
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  smallButtonText: {
    fontSize: 13,
  },
  mediumButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
  },
  mediumButtonText: {
    fontSize: 15,
  },
  largeButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },
  largeButtonText: {
    fontSize: 17,
  },

  // Color variants
  primaryButton: {
    backgroundColor: '#3797EF',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3797EF',
  },
  outlineButtonText: {
    color: '#3797EF',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  ghostButtonText: {
    color: '#3797EF',
  },

  // Disabled state
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },

  // Loading state
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 0, // Override any margin from textStyles
  },

  // Icon styles
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentContainerReverse: {
    flexDirection: 'row-reverse',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },
});

export default ActivityActionButton;