// SocialApp/screens/EditMemoryScreen.js - FIXED VERSION
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

export default function EditMemoryScreen({ route, navigation }) {
  const { memoryId } = route.params;
  const { currentUser } = useContext(AuthContext);
  
  const [memory, setMemory] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ FIXED: Move handleSave outside useEffect to avoid stale closure
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Memory title is required.');
      return;
    }

    try {
      setSaving(true);
      
      // 🔍 DEBUG: Log all state values before sending
      console.log('🐛 DEBUG - State values before save:');
      console.log('  - title state:', JSON.stringify(title));
      console.log('  - description state:', JSON.stringify(description));
      console.log('  - title.trim():', JSON.stringify(title.trim()));
      console.log('  - description.trim():', JSON.stringify(description.trim()));
      
      const updateData = {
        title: title.trim(),
        description: description.trim()
      };
      
      // 🔍 DEBUG: Log the exact data being sent
      console.log('🐛 DEBUG - updateData object:', JSON.stringify(updateData));
      console.log('🐛 DEBUG - Sending PUT request to:', `/api/memories/${memoryId}`);
      
      const response = await api.put(`/api/memories/${memoryId}`, updateData);
      
      // 🔍 DEBUG: Log the response from backend
      console.log('🐛 DEBUG - Backend response:', JSON.stringify(response.data));
      
      Alert.alert(
        'Success',
        'Memory updated successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      
    } catch (error) {
      console.error('❌ Error updating memory:', error);
      console.log('🐛 DEBUG - Error response:', error.response?.data);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update memory.'
      );
    } finally {
      setSaving(false);
    }
  }, [title, description, memoryId, navigation]); // ✅ FIXED: Add dependencies

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
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: 'Edit Memory',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSave} // ✅ FIXED: Now uses the current handleSave function
          style={styles.headerButton}
          activeOpacity={0.7}
          disabled={saving || !title.trim()}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.saveButton, !title.trim() && styles.disabledButton]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, saving, title, handleSave]); // ✅ FIXED: Add handleSave to dependencies

  useEffect(() => {
    fetchMemory();
  }, [memoryId]);

const handleLeaveMemory = () => {
  Alert.alert(
    'Leave Memory',
    'Are you sure you want to leave this memory? You will no longer be able to view or add photos to it.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            
            // Call the remove participant API for current user
            await api.delete(`/api/memories/${memoryId}/participants/${currentUser._id}`);
            
            Alert.alert(
              'Left Memory',
              'You have successfully left this memory.',
              [{ 
                text: 'OK', 
                onPress: () => {
                  // Navigate back to memories list or home
                  navigation.navigate('MemoriesTab');
                }
              }]
            );
            
          } catch (error) {
            console.error('Error leaving memory:', error);
            const errorMessage = error.response?.data?.message || 'Failed to leave memory';
            Alert.alert('Error', errorMessage);
          } finally {
            setLoading(false);
          }
        }
      }
    ]
  );
};

 const fetchMemory = async () => {
  try {
    setLoading(true);
    const response = await api.get(`/api/memories/${memoryId}`);
    const memoryData = response.data.memory;
    
    // 🆕 UPDATED: Check if current user is creator OR participant
    const isCreator = memoryData.creator._id === currentUser._id;
    const isParticipant = memoryData.participants.some(p => p._id === currentUser._id);
    
    if (!isCreator && !isParticipant) {
      Alert.alert(
        'Access Denied',
        'Only memory participants can edit this memory.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    console.log('✅ User can edit memory:', { isCreator, isParticipant });
    
    setMemory(memoryData);
    setTitle(memoryData.title || '');
    setDescription(memoryData.description || '');
    
    // 🔍 DEBUG: Log initial values
    console.log('🐛 DEBUG - Initial memory data loaded:');
    console.log('  - title:', JSON.stringify(memoryData.title));
    console.log('  - description:', JSON.stringify(memoryData.description));
    
  } catch (error) {
    console.error('Error fetching memory:', error);
    Alert.alert(
      'Error',
      'Failed to load memory details.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  } finally {
    setLoading(false);
  }
};

  // Rest of the component remains the same...
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading memory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Memory not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            
            {/* Info Header */}
            <View style={styles.infoHeader}>
              <Ionicons name="library" size={48} color="#3797EF" />
              <Text style={styles.infoTitle}>Edit Memory</Text>
              <Text style={styles.infoSubtitle}>
                Update your memory details. Changes will be visible to all participants.
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Memory Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={(text) => {
                    console.log('🐛 DEBUG - Title changed to:', JSON.stringify(text));
                    setTitle(text);
                  }}
                  placeholder="e.g., Beach Trip 2024, Birthday Party..."
                  placeholderTextColor="#8E8E93"
                  maxLength={50}
                  autoFocus
                />
                <Text style={styles.charCount}>{title.length}/50</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={(text) => {
                    console.log('🐛 DEBUG - Description changed to:', JSON.stringify(text));
                    setDescription(text);
                  }}
                  placeholder="What made this moment special?"
                  placeholderTextColor="#8E8E93"
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{description.length}/200</Text>
              </View>

              {/* Memory Info */}
              <View style={styles.memoryInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                  <Text style={styles.infoText}>
                    Created {new Date(memory.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={20} color="#8E8E93" />
                  <Text style={styles.infoText}>
                    {(memory.participants?.length || 0) + 1} participants
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="image-outline" size={20} color="#8E8E93" />
                  <Text style={styles.infoText}>
                    {memory.photos?.length || 0} photos
                  </Text>
                </View>
              </View>

              {/* Privacy Notice */}
              <View style={styles.privacyNotice}>
                <Ionicons name="lock-closed" size={20} color="#FF9500" />
                <View style={styles.privacyText}>
                  <Text style={styles.privacyTitle}>Private Memory</Text>
                  <Text style={styles.privacyDescription}>
                    Only you and added participants can see this memory
                  </Text>
                </View>
              </View>

              {/* 🆕 NEW: Leave Memory Section - Only show for participants, not creator */}
              {memory && memory.creator._id !== currentUser._id && (
                <View style={styles.dangerSection}>
                  <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
                  <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={handleLeaveMemory}
                    disabled={loading}
                  >
                    <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                    <Text style={styles.leaveButtonText}>Leave Memory</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles remain the same as in the original file...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  disabledButton: {
    color: '#C7C7CC',
  },
  
  // Info Header
  infoHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Form Section
  formSection: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  
  // Memory Info
  memoryInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 12,
  },
  
  // Privacy Notice
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  privacyText: {
    flex: 1,
    marginLeft: 12,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  dangerSection: {
  marginTop: 32,
  paddingTop: 24,
  borderTopWidth: 1,
  borderTopColor: '#F0F0F0',
},
dangerSectionTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#8E8E93',
  marginBottom: 16,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
},
leaveButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#FF3B30',
  borderRadius: 12,
  paddingHorizontal: 20,
  paddingVertical: 16,
  gap: 8,
  shadowColor: '#FF3B30',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 2,
},
leaveButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FFFFFF',
},
leaveButtonDisabled: {
  backgroundColor: '#C7C7CC',
  shadowOpacity: 0,
  elevation: 0,
},
});