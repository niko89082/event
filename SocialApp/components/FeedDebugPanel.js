// components/FeedDebugPanel.js - Small draggable debug panel for real-time adjustments
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  PanResponder,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_STORAGE_KEY = '@feed_debug_values';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 400;

export default function FeedDebugPanel({ 
  visible, 
  onClose, 
  onValuesChange,
  initialValues = {} 
}) {
  const [values, setValues] = useState({
    contentPaddingTop: initialValues.contentPaddingTop || 0,
    totalHeaderHeight: initialValues.totalHeaderHeight || 0,
    tabBarHeight: initialValues.tabBarHeight || 40,
    fixedHeaderHeight: initialValues.fixedHeaderHeight || 52,
    scrollThreshold: initialValues.scrollThreshold || 50,
    showThreshold: initialValues.showThreshold || 30,
    postComposerPaddingTop: initialValues.postComposerPaddingTop || 12,
    postComposerPaddingBottom: initialValues.postComposerPaddingBottom || 12,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const position = useRef({ x: SCREEN_WIDTH - PANEL_WIDTH - 20, y: 100 });

  // Load saved values on mount and merge with initialValues
  useEffect(() => {
    loadSavedValues();
    loadSavedPosition();
  }, []);

  // Update values when initialValues change (when panel opens)
  useEffect(() => {
    if (visible && Object.keys(initialValues).length > 0) {
      setValues(prev => ({
        ...prev,
        ...initialValues,
        // Only override with initialValues if saved values don't exist
        ...(prev.scrollThreshold === undefined ? { scrollThreshold: initialValues.scrollThreshold || 50 } : {}),
        ...(prev.showThreshold === undefined ? { showThreshold: initialValues.showThreshold || 30 } : {}),
      }));
    }
  }, [visible, initialValues]);

  // Save values when they change
  useEffect(() => {
    if (visible) {
      saveValues();
      if (onValuesChange) {
        onValuesChange(values);
      }
    }
  }, [values, visible]);

  const loadSavedValues = async () => {
    try {
      const saved = await AsyncStorage.getItem(DEBUG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setValues(prev => ({ 
          ...prev, 
          ...parsed,
          // Ensure scrollThreshold and showThreshold exist
          scrollThreshold: parsed.scrollThreshold !== undefined ? parsed.scrollThreshold : (prev.scrollThreshold || 50),
          showThreshold: parsed.showThreshold !== undefined ? parsed.showThreshold : (prev.showThreshold || 30),
        }));
      } else {
        // If no saved values, use initialValues
        setValues(prev => ({
          ...prev,
          ...initialValues,
          scrollThreshold: initialValues.scrollThreshold || prev.scrollThreshold || 50,
          showThreshold: initialValues.showThreshold || prev.showThreshold || 30,
        }));
      }
    } catch (error) {
      console.error('Error loading debug values:', error);
      // On error, use initialValues
      setValues(prev => ({
        ...prev,
        ...initialValues,
        scrollThreshold: initialValues.scrollThreshold || prev.scrollThreshold || 50,
        showThreshold: initialValues.showThreshold || prev.showThreshold || 30,
      }));
    }
  };

  const loadSavedPosition = async () => {
    try {
      const saved = await AsyncStorage.getItem('@feed_debug_position');
      if (saved) {
        const pos = JSON.parse(saved);
        position.current = pos;
        pan.setValue({ x: pos.x, y: pos.y });
      } else {
        pan.setValue({ x: position.current.x, y: position.current.y });
      }
    } catch (error) {
      console.error('Error loading position:', error);
      pan.setValue({ x: position.current.x, y: position.current.y });
    }
  };

  const saveValues = async () => {
    try {
      await AsyncStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(values));
    } catch (error) {
      console.error('Error saving debug values:', error);
    }
  };

  const savePosition = async (x, y) => {
    try {
      await AsyncStorage.setItem('@feed_debug_position', JSON.stringify({ x, y }));
    } catch (error) {
      console.error('Error saving position:', error);
    }
  };

  const resetValues = () => {
    const defaults = {
      contentPaddingTop: 0,
      totalHeaderHeight: 0,
      tabBarHeight: 40,
      fixedHeaderHeight: 52,
      scrollThreshold: 50,
      showThreshold: 30,
      postComposerPaddingTop: 12,
      postComposerPaddingBottom: 12,
    };
    setValues(defaults);
  };

  const updateValue = (key, value) => {
    const numValue = parseFloat(value) || 0;
    setValues(prev => ({ ...prev, [key]: numValue }));
  };

  // Pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: position.current.x,
          y: position.current.y,
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        pan.flattenOffset();
        
        // Constrain to screen bounds
        const newX = Math.max(0, Math.min(SCREEN_WIDTH - PANEL_WIDTH, position.current.x + gestureState.dx));
        const newY = Math.max(0, Math.min(SCREEN_HEIGHT - (isExpanded ? PANEL_HEIGHT : 60), position.current.y + gestureState.dy));
        
        position.current = { x: newX, y: newY };
        pan.setValue({ x: newX, y: newY });
        savePosition(newX, newY);
      },
    })
  ).current;

  const ValueInput = ({ label, value, onChange, min = 0, max = 500, step = 1 }) => (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Ionicons name="remove" size={16} color="#3797EF" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={String(value)}
          onChangeText={(text) => onChange(parseFloat(text) || 0)}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <TouchableOpacity
          style={styles.button}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Ionicons name="add" size={16} color="#3797EF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: pan.getTranslateTransform(),
          width: PANEL_WIDTH,
          height: isExpanded ? PANEL_HEIGHT : 60,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Header - Always visible, draggable */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="settings" size={18} color="#3797EF" />
          <Text style={styles.headerTitle}>Debug</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandButton}
          >
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Content - Only visible when expanded */}
      {isExpanded && (
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <Text style={styles.sectionTitle}>Header & Spacing</Text>
          <ValueInput
            label="Content Padding"
            value={values.contentPaddingTop}
            onChange={(val) => updateValue('contentPaddingTop', val)}
            min={0}
            max={300}
          />
          <ValueInput
            label="Header Height"
            value={values.totalHeaderHeight}
            onChange={(val) => updateValue('totalHeaderHeight', val)}
            min={0}
            max={200}
          />
          <ValueInput
            label="Tab Bar Height"
            value={values.tabBarHeight}
            onChange={(val) => updateValue('tabBarHeight', val)}
            min={20}
            max={100}
          />
          <ValueInput
            label="Fixed Header"
            value={values.fixedHeaderHeight}
            onChange={(val) => updateValue('fixedHeaderHeight', val)}
            min={30}
            max={100}
          />

          <Text style={styles.sectionTitle}>Scroll</Text>
          <ValueInput
            label="Hide Threshold"
            value={values.scrollThreshold}
            onChange={(val) => updateValue('scrollThreshold', val)}
            min={10}
            max={200}
          />
          <ValueInput
            label="Show Threshold"
            value={values.showThreshold}
            onChange={(val) => updateValue('showThreshold', val)}
            min={10}
            max={200}
          />

          <Text style={styles.sectionTitle}>Post Composer</Text>
          <ValueInput
            label="Padding Top"
            value={values.postComposerPaddingTop}
            onChange={(val) => updateValue('postComposerPaddingTop', val)}
            min={0}
            max={50}
          />
          <ValueInput
            label="Padding Bottom"
            value={values.postComposerPaddingBottom}
            onChange={(val) => updateValue('postComposerPaddingBottom', val)}
            min={0}
            max={50}
          />

          <TouchableOpacity style={styles.resetButton} onPress={resetValues}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    overflow: 'hidden',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    maxHeight: PANEL_HEIGHT - 60,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  resetButton: {
    marginTop: 12,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
