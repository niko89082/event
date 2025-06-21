// screens/ConversationListScreen.js - FIXED with proper header for iPhone 13 notch
import React, {
  useState, useEffect, useCallback, useContext, useRef
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Image, StatusBar, SafeAreaView
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { AuthContext } from '../../services/AuthContext';
import { API_BASE_URL } from '@env';

/* ── helpers ─────────────────────────────────────────────── */
const defaultPfp = 'https://placehold.co/48x48.png?text=%F0%9F%91%A4';

const niceDate = (iso) => {
  if (!iso) return '';
  const t = new Date(iso); 
  if (isNaN(t)) return '';
  const diff = Date.now() - t.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const weeks = Math.floor(d / 7);
  if (weeks < 4) return `${weeks}w`;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/* determine what to show under the title */
const snippetFor = (msg, self) => {
  if (!msg) return '';
  if (msg.content?.startsWith('/uploads/photos/')) return (self ? 'You sent a photo' : 'Sent a photo');
  if (msg.shareType) {
    const map = { 
      post: 'Shared a post', 
      event: 'Shared an event',
      memory: 'Shared a memory', 
      profile: 'Shared a profile' 
    };
    return (self ? 'You: ' : '') + (map[msg.shareType] || 'Shared something');
  }
  const content = msg.content || '';
  if (content.length > 30) {
    return (self ? 'You: ' : '') + content.substring(0, 30) + '...';
  }
  return (self ? 'You: ' : '') + content;
};

/* ────────────────────────────────────────────────────────── */

export default function ConversationListScreen() {
  const { currentUser } = useContext(AuthContext);
  const uid = currentUser._id;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [convos, setConvos] = useState([]);
  const [loading, setLoad] = useState(true);
  const socketRef = useRef(null);

  /* FIXED: Better header setup for iPhone 13 with custom header */
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // We'll create our own header
    });
  }, [navigation]);

  /* live socket updates */
  useEffect(() => {
    const s = io(`http://${API_BASE_URL}:3000`);
    socketRef.current = s;
    s.on('message', (m) => bumpList(m.conversationId, m));
    s.on('conversationCreated', (c) => setConvos(p => [c, ...p]));
    return () => s.disconnect();
  }, []);

  /* refetch whenever screen gains focus */
  useFocusEffect(
    useCallback(() => { 
      (async () => fetchConvos())(); 
    }, [])
  );

  const fetchConvos = async () => {
    try {
      setLoad(true);
      const { data } = await api.get('/api/messages/my-conversations');
      // Sort by most recent message
      const sorted = data.sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.createdAt);
        const bTime = new Date(b.lastMessageAt || b.createdAt);
        return bTime - aTime;
      });
      setConvos(sorted);
    } catch (e) { 
      console.log(e); 
    } finally { 
      setLoad(false); 
    }
  };

  const bumpList = (id, msg) => {
    setConvos(prev => {
      const i = prev.findIndex(c => c._id === id);
      if (i < 0) return prev;
      const u = { 
        ...prev[i], 
        lastMessage: msg, 
        lastMessageAt: msg.createdAt || msg.timestamp,
        unread: String(msg.sender._id) !== String(uid)
      };
      return [u, ...prev.filter((_, idx) => idx !== i)];
    });
  };

  const openChat = (c) => {
    /* pick header user */
    const other = c.isGroup
      ? { username: c.group?.name, profilePicture: null }
      : c.participants.find(u => String(u._id) !== String(uid));

    navigation.navigate('ChatScreen', {
      conversationId: c._id,
      groupId: c.isGroup ? c.group._id : undefined,
      recipientId: !c.isGroup ? other._id : undefined,
      headerUser: other
    });

    // Mark as read
    setConvos(p => p.map(x => x._id === c._id ? { ...x, unread: false } : x));
  };

  const renderItem = ({ item }) => {
    const isGroup = item.isGroup;
    const other = isGroup
      ? { username: item.group?.name, profilePicture: null }
      : item.participants.find(u => String(u._id) !== String(uid));

    const avatar = other?.profilePicture
      ? `http://${API_BASE_URL}:3000${other.profilePicture}`
      : defaultPfp;

    const last = item.lastMessage;
    const snippet = snippetFor(last, String(last?.sender?._id) === String(uid));
    const when = niceDate(last?.createdAt || last?.timestamp);
    const isUnread = item.unread && String(last?.sender?._id) !== String(uid);

    return (
      <TouchableOpacity 
        style={[styles.chatRow, isUnread && styles.unreadRow]} 
        onPress={() => openChat(item)}
        activeOpacity={0.95}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          {isUnread && <View style={styles.unreadIndicator} />}
        </View>
        
        <View style={styles.messageContent}>
          <View style={styles.topRow}>
            <Text style={[styles.username, isUnread && styles.unreadText]} numberOfLines={1}>
              {other?.username || 'Unknown'}
            </Text>
            <Text style={[styles.timestamp, isUnread && styles.unreadTimestamp]}>
              {when}
            </Text>
          </View>
          
          <View style={styles.bottomRow}>
            <Text 
              style={[styles.messagePreview, isUnread && styles.unreadMessage]} 
              numberOfLines={2}
            >
              {snippet || 'Say hello 👋'}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerLoading}>
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* FIXED: Custom header that properly handles iPhone 13 notch */}
      <View style={[styles.customHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewChatScreen')}
            style={styles.newChatButton}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={24} color="#3797EF" />
            <Text style={styles.newChatText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {convos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>Your Messages</Text>
          <Text style={styles.emptySubtitle}>
            Send private photos and messages to a friend or group.
          </Text>
          <TouchableOpacity 
            style={styles.sendMessageButton}
            onPress={() => navigation.navigate('NewChatScreen')}
            activeOpacity={0.8}
          >
            <Text style={styles.sendMessageText}>Send Message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={c => c._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

/* ── styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // FIXED: Custom header styles for proper positioning
  customHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newChatText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContainer: {
    paddingTop: 4,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.33,
    borderBottomColor: '#F0F0F0',
  },
  unreadRow: {
    backgroundColor: '#F8F9FA',
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16, // Square with rounded corners
    backgroundColor: '#F6F6F6',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3797EF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '400',
  },
  unreadTimestamp: {
    color: '#3797EF',
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    fontWeight: '400',
    lineHeight: 18,
  },
  unreadMessage: {
    color: '#000000',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3797EF',
    marginLeft: 8,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  sendMessageButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendMessageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});