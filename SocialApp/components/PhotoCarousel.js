// components/PhotoCarousel.js - Instagram-style horizontal swipeable carousel for multiphoto posts
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PhotoCarousel({
  photos = [],
  width = SCREEN_WIDTH - 32, // Default to feed width
  onPhotoPress,
  style,
  showIndicators = true,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState({});
  const flatListRef = useRef(null);
  const gestureStartX = useRef(0);
  const gestureStartY = useRef(0);

  // If only one photo, no need for carousel
  const isSinglePhoto = photos.length <= 1;

  // Calculate image dimensions for each photo
  useEffect(() => {
    if (photos.length === 0) return;

    photos.forEach((path, index) => {
      const imageUrl = getImageUrl(path);
      if (!imageDimensions[index]) {
        Image.getSize(
          imageUrl,
          (imgWidth, imgHeight) => {
            const aspectRatio = imgWidth / imgHeight;
            const maxHeight = width * 1.5; // Allow taller images
            
            let newWidth = width;
            let newHeight = width / aspectRatio;
            
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = maxHeight * aspectRatio;
            }
            
            setImageDimensions(prev => ({
              ...prev,
              [index]: { width: newWidth, height: newHeight, aspectRatio }
            }));
          },
          (error) => {
            console.warn('Error getting image size:', error);
            // Default to square
            setImageDimensions(prev => ({
              ...prev,
              [index]: { width: width, height: width, aspectRatio: 1 }
            }));
          }
        );
      }
    });
  }, [photos, width]);

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `http://${API_BASE_URL}:3000${path}`;
  };

  // Handle scroll to update current index
  const onScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index !== currentIndex && index >= 0 && index < photos.length) {
      setCurrentIndex(index);
    }
  };

  // Gesture responder handlers for isolation
  // CRITICAL: Prevent parent PanResponders (tab swipes, screen swipes) from interfering
  // Strategy: Use a wrapper View that claims horizontal gestures before parent PanResponders can,
  // but allows FlatList to handle them naturally through nested scrolling
  const handleStartShouldSetResponder = () => {
    // Don't capture on start - let touch events flow naturally to FlatList
    return false;
  };

  const handleMoveShouldSetResponder = (evt, gestureState) => {
    // Only claim the gesture if it's clearly horizontal
    // This prevents parent PanResponders from claiming it first
    const { dx, dy } = gestureState;
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 2;
    const hasMinMovement = Math.abs(dx) > 20; // Higher threshold to avoid conflicts
    
    if (hasMinMovement && isHorizontal) {
      // Claim horizontal gestures to prevent parent from interfering
      // FlatList will still handle scrolling through nestedScrollEnabled
      return true;
    }
    
    return false; // Let vertical swipes pass through to parent ScrollView
  };

  const handleResponderTerminationRequest = () => {
    // CRITICAL: Never allow parent to steal control once we've claimed a horizontal swipe
    // This prevents tab swipes (ProfileScreen, SearchScreen) from interfering
    return false;
  };

  const renderPhoto = ({ item, index }) => {
    const imageUrl = getImageUrl(item);
    const dimensions = imageDimensions[index] || { width, height: width, aspectRatio: 1 };
    
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onPhotoPress && onPhotoPress(index)}
        style={[styles.photoContainer, { width }]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.photo,
            {
              width: dimensions.width,
              height: dimensions.height,
              maxWidth: width,
            }
          ]}
          resizeMode="contain"
          onError={(error) => {
            console.warn('Image load error:', error);
          }}
        />
      </TouchableOpacity>
    );
  };

  // Single photo - no carousel needed
  if (isSinglePhoto) {
    const imageUrl = getImageUrl(photos[0]);
    const dimensions = imageDimensions[0] || { width, height: width };
    
    return (
      <View style={[styles.container, style]}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => onPhotoPress && onPhotoPress(0)}
          style={styles.singlePhotoContainer}
        >
          <Image
            source={{ uri: imageUrl }}
            style={[
              styles.photo,
              {
                width: dimensions.width,
                height: dimensions.height,
                maxWidth: width,
              }
            ]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Multiple photos - carousel with indicators
  return (
    <View
      style={[styles.container, style]}
      // CRITICAL: Gesture isolation wrapper
      // Strategy: Claim horizontal gestures to prevent parent PanResponders from interfering
      // FlatList will still handle scrolling through its native scroll view implementation
      // which works alongside the responder system
      onStartShouldSetResponder={handleStartShouldSetResponder}
      onMoveShouldSetResponder={handleMoveShouldSetResponder}
      onResponderTerminationRequest={handleResponderTerminationRequest}
    >
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item, index) => `photo-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={width}
        decelerationRate="fast"
        bounces={false}
        scrollEnabled={true}
        // CRITICAL: Enable nested scrolling - allows FlatList to handle gestures
        // even when nested in ScrollView with PanResponders
        nestedScrollEnabled={true}
        // Lock scrolling direction to horizontal to prevent vertical interference
        directionalLockEnabled={true}
        // Additional props to help with gesture isolation
        removeClippedSubviews={false}
      />
      
      {/* Page Indicators */}
      {showIndicators && photos.length > 1 && (
        <View style={styles.indicatorsContainer}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  singlePhotoContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  photo: {
    backgroundColor: '#F6F6F6',
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  indicatorActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});

