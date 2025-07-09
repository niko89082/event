// screens/ChatInfoScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Button, TextInput,
  ScrollView, SafeAreaView, StatusBar, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { AuthContext } from '../../services/AuthContext';
import { API_BASE_URL } from '@env';
import UserProfileRow from '../../components/UserProfileRow';
import SharedPostSnippet from '../../components/SharedPostSnippet';
import SharedEventSnippet from '../../components/SharedEventSnippet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatInfoScreen({ route, navigation }) {
  const { conversationId } = route.params || {};
  const { currentUser } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [chatInfo, setChatInfo] = useState(null);
  const [error, setError] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

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
      headerTitle: 'Chat Details',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    fetchChatInfo();
  }, [conversationId]);

  const fetchChatInfo = async () => {
    if (!conversationId) {
      setError('No conversationId provided');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/messages/conversation/${conversationId}/info`);
      setChatInfo(res.data);
      if (res.data.group) {
        setNewGroupName(res.data.group.name || '');
      }
    } catch (err) {
      console.error('ChatInfoScreen => fetchChatInfo => error:', err.response?.data || err);
      setError(err.response?.data?.message || 'Failed to load chat info');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    try {
      // You'll need to implement this endpoint
      await api.post(`/api/groups/${chatInfo.group._id}/rename`, {
        newName: newGroupName.trim()
      });
      Alert.alert('Success', 'Group renamed successfully');
      setShowRenameModal(false);
      fetchChatInfo(); // Refresh
    } catch (err) {
      Alert.alert('Error', 'Failed to rename group');
    }
  };

  const handleLeaveChat = () => {
    Alert.alert(
      'Leave Chat',
      'Are you sure you want to leave this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/messages/conversation/${conversationId}`);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to leave chat');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading chat info...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchChatInfo} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!chatInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No info available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { conversation, group, recentPhotos, recentShares } = chatInfo;
  const isGroup = !!group;
  const otherUser = !isGroup 
    ? conversation.participants?.find(p => p._id !== currentUser._id)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          {isGroup ? (
            <>
              <View style={styles.groupAvatarContainer}>
                <View style={styles.groupAvatar}>
                  <Ionicons name="people" size={32} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.chatTitle}>{group.name}</Text>
              <Text style={styles.membersCount}>
                {conversation.participants?.length || 0} members
              </Text>
              
              <TouchableOpacity 
                style={styles.renameButton}
                onPress={() => setShowRenameModal(true)}
              >
                <Ionicons name="create-outline" size={16} color="#3797EF" />
                <Text style={styles.renameButtonText}>Rename Group</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Image
                source={{
                  uri: otherUser?.profilePicture
                    ? `http://${API_BASE_URL}:3000${otherUser.profilePicture}`
                    : 'https://placehold.co/80x80.png?text=👤'
                }}
                style={styles.userAvatar}
              />
              <Text style={styles.chatTitle}>{otherUser?.username || 'Unknown User'}</Text>
              <TouchableOpacity 
                style={styles.viewProfileButton}
                onPress={() => navigation.navigate('ProfileScreen', { userId: otherUser?._id })}
              >
                <Text style={styles.viewProfileText}>View Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Members Section */}
        {isGroup && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.sectionContent}>
              {conversation.participants?.map((user) => (
                <UserProfileRow
                  key={user._id}
                  user={user}
                  onPress={() => navigation.navigate('ProfileScreen', { userId: user._id })}
                />
              ))}
            </View>
          </View>
        )}

        {/* Media Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Media</Text>
          <View style={styles.sectionContent}>
            {(!recentPhotos || recentPhotos.length === 0) ? (
              <Text style={styles.noMediaText}>No shared photos</Text>
            ) : (
              <View style={styles.mediaGrid}>
                {recentPhotos.slice(0, 6).map((photoPath, index) => {
                  const uri = `http://${API_BASE_URL}:3000${photoPath}`;
                  return (
                    <TouchableOpacity key={index} style={styles.mediaItem}>
                      <Image source={{ uri }} style={styles.mediaImage} />
                    </TouchableOpacity>
                  );
                })}
                {recentPhotos.length > 6 && (
                  <TouchableOpacity style={[styles.mediaItem, styles.moreMediaItem]}>
                    <Text style={styles.moreMediaText}>+{recentPhotos.length - 6}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Shared Content Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Content</Text>
          <View style={styles.sectionContent}>
            {(!recentShares || recentShares.length === 0) ? (
              <Text style={styles.noMediaText}>No shared content</Text>
            ) : (
              recentShares.map((msg) => {
                if (msg.shareType === 'post') {
                  return <SharedPostSnippet key={msg._id} message={msg} senderName={msg.sender?.username || 'Someone'} />;
                } else if (msg.shareType === 'event') {
                  return <SharedEventSnippet key={msg._id} message={msg} senderName={msg.sender?.username || 'Someone'} />;
                }
                return null;
              })
            )}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <View style={styles.sectionContent}>
            {!isGroup && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {/* Block user logic */}}
              >
                <Ionicons name="ban-outline" size={20} color="#FF3B30" />
                <Text style={styles.actionButtonText}>Block User</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.dangerAction]}
              onPress={handleLeaveChat}
            >
              <Ionicons name="exit-outline" size={20} color="#FF3B30" />
              <Text style={[styles.actionButtonText, styles.dangerText]}>
                {isGroup ? 'Leave Group' : 'Delete Conversation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Rename Modal */}
      {showRenameModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Group</Text>
            <TextInput
              style={styles.modalInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Enter group name"
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleRenameGroup}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  groupAvatarContainer: {
    marginBottom: 16,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  chatTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  membersCount: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
  },
  renameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
  },
  renameButtonText: {
    color: '#3797EF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  viewProfileButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewProfileText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionContent: {
    paddingHorizontal: 16,
  },
  noMediaText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Media Grid
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  mediaItem: {
    width: (SCREEN_WIDTH - 36) / 3,
    height: (SCREEN_WIDTH - 36) / 3,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  moreMediaItem: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMediaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },

  // Actions
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 12,
  },
  dangerAction: {
    backgroundColor: '#FFF0F0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginLeft: 12,
  },
  dangerText: {
    color: '#FF3B30',
  },

  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: SCREEN_WIDTH - 64,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#3797EF',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});