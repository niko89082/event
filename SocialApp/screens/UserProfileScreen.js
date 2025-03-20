// screens/UserProfileScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Button, Image,
  FlatList, ActivityIndicator, TouchableOpacity
} from 'react-native';
import api from '../services/api';
import PostItem from '../components/PostItem';
import { API_BASE_URL } from '@env';

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params; 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  // Suppose you have a global "currentUserId" from context, or pass it down
  const currentUserId = 'SOME_CURRENT_USER_ID';

  // We'll store if it's the user's own profile
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/profile/${userId}`);
      const fetchedUser = res.data;
      // If your backend returns isFollowing, isSelf, etc.
      if (typeof fetchedUser.isFollowing === 'boolean') {
        setIsFollowing(fetchedUser.isFollowing);
      }
      // Or compute isSelf front-end
      setIsSelf(fetchedUser._id === currentUserId);

      setUser(fetchedUser);
    } catch (err) {
      console.error('Error loading user profile:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      if (!isFollowing) {
        await api.post(`/follow/follow/${userId}`);
        setIsFollowing(true);
      } else {
        await api.delete(`/follow/unfollow/${userId}`);
        setIsFollowing(false);
      }
      fetchUserProfile(); // update follower count
    } catch (err) {
      console.error('Error in follow/unfollow:', err.response?.data || err);
    }
  };

  const handlePressFollowers = () => {
    if (!user) return;
    navigation.navigate('FollowListScreen', {
      userId: user._id,
      mode: 'followers',
    });
  };

  const handlePressFollowing = () => {
    if (!user) return;
    navigation.navigate('FollowListScreen', {
      userId: user._id,
      mode: 'following',
    });
  };

  const renderPhotoItem = ({ item }) => {
    return (
      <PostItem
        post={item}
        currentUserId={currentUserId}
        onPressComments={(post) => {
          navigation.navigate('CommentsScreen', { postId: post._id });
        }}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text>User not found.</Text>
      </View>
    );
  }

  const { username, profilePicture, followers, following, photos } = user;
  const postCount = photos?.length || 0;
  console.log("FOR SOME REASON I AM HERE")
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {profilePicture ? (
          <Image
            source={{ uri: `http://${API_BASE_URL}:3000${profilePicture}` }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text>No Image</Text>
          </View>
        )}
        <Text style={styles.username}>{username}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statBox} onPress={handlePressFollowers}>
          <Text style={styles.statNumber}>{followers?.length || 0}</Text>
          <Text>Followers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statBox} onPress={handlePressFollowing}>
          <Text style={styles.statNumber}>{following?.length || 0}</Text>
          <Text>Following</Text>
        </TouchableOpacity>

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{postCount}</Text>
          <Text>Posts</Text>
        </View>
      </View>

      {/* Follow/Unfollow Button (only if not self) */}
      {!isSelf && (
        <Button
          title={isFollowing ? 'Unfollow' : 'Follow'}
          onPress={handleFollow}
        />
      )}

      {/* Posts */}
      <Text style={styles.sectionTitle}>Posts</Text>
      {postCount > 0 ? (
        <FlatList
          horizontal
          data={photos}
          keyExtractor={(item) => item._id}
          renderItem={renderPhotoItem}
        />
      ) : (
        <Text>No posts yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 16 },
  profileImage: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#ddd', marginBottom: 8,
  },
  placeholderImage: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  username: { fontSize: 20, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginVertical: 8 },
});