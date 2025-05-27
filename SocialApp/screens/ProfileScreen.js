// screens/ProfileScreen.js - Updated with modern UI
import React, { useState, useEffect, useContext } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList, Dimensions, ScrollView,
  StatusBar,
} from 'react-native';
import { useIsFocused }  from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import api               from '../services/api';
import { API_BASE_URL }  from '@env';
import { AuthContext }   from '../services/AuthContext';

import SharedEventsTab   from '../components/SharedEventsTab';
import CalendarTab       from '../components/CalendarTab';

/* ---------- constants ---------- */
const COLS  = 3;
const GAP   = 4;
const WIDTH = Dimensions.get('window').width;
const THUMB = (WIDTH - GAP * (COLS + 1)) / COLS;

export default function ProfileScreen({ route, navigation }) {
  const { currentUser }   = useContext(AuthContext);
  const authId            = currentUser?._id;
  const userId            = route.params?.userId || null;
  const isFocused         = useIsFocused();
  const insets            = useSafeAreaInsets();

  /* state ----------------------------------------------------------- */
  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [following,   setFollowing]   = useState(false);
  const [requested,   setRequested]   = useState(false);
  const [isSelf,      setIsSelf]      = useState(false);
  const [tab,         setTab]         = useState(0);      // 0-Posts | 1-Events | 2-Calendar

  /* Setup header with back button */
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: profile?.username || 'Profile',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => isSelf ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('UserSettingsScreen')}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color="#000000" />
        </TouchableOpacity>
      ) : null,
    });
  }, [navigation, profile, isSelf]);

  /* fetch ----------------------------------------------------------- */
  useEffect(() => { if (isFocused) fetchProfile(); }, [isFocused, userId]);

  const fetchProfile = async (pull=false) => {
    pull ? setRefreshing(true) : setLoading(true);
    try {
      console.log('🟡 ProfileScreen: Fetching profile...', userId ? `userId: ${userId}` : 'own profile');
      
      const endpoint = userId ? `/api/profile/${userId}` : '/api/profile';
      const { data } = await api.get(endpoint);
      
      console.log('🟢 ProfileScreen: Profile loaded successfully');
      setProfile(data);
      setIsSelf(String(data._id) === String(authId));
      setFollowing(!!data.isFollowing);
      setRequested(!!data.hasRequested);
    } catch (err) {
      console.log('❌ ProfileScreen: Profile fetch error:', err.response?.data || err.message);
      setProfile(null);
    } finally {
      pull ? setRefreshing(false) : setLoading(false);
    }
  };

  /* follow toggle --------------------------------------------------- */
  const toggleFollow = async () => {
    if (!profile) return;
    try {
      console.log('🟡 ProfileScreen: Toggling follow status...');
      
      if (following) {
        await api.delete(`/api/follow/unfollow/${profile._id}`);
        console.log('🟢 ProfileScreen: Unfollowed successfully');
      } else {
        await api.post(`/api/follow/follow/${profile._id}`);
        console.log('🟢 ProfileScreen: Follow request sent/completed');
      }
      
      setFollowing(!following);
      setRequested(false);
      fetchProfile();
    } catch (err) { 
      console.log('❌ ProfileScreen: Follow toggle error:', err.response?.data || err.message); 
    }
  };

  /* guards ---------------------------------------------------------- */
  if (loading)  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    </SafeAreaView>
  );
  
  if (!profile) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Ionicons name="person-outline" size={80} color="#C7C7CC" />
        <Text style={styles.errorText}>Profile unavailable</Text>
        <TouchableOpacity onPress={() => fetchProfile()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  /* helpers --------------------------------------------------------- */
  const avatar = profile.profilePicture
    ? `http://${API_BASE_URL}:3000${profile.profilePicture}`
    : null;

  const mutual = profile.followers
    ?.filter(f => currentUser?.following?.includes(f._id))
    ?.map(f => f.username) || [];

  const mutualLabel = !isSelf && mutual.length
    ? `Followed by ${mutual.slice(0,2).join(', ')}${mutual.length>2 ? ` and ${mutual.length-2} others` : ''}`
    : null;

  /* header component ------------------------------------------------ */
  const Header = () => (
    <View style={styles.profileHeader}>
      {/* Profile Info Section */}
      <View style={styles.profileInfoSection}>
        {/* Avatar and Basic Info */}
        <View style={styles.avatarSection}>
          <TouchableOpacity activeOpacity={0.8}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar}/>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-outline" size={50} color="#8E8E93" />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.usernameSection}>
            <Text style={styles.username}>{profile.username}</Text>
            {profile.pronouns && (
              <Text style={styles.pronouns}>{profile.pronouns}</Text>
            )}
            {mutualLabel && <Text style={styles.mutualText}>{mutualLabel}</Text>}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Stat n={profile.photos?.length || 0} label="Posts"/>
          <Stat 
            n={profile.followers?.length || 0} 
            label="Followers" 
            onPress={() => navigation.navigate('FollowListScreen',{ userId:profile._id, mode:'followers'})}
          />
          <Stat 
            n={profile.following?.length || 0} 
            label="Following" 
            onPress={() => navigation.navigate('FollowListScreen',{ userId:profile._id, mode:'following'})}
          />
        </View>

        {/* Bio */}
        {profile.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {isSelf ? (
            <>
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={() => navigation.navigate('EditProfileScreen')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('QrScreen')}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={20} color="#000000" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  following ? styles.followingButton : styles.followButton
                ]}
                onPress={toggleFollow}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.primaryButtonText,
                  following ? styles.followingButtonText : styles.followButtonText
                ]}>
                  {following ? 'Following' : requested ? 'Requested' : 'Follow'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('ChatScreen', { 
                  recipientId: profile._id, 
                  headerUser: profile 
                })}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#000000" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('SelectChatScreen',{
                  shareType:'profile',
                  shareId:profile._id
                })}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={20} color="#000000" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {['Posts','Events','Calendar'].map((t,i)=>(
          (i===2 && !isSelf) ? null : (
            <TouchableOpacity key={t} style={styles.tabBtn} onPress={()=>setTab(i)}>
              <Text style={[styles.tabTxt, tab===i && styles.tabTxtActive]}>{t}</Text>
              {tab===i && <View style={styles.tabIndicator}/>}
            </TouchableOpacity>
          )
        ))}
      </View>
    </View>
  );

  /* photo cell ------------------------------------------------------ */
  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={styles.photoThumbnail}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PostDetailsScreen', { postId: item._id })}
    >
      <Image
        source={{ uri:`http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={styles.photoImage}
      />
    </TouchableOpacity>
  );

  /* ---------------- main return (switch by tab) ------------------- */
  if (tab === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <FlatList
          data={profile.photos || []}
          keyExtractor={p=>p._id}
          renderItem={renderPhoto}
          numColumns={COLS}
          ListHeaderComponent={Header}
          columnWrapperStyle={styles.photoRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={()=>fetchProfile(true)}/>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={80} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>
                {isSelf ? 'Share your first photo' : 'No posts to show'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    );
  }

  /* Events / Calendar in ScrollView */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={()=>fetchProfile(true)}/>
        }
        contentContainerStyle={styles.scrollContent}
      >
        <Header/>
        {tab === 1 && (
          <SharedEventsTab navigation={navigation} userId={profile._id} isSelf={isSelf}/>
        )}
        {tab === 2 && isSelf && (
          <CalendarTab navigation={navigation} userId={profile._id}/>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- tiny helpers ---------------- */
const Stat = ({ n, label, onPress }) => (
  <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.statContainer}>
    <Text style={styles.statNumber}>{n}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Profile Header
  profileHeader: {
    backgroundColor: '#FFFFFF',
  },
  profileInfoSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  
  // Avatar Section
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameSection: {
    marginLeft: 16,
    flex: 1,
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  pronouns: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  mutualText: {
    fontSize: 13,
    color: '#8E8E93',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statContainer: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Bio
  bioSection: {
    marginBottom: 20,
  },
  bioText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },

  // Actions
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: '#3797EF',
  },
  followButtonText: {
    color: '#FFFFFF',
  },
  followingButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  followingButtonText: {
    color: '#000000',
  },
  secondaryButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    position: 'relative',
  },
  tabTxt: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  tabTxtActive: {
    color: '#000000',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '80%',
    backgroundColor: '#000000',
    borderRadius: 1,
  },

  // Photos Grid
  listContent: {
    paddingBottom: 40,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  photoRow: {
    justifyContent: 'flex-start',
    paddingHorizontal: GAP,
  },
  photoThumbnail: {
    width: THUMB,
    height: THUMB,
    margin: GAP / 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});