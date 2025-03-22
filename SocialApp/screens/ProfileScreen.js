// screens/ProfileScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Image,
  FlatList,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import api from '../services/api';
import PostItem from '../components/PostItem';
import { API_BASE_URL } from '@env';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';

export default function ProfileScreen({ route, navigation, onLogout }) {
  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [headerImgErr, setHeaderImgErr] = useState(null);
  const [headerImgLoaded, setHeaderImgLoaded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  const userId = route?.params?.userId || null;
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchProfile();
    }
  }, [isFocused, userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      let response;
      if (userId) {
        response = await api.get(`/profile/${userId}`);
      } else {
        response = await api.get('/profile');
      }
      const data = response.data;

      // isFollowing logic
      if (typeof data.isFollowing === 'boolean') {
        setIsFollowing(data.isFollowing);
      } else {
        const isFollowed = data.followers?.some(
          (follower) => String(follower._id) === String(currentUserId)
        );
        setIsFollowing(!!isFollowed);
      }

      // Check if this profile belongs to the current user
      if (!userId || String(data._id) === String(currentUserId)) {
        setIsSelf(true);
      } else {
        setIsSelf(false);
      }

      setProfile(data);
    } catch (error) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!userId) return;
    try {
      if (!isFollowing) {
        await api.post(`/follow/follow/${userId}`);
        setIsFollowing(true);
      } else {
        await api.delete(`/follow/unfollow/${userId}`);
        setIsFollowing(false);
      }
      fetchProfile();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    onLogout && onLogout();
  };

  const handlePressFollowers = () => {
    if (!profile) return;
    navigation.navigate('FollowListScreen', {
      userId: profile._id,
      mode: 'followers',
    });
  };

  const handlePressFollowing = () => {
    if (!profile) return;
    navigation.navigate('FollowListScreen', {
      userId: profile._id,
      mode: 'following',
    });
  };

  // -------------- NEW --------------
  // Called when a post is successfully deleted
  const handleDeletePost = (deletedId) => {
    // Remove the deleted photo from local state
    setProfile((prev) => {
      if (!prev) return prev;
      const updatedPhotos = prev.photos.filter((p) => p._id !== deletedId);
      return {
        ...prev,
        photos: updatedPhotos,
      };
    });
  };
  // ---------------------------------

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text>User not found or failed to load.</Text>
      </View>
    );
  }

  const { username, profilePicture, followers, following, photos } = profile;
  const postCount = photos?.length || 0;

  let finalProfilePicturePath = profilePicture || '';
  if (finalProfilePicturePath && !finalProfilePicturePath.startsWith('/')) {
    finalProfilePicturePath = '/' + finalProfilePicturePath;
  }
  const profileImageUrl = finalProfilePicturePath
    ? `http://${API_BASE_URL}:3000${finalProfilePicturePath}`
    : null;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        {profilePicture ? (
          <Image
            source={{ uri: profileImageUrl }}
            style={styles.profileImage}
            onError={(err) => setHeaderImgErr(err.nativeEvent.error)}
            onLoad={() => setHeaderImgLoaded(true)}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text>No Image</Text>
          </View>
        )}

        {headerImgErr && (
          <Text style={{ color: 'red' }}>
            Header image failed to load: {headerImgErr}
          </Text>
        )}
        {headerImgLoaded && (
          <Text style={{ color: 'green' }}>Header image loaded successfully!</Text>
        )}

        <Text style={styles.username}>{username}</Text>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statsBox} onPress={handlePressFollowers}>
          <Text style={styles.statsNumber}>{followers?.length || 0}</Text>
          <Text>Followers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statsBox} onPress={handlePressFollowing}>
          <Text style={styles.statsNumber}>{following?.length || 0}</Text>
          <Text>Following</Text>
        </TouchableOpacity>

        <View style={styles.statsBox}>
          <Text style={styles.statsNumber}>{postCount}</Text>
          <Text>Posts</Text>
        </View>
      </View>

      {/* FOLLOW / SETTINGS */}
      {!isSelf && (
        <Button
          title={isFollowing ? 'Unfollow' : 'Follow'}
          onPress={handleToggleFollow}
        />
      )}
      {isSelf && (
        <View style={styles.selfButtonsContainer}>
          <Button
            title="Settings"
            onPress={() => navigation.navigate('UserSettingsScreen')}
          />
          <Button title="Logout" onPress={handleLogout} />
        </View>
      )}

      {/* POSTS */}
      <View style={styles.postsSection}>
        <Text style={styles.sectionTitle}>Posts</Text>
        {postCount === 0 ? (
          <Text style={styles.noPosts}>No posts to display</Text>
        ) : (
          <FlatList
            data={photos}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <PostItem
                post={item}
                currentUserId={currentUserId}
                hideUserInfo={true}
                navigation={navigation}
                // Pass the callback so PostItem can remove itself after delete
                onDeletePost={handleDeletePost}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 16 },
  profileImage: {
    width: 80, height: 80, borderRadius: 40, marginBottom: 8, backgroundColor: '#ccc',
  },
  placeholderImage: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  username: { fontSize: 20, fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16,
  },
  statsBox: { alignItems: 'center' },
  statsNumber: { fontSize: 18, fontWeight: 'bold' },
  postsSection: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  noPosts: { color: '#999', fontStyle: 'italic' },
  selfButtonsContainer: { marginTop: 16 },
});