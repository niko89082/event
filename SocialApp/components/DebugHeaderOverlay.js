// components/DebugHeaderOverlay.js - Debug component to visualize header behavior
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

const DebugHeaderOverlay = ({ headerStyle, isVisible = true }) => {
  const [debugInfo, setDebugInfo] = useState({
    translateY: 0,
    opacity: 1,
    timestamp: Date.now()
  });

  useEffect(() => {
    if (!headerStyle || !__DEV__) return;

    // Extract animated values for display
    const translateY = headerStyle.transform?.[0]?.translateY?._value || 0;
    const opacity = headerStyle.opacity?._value || 1;

    setDebugInfo({
      translateY: translateY.toFixed(1),
      opacity: opacity.toFixed(2),
      timestamp: Date.now()
    });
  }, [headerStyle]);

  if (!__DEV__ || !isVisible) return null;

  return (
    <View style={styles.debugOverlay}>
      <Text style={styles.debugTitle}>🔧 Header Debug</Text>
      <Text style={styles.debugText}>
        TranslateY: {debugInfo.translateY}px
      </Text>
      <Text style={styles.debugText}>
        Opacity: {debugInfo.opacity}
      </Text>
      <Text style={styles.debugText}>
        Updated: {new Date(debugInfo.timestamp).toLocaleTimeString()}
      </Text>
      
      {/* Visual indicator of header position */}
      <View style={styles.visualIndicator}>
        <View style={[
          styles.headerIndicator,
          {
            transform: [{ translateY: parseFloat(debugInfo.translateY) }],
            opacity: parseFloat(debugInfo.opacity)
          }
        ]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  debugOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    zIndex: 9999,
    minWidth: 150,
  },
  debugTitle: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  visualIndicator: {
    marginTop: 8,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  headerIndicator: {
    height: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 4,
  },
});

export default DebugHeaderOverlay;