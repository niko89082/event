// components/SongReviewSelector.js - Song review search and selection
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator, Modal, SafeAreaView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SongReviewSelector({ visible, onClose, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [rating, setRating] = useState(0);
  const searchTimeoutRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/reviews/search-songs', {
          params: { query: searchQuery.trim(), limit: 20, offset: 0 }
        });
        setResults(response.data.tracks || []);
      } catch (error) {
        console.error('Song search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setSearchQuery('');
    setResults([]);
  };

  const handleConfirm = () => {
    if (selectedSong && rating > 0) {
      onSelect({
        type: 'song',
        mediaId: selectedSong.id,
        title: selectedSong.name,
        artist: selectedSong.artist,
        year: selectedSong.year,
        poster: selectedSong.albumArt,
        rating: rating,
        ratingType: 'stars',
        genre: [],
        duration: selectedSong.duration,
        externalUrl: selectedSong.externalUrl
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setResults([]);
    setSelectedSong(null);
    setRating(0);
    onClose();
  };

  const renderSongItem = ({ item }) => (
    <TouchableOpacity
      style={styles.songItem}
      onPress={() => handleSelectSong(item)}
      activeOpacity={0.7}
    >
      {item.albumArt && (
        <Image source={{ uri: item.albumArt }} style={styles.albumArt} />
      )}
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{item.name}</Text>
        <Text style={styles.songArtist}>{item.artist}</Text>
        {item.album && (
          <Text style={styles.songAlbum}>{item.album}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  const renderStarRating = () => {
    return (
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>Rate this song:</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={star <= rating ? "star" : "star-outline"}
                size={32}
                color={star <= rating ? "#FFD700" : "#E1E1E1"}
              />
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text style={styles.ratingText}>{rating}/5</Text>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Song</Text>
          <View style={styles.headerRight} />
        </View>

        {!selectedSong ? (
          <>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a song..."
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3797EF" />
              </View>
            )}

            {!loading && results.length > 0 && (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={renderSongItem}
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
              />
            )}

            {!loading && searchQuery.length >= 2 && results.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No songs found</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.selectedContainer}>
            <View style={styles.selectedSongCard}>
              {selectedSong.albumArt && (
                <Image source={{ uri: selectedSong.albumArt }} style={styles.selectedAlbumArt} />
              )}
              <Text style={styles.selectedTitle}>{selectedSong.name}</Text>
              <Text style={styles.selectedArtist}>{selectedSong.artist}</Text>
              {selectedSong.album && (
                <Text style={styles.selectedAlbum}>{selectedSong.album}</Text>
              )}
            </View>

            {renderStarRating()}

            <TouchableOpacity
              style={[styles.confirmButton, rating === 0 && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={rating === 0}
            >
              <Text style={styles.confirmButtonText}>Select</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  cancelButton: {
    fontSize: 16,
    color: '#8E8E93',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  headerRight: {
    width: 60,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  resultsList: {
    padding: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  songAlbum: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  selectedContainer: {
    flex: 1,
    padding: 20,
  },
  selectedSongCard: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  selectedAlbumArt: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#E1E1E1',
    marginBottom: 16,
  },
  selectedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  selectedArtist: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 2,
  },
  selectedAlbum: {
    fontSize: 14,
    color: '#8E8E93',
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3797EF',
    marginTop: 12,
  },
  confirmButton: {
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});


