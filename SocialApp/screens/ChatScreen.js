// screens/ChatScreen.js
import React, {
  useState, useEffect, useRef, useContext, useLayoutEffect
} from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  Image, TouchableOpacity, Alert, PanResponder,
  SafeAreaView, StatusBar, Animated, Keyboard
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { io } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import SharedPostSnippet from '../components/SharedPostSnippet';
import SharedEventSnippet from '../components/SharedEventSnippet';
import SharedMemorySnippet from '../components/SharedMemorySnippet';
import SharedProfileSnippet from '../components/SharedProfileSnippet';

const defaultPfp = 'https://placehold.co/48x48.png?text=%F0%9F%91%A4';

export default function ChatScreen({ route, navigation }) {
  const {
    conversationId,
    groupId,
    recipientId,
    headerUser
  } = route.params || {};

  const { currentUser } = useContext(AuthContext);
  const uid = currentUser._id;

  const [messages, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [photoUri, setPhoto] = useState(null);
  const [typing, setTyping] = useState([]);
  const [replyTo, setReply] = useState(null);
  const [keyboardHeight] = useState(new Animated.Value(0));

  const flatRef = useRef(null);
  const socketRef = useRef(null);
  const typingTO = useRef(null);
  const inputRef = useRef(null);

  // ─── Header ─────────────────────────────────────
  useLayoutEffect(() => {
    const avatarUri = headerUser?.profilePicture
      ? `http://${API_BASE_URL}:3000${headerUser.profilePicture}`
      : defaultPfp;

    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitleContainer}
          onPress={() => navigation.navigate('ChatInfoScreen', { conversationId })}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: avatarUri }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              {headerUser?.username || 'Chat'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Active now
            </Text>
          </View>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCreateMemory}
          activeOpacity={0.7}
        >
          <Ionicons name="albums-outline" size={24} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, conversationId, headerUser]);

  // ─── Keyboard handling ─────────────────────────
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardHeight, {
        duration: e.duration,
        toValue: e.endCoordinates.height,
        useNativeDriver: false,
      }).start();
    });

    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardHeight, {
        duration: e.duration,
        toValue: 0,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardWillShow?.remove();
      keyboardWillHide?.remove();
    };
  }, []);

  // ─── Socket wiring ──────────────────────────────
  useEffect(() => {
    const s = io(`http://${API_BASE_URL}:3000`);
    socketRef.current = s;
    const room = groupId || conversationId || recipientId;
    if (room) s.emit('joinRoom', { conversationId: room });

    s.on('message', handleIncoming);
    s.on('typing', ({ username }) => setTyping(ts => Array.from(new Set([...ts, username]))));
    s.on('stopTyping', ({ username }) => setTyping(ts => ts.filter(u => u !== username)));

    return () => s.disconnect();
  }, [conversationId, groupId, recipientId]);

  // ─── Incoming ───────────────────────────────────
  async function handleIncoming(m) {
    setMsgs(ms => [...ms, m]);
    if (m.sender._id !== uid) {
      await api.post(`/messages/seen/${m._id}`).catch(() => {});
      socketRef.current.emit('seen', { messageId: m._id });
    }
    // Auto scroll to bottom on new message
    setTimeout(() => {
      flatRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }

  // ─── Load history ───────────────────────────────
  useEffect(() => {
    (async () => {
      if (!conversationId) return;
      try {
        const { data } = await api.get(`/messages/conversation/byId/${conversationId}`);
        setMsgs(data.messages || []);
        setTimeout(() => {
          flatRef.current?.scrollToEnd({ animated: false });
        }, 100);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    })();
  }, [conversationId]);

  // ─── Typing indicator ───────────────────────────
  const onType = (text) => {
    setInput(text);
    if (socketRef.current && conversationId) {
      socketRef.current.emit('typing', { conversationId, username: currentUser.username });
      clearTimeout(typingTO.current);
      typingTO.current = setTimeout(() => {
        socketRef.current.emit('stopTyping', { conversationId, username: currentUser.username });
      }, 1200);
    }
  };

  // ─── Send message/photo ─────────────────────────
  const send = async () => {
    if (!input.trim() && !photoUri) return;
    const replyId = replyTo?._id;
    const messageText = input.trim();
    
    // Clear input immediately for better UX
    setInput('');
    setReply(null);
    
    try {
      if (messageText) {
        await api.post('/messages/send', {
          conversationId, recipientId, groupId,
          content: messageText, replyTo: replyId
        });
      }
      if (photoUri) {
        const fd = new FormData();
        fd.append('photo', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' });
        fd.append('conversationId', conversationId);
        if (replyId) fd.append('replyTo', replyId);
        await api.post('/messages/send/photo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPhoto(null);
      }
      
      if (socketRef.current) {
        socketRef.current.emit('stopTyping', { conversationId, username: currentUser.username });
      }
    } catch (e) {
      console.log('Send error:', e.response?.data || e);
      // Restore input on error
      setInput(messageText);
    }
  };

  // ─── Swipe-to-reply ─────────────────────────────
  const responderFor = (msg) => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dx > 30 && Math.abs(g.dy) < 30,
    onPanResponderRelease: () => setReply(msg),
  });

  // ─── Render each bubble ─────────────────────────
  const renderItem = ({ item, index }) => {
    const self = item.sender._id === uid;
    const nextMessage = messages[index + 1];
    const isLastFromSender = !nextMessage || nextMessage.sender._id !== item.sender._id;
    const prevMessage = messages[index - 1];
    const isFirstFromSender = !prevMessage || prevMessage.sender._id !== item.sender._id;
    
    // Show timestamp for first message or if >30min gap
    const showTime = isFirstFromSender || 
      (prevMessage && new Date(item.createdAt || item.timestamp) - new Date(prevMessage.createdAt || prevMessage.timestamp) > 30 * 60 * 1000);

    const bubbleStyle = {
      alignSelf: self ? 'flex-end' : 'flex-start',
      backgroundColor: self ? '#007AFF' : '#F0F0F0',
      marginTop: isFirstFromSender ? 8 : 2,
      marginBottom: isLastFromSender ? 8 : 2,
    };

    // Read receipt on last outgoing
    const lastOut = messages.filter(m => m.sender._id === uid).slice(-1)[0]?._id;
    const seen = item._id === lastOut && (item.seenBy?.length > 0);

    let body;
    switch (item.shareType) {
      case 'post': body = <SharedPostSnippet message={item} />; break;
      case 'event': body = <SharedEventSnippet message={item} />; break;
      case 'memory': body = <SharedMemorySnippet message={item} />; break;
      case 'profile': body = <SharedProfileSnippet message={item} />; break;
      default:
        if (item.content?.startsWith('/uploads/photos/')) {
          body = (
            <TouchableOpacity activeOpacity={0.9}>
              <Image
                source={{ uri: `http://${API_BASE_URL}:3000${item.content}` }}
                style={styles.messageImage}
              />
            </TouchableOpacity>
          );
        } else {
          body = (
            <Text style={[styles.messageText, self && styles.messageTextSelf]}>
              {item.content}
            </Text>
          );
        }
    }

    const pan = responderFor(item);

    return (
      <View style={styles.messageContainer}>
        {showTime && (
          <Text style={styles.timestamp}>
            {new Date(item.createdAt || item.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        )}
        
        <View style={styles.messageRow}>
          {!self && isLastFromSender && (
            <Image
              source={{ 
                uri: item.sender.profilePicture 
                  ? `http://${API_BASE_URL}:3000${item.sender.profilePicture}` 
                  : defaultPfp 
              }}
              style={styles.senderAvatar}
            />
          )}
          {!self && !isLastFromSender && <View style={styles.senderAvatarPlaceholder} />}
          
          <View {...pan.panHandlers} style={[styles.messageBubble, bubbleStyle]}>
            {item.replyTo && (
              <View style={[styles.replyContainer, self && styles.replyContainerSelf]}>
                <View style={styles.replyLine} />
                <Text style={[styles.replyText, self && styles.replyTextSelf]} numberOfLines={1}>
                  {item.replyTo.content || '📷 Photo'}
                </Text>
              </View>
            )}
            {body}
          </View>
          
          {seen && (
            <Image
              source={{ 
                uri: headerUser?.profilePicture 
                  ? `http://${API_BASE_URL}:3000${headerUser.profilePicture}` 
                  : defaultPfp 
              }}
              style={styles.seenAvatar}
            />
          )}
        </View>
      </View>
    );
  };

  // ─── Photo picker ───────────────────────────────
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
    }
  };

  // ─── Photo preview component ────────────────────
  const PhotoPreview = () => (
    <View style={styles.photoPreview}>
      <Image source={{ uri: photoUri }} style={styles.previewImage} />
      <TouchableOpacity
        style={styles.removePhotoButton}
        onPress={() => setPhoto(null)}
        activeOpacity={0.8}
      >
        <Ionicons name="close-circle" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Ionicons name="return-up-forward" size={16} color="#8E8E93" />
            <Text style={styles.replyBarText}>
              Reply to {replyTo.sender.username}
            </Text>
            <Text style={styles.replyBarMessage} numberOfLines={1}>
              {replyTo.content || '📷 Photo'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setReply(null)}
            style={styles.replyBarClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m._id}
        renderItem={renderItem}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />

      {!!typing.length && (
        <View style={styles.typingContainer}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>{typing.join(', ')} typing...</Text>
          </View>
        </View>
      )}

      {photoUri && <PhotoPreview />}

      <Animated.View style={[styles.inputContainer, { paddingBottom: keyboardHeight }]}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={pickPhoto}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={24} color="#8E8E93" />
          </TouchableOpacity>
          
          <View style={styles.textInputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={input}
              onChangeText={onType}
              placeholder="Message..."
              placeholderTextColor="#8E8E93"
              multiline
              maxLength={1000}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.sendButton, (input.trim() || photoUri) && styles.sendButtonActive]}
            onPress={send}
            activeOpacity={0.8}
            disabled={!input.trim() && !photoUri}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(input.trim() || photoUri) ? "#FFFFFF" : "#8E8E93"} 
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
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
    marginHorizontal: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  headerRightContainer: {
    // Removed - no longer needed
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  replyBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
    marginRight: 8,
  },
  replyBarMessage: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  replyBarClose: {
    padding: 4,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginVertical: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageRowSelf: {
    justifyContent: 'flex-end',
  },
  senderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 2,
  },
  senderAvatarPlaceholder: {
    width: 32,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  messageBubbleSelf: {
    backgroundColor: '#007AFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#F0F0F0',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  photoBubble: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  firstBubbleSelf: {
    marginTop: 8,
    borderTopRightRadius: 18,
  },
  firstBubbleOther: {
    marginTop: 8,
    borderTopLeftRadius: 18,
  },
  lastBubbleSelf: {
    marginBottom: 8,
    borderBottomRightRadius: 4,
  },
  lastBubbleOther: {
    marginBottom: 8,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 20,
  },
  messageTextSelf: {
    color: '#FFFFFF',
  },
  messageImage: {
    minWidth: 150,
    maxWidth: 250,
    minHeight: 100,
    maxHeight: 300,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  replyContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#8E8E93',
    paddingLeft: 8,
    marginBottom: 4,
  },
  replyContainerSelf: {
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
  },
  replyLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#8E8E93',
  },
  replyLineSelf: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  replyText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  replyTextSelf: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  seenAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 4,
    marginBottom: 2,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '75%',
  },
  typingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  photoPreview: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    position: 'relative',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cameraButton: {
    padding: 8,
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
});