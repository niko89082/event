// components/PhotoGrid.js - Instagram-style photo grid
import React from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, FlatList
} from 'react-native';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - (GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `http://${API_BASE_URL}:3000${path}`;
};

export default function PhotoGrid({ photos, onPhotoPress, navigation }) {
  const renderItem = ({ item, index }) => {
    const imageUrl = item.paths && item.paths[0] ? getImageUrl(item.paths[0]) : null;
    
    return (
      <TouchableOpacity
        style={[
          styles.gridItem,
          {
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            marginRight: (index + 1) % NUM_COLUMNS === 0 ? 0 : GAP,
            marginBottom: GAP,
          }
        ]}
        onPress={() => {
          if (onPhotoPress) {
            onPhotoPress(item);
          } else if (navigation) {
            navigation.navigate('UnifiedDetailsScreen', {
              postId: item._id,
              postType: 'post',
            });
          }
        }}
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        {item.paths && item.paths.length > 1 && (
          <View style={styles.multiImageIndicator}>
            <Text style={styles.multiImageText}>{item.paths.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!photos || photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No photos yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={photos}
      renderItem={renderItem}
      keyExtractor={(item) => item._id}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.gridContainer}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false} // Let parent ScrollView handle scrolling
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    padding: 0,
  },
  gridItem: {
    backgroundColor: '#E1E1E1',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  multiImageIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  multiImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});


