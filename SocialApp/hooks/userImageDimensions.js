// STEP 1: First create the file hooks/useImageDimensions.js
// hooks/useImageDimensions.js
import { useState, useEffect } from 'react';
import { Dimensions, Image } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const useImageDimensions = (imageUrl, options = {}) => {
  const {
    maxWidth = screenWidth,
    maxHeight = 500,
    defaultAspectRatio = 1,
    padding = 0
  } = options;

  const [dimensions, setDimensions] = useState({
    width: maxWidth - padding,
    height: (maxWidth - padding) * defaultAspectRatio,
    loading: true
  });

  useEffect(() => {
    if (!imageUrl) {
      setDimensions(prev => ({ ...prev, loading: false }));
      return;
    }

    Image.getSize(
      imageUrl,
      (width, height) => {
        const containerWidth = maxWidth - padding;
        const aspectRatio = height / width;
        const calculatedHeight = Math.min(containerWidth * aspectRatio, maxHeight);

        setDimensions({
          width: containerWidth,
          height: calculatedHeight,
          loading: false,
          aspectRatio
        });
      },
      (error) => {
        console.warn('Failed to get image dimensions:', error);
        setDimensions(prev => ({ ...prev, loading: false }));
      }
    );
  }, [imageUrl, maxWidth, maxHeight, padding]);

  return dimensions;
};

// STEP 2: After creating the hook file, update your components
// In PostDetailsScreen.js - Add this import at the top:
import { useImageDimensions } from '../hooks/useImageDimensions';

// Replace the existing PostDetailsScreen component:

const PostDetailsScreen = () => {
  // ... existing code ...

  const imgURL = post?.paths?.[0] 
    ? `http://${API_BASE_URL}:3000${post.paths[0]}` 
    : null;

  // Add this hook
  const imageDimensions = useImageDimensions(imgURL, {
    maxWidth: screenWidth,
    maxHeight: 600,
    padding: 0
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* ... existing header code ... */}

      {/* Updated Image Container */}
      <View style={[
        styles.imageContainer, 
        { 
          width: imageDimensions.width,
          height: imageDimensions.height 
        }
      ]}>
        {imgURL ? (
          <Image
            source={{ uri: imgURL }}
            style={styles.postImage}
            resizeMode="cover" // Always use cover for consistent cropping
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={50} color="#C7C7CC" />
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
      </View>

      {/* ... rest of component ... */}
    </SafeAreaView>
  );
};

// Updated styles for PostDetailsScreen
const updatedPostDetailsStyles = StyleSheet.create({
  // Remove aspectRatio from imageContainer
  imageContainer: {
    width: '100%',
    backgroundColor: '#F6F6F6',
    position: 'relative',
    alignSelf: 'center', // Center the image
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  // ... rest of existing styles ...
});

// 3. Update UnifiedDetailsScreen.js
// Replace the image section with:

const UnifiedDetailsScreen = () => {
  // ... existing code ...

  const imageDimensions = useImageDimensions(imgURL, {
    maxWidth: screenWidth,
    maxHeight: 600,
    padding: 0
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* ... existing code ... */}

      {/* Updated Image */}
      <View style={[
        styles.imageContainer,
        {
          width: imageDimensions.width,
          height: imageDimensions.height
        }
      ]}>
        {imgURL ? (
          <Image
            source={{ uri: imgURL }}
            style={styles.postImage}
            resizeMode={isMemoryPost ? "contain" : "cover"}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={50} color="#C7C7CC" />
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
      </View>

      {/* ... rest of component ... */}
    </SafeAreaView>
  );
};

// Updated styles for UnifiedDetailsScreen
const updatedUnifiedStyles = StyleSheet.create({
  // Remove aspectRatio from imageContainer
  imageContainer: {
    width: '100%',
    backgroundColor: '#F6F6F6',
    position: 'relative',
    alignSelf: 'center',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  // ... rest of existing styles ...
});

// 4. Update PostItem.js for consistent grid view
// Replace the image section with:

const PostItem = ({ post, onPress }) => {
  // ... existing code ...

  // For PostItem, you might want to maintain squares for grid consistency
  // but add an option to view full size
  const isMemoryPost = post.postType === 'memory';
  
  // Use different sizing for memory vs regular posts
  const imageDimensions = useImageDimensions(imgURL, {
    maxWidth: screenWidth,
    maxHeight: isMemoryPost ? 600 : 400, // More flexible for memories
    defaultAspectRatio: isMemoryPost ? 4/3 : 1, // Different default ratios
    padding: 0
  });

  return (
    <View style={styles.container}>
      {/* ... existing header ... */}

      <Pressable onPress={handleImagePress} style={[
        styles.imageContainer,
        isMemoryPost ? {
          width: imageDimensions.width,
          height: imageDimensions.height
        } : {
          aspectRatio: 1 // Keep squares for regular posts in feed
        }
      ]}>
        {imgURL ? (
          <Image
            source={{ uri: imgURL }}
            style={styles.postImage}
            resizeMode={isMemoryPost ? "cover" : "cover"}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={50} color="#C7C7CC" />
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
      </Pressable>

      {/* ... rest of component ... */}
    </View>
  );
};

// 5. Update ProfilePage grid items (if you have a separate component)
// For profile grid, maintain squares but show full image on tap

const ProfileGridItem = ({ post, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.gridItem} 
      onPress={() => onPress(post)}
      activeOpacity={0.95}
    >
      <Image
        source={{ uri: getImageUrl(post) }}
        style={styles.gridImage}
        resizeMode="cover" // Crop to fill square
      />
    </TouchableOpacity>
  );
};

const profileGridStyles = StyleSheet.create({
  gridItem: {
    width: (screenWidth - 48) / 3, // 3 columns with padding
    height: (screenWidth - 48) / 3, // Perfect squares
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});

// 6. Create a universal image component for consistency
const UniversalImage = ({ 
  uri, 
  style, 
  resizeMode = 'cover',
  maintainAspectRatio = true,
  maxHeight = 500,
  placeholder = true,
  ...props 
}) => {
  const imageDimensions = useImageDimensions(uri, {
    maxHeight,
    maxWidth: screenWidth
  });

  const containerStyle = maintainAspectRatio 
    ? [style, { width: imageDimensions.width, height: imageDimensions.height }]
    : style;

  return (
    <View style={containerStyle}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={resizeMode}
          {...props}
        />
      ) : placeholder && (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image" size={50} color="#C7C7CC" />
          <Text style={styles.placeholderText}>No image</Text>
        </View>
      )}
    </View>
  );
};