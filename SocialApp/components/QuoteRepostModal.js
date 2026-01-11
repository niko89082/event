// components/QuoteRepostModal.js
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { repostAPI } from '../services/api';

const MAX_COMMENT_LENGTH = 500;

export default function QuoteRepostModal({
  visible,
  onClose,
  post,
  onRepostCreated,
}) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const textInputRef = useRef(null);

  useEffect(() => {
    if (visible && textInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    } else {
      setComment('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!post?._id) {
      Alert.alert('Error', 'Post information is missing');
      return;
    }

    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      Alert.alert('Error', 'Please enter a comment for your quote repost');
      return;
    }

    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      Alert.alert('Error', `Comment must be ${MAX_COMMENT_LENGTH} characters or less`);
      return;
    }

    setLoading(true);

    try {
      const response = await repostAPI.quoteRepost(post._id, trimmedComment);
      
      if (onRepostCreated) {
        onRepostCreated(response.data.repost);
      }
      
      setComment('');
      onClose();
    } catch (error) {
      console.error('Error creating quote repost:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to create quote repost. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setComment('');
    onClose();
  };

  const remainingChars = MAX_COMMENT_LENGTH - comment.length;
  const isOverLimit = remainingChars < 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Quote Repost</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, (loading || !comment.trim() || isOverLimit) && styles.submitButtonDisabled]}
              disabled={loading || !comment.trim() || isOverLimit}
            >
              <Text style={[styles.submitText, (loading || !comment.trim() || isOverLimit) && styles.submitTextDisabled]}>
                {loading ? 'Posting...' : 'Repost'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Original Post Preview */}
            {post && (
              <View style={styles.postPreview}>
                <View style={styles.postPreviewHeader}>
                  <Text style={styles.previewLabel}>Reposting:</Text>
                </View>
                <View style={styles.postPreviewContent}>
                  {post.user && (
                    <Text style={styles.previewAuthor}>
                      @{post.user.username || 'unknown'}
                    </Text>
                  )}
                  {post.textContent && (
                    <Text style={styles.previewText} numberOfLines={3}>
                      {post.textContent}
                    </Text>
                  )}
                  {post.caption && !post.textContent && (
                    <Text style={styles.previewText} numberOfLines={3}>
                      {post.caption}
                    </Text>
                  )}
                  {post.paths && post.paths.length > 0 && (
                    <View style={styles.previewMedia}>
                      <Ionicons name="image" size={16} color="#8E8E93" />
                      <Text style={styles.previewMediaText}>
                        {post.paths.length} photo{post.paths.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Comment Input */}
            <View style={styles.inputContainer}>
              <TextInput
                ref={textInputRef}
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor="#8E8E93"
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                value={comment}
                onChangeText={setComment}
                autoFocus={false}
              />
              <View style={styles.inputFooter}>
                <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
                  {remainingChars}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  cancelButton: {
    padding: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3797EF',
    borderRadius: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitTextDisabled: {
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  postPreview: {
    margin: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  postPreviewHeader: {
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  postPreviewContent: {
    gap: 4,
  },
  previewAuthor: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  previewText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
  },
  previewMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  previewMediaText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  inputContainer: {
    margin: 16,
    marginTop: 8,
  },
  input: {
    minHeight: 120,
    fontSize: 16,
    color: '#000000',
    textAlignVertical: 'top',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 13,
    color: '#8E8E93',
  },
  charCountOver: {
    color: '#ED4956',
  },
});


