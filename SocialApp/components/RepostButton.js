// components/RepostButton.js
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { repostAPI } from '../services/api';

export default function RepostButton({ 
  postId, 
  repostCount = 0, 
  hasReposted = false,
  onRepostChange,
  showQuoteOption = true
}) {
  const [isReposted, setIsReposted] = useState(hasReposted);
  const [count, setCount] = useState(repostCount);
  const [loading, setLoading] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    setIsReposted(hasReposted);
  }, [hasReposted]);

  useEffect(() => {
    setCount(repostCount);
  }, [repostCount]);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (loading) return;

    if (isReposted) {
      handleUndoRepost();
    } else {
      if (showQuoteOption) {
        // Show options: Repost or Quote Repost
        Alert.alert(
          'Repost',
          'Choose an option',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Repost',
              onPress: handleRepost,
            },
            {
              text: 'Quote Repost',
              onPress: () => {
                if (onRepostChange) {
                  onRepostChange({ action: 'quote', postId });
                }
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        handleRepost();
      }
    }
  };

  const handleRepost = async () => {
    if (loading) return;

    setLoading(true);
    animatePress();

    try {
      const response = await repostAPI.repostPost(postId);
      
      setIsReposted(true);
      setCount(prev => prev + 1);
      
      if (onRepostChange) {
        onRepostChange({ action: 'repost', postId, repost: response.data.repost });
      }
    } catch (error) {
      console.error('Error reposting:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to repost. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUndoRepost = async () => {
    if (loading) return;

    setLoading(true);
    animatePress();

    try {
      await repostAPI.undoRepost(postId);
      
      setIsReposted(false);
      setCount(prev => Math.max(0, prev - 1));
      
      if (onRepostChange) {
        onRepostChange({ action: 'undo', postId });
      }
    } catch (error) {
      console.error('Error undoing repost:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to remove repost. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons
          name={isReposted ? 'repeat' : 'repeat-outline'}
          size={20}
          color={isReposted ? '#10B981' : '#8E8E93'}
        />
      </Animated.View>
      {count > 0 && (
        <Text style={[styles.count, isReposted && styles.countActive]}>
          {count > 999 ? '999+' : count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconContainer: {
    padding: 4,
  },
  count: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 2,
  },
  countActive: {
    color: '#10B981',
  },
});


