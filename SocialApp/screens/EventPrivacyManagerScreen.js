// screens/EventPrivacyManagerScreen.js - Advanced Privacy Control Screen
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Alert, Switch, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const PRIVACY_LEVELS = [
  {
    key: 'public',
    label: 'Public Event',
    description: 'Anyone can discover and join this event',
    icon: 'globe-outline',
    color: '#34C759',
    features: [
      'Appears in search results',
      'Visible in public feed',
      'Anyone can join',
      'Attendees can invite others',
      'Shareable on social media'
    ]
  },
  {
    key: 'friends',
    label: 'Friends Only',
    description: 'Only your followers can see and join',
    icon: 'people-outline',
    color: '#3797EF',
    features: [
      'Visible to followers only',
      'Followers can join directly',
      'Limited discovery',
      'Attendees can invite followers',
      'Private sharing'
    ]
  },
  {
    key: 'private',
    label: 'Private Event',
    description: 'Invitation only, but guests can share',
    icon: 'lock-closed-outline',
    color: '#FF9500',
    features: [
      'Invitation required to join',
      'Hidden from public search',
      'Attendees can invite others',
      'Host controls initial invites',
      'Shareable with invites'
    ]
  }
];

const PERMISSION_PRESETS = {
  public: {
    canView: 'anyone',
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  },
  friends: {
    canView: 'followers',
    canJoin: 'followers',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: false
  },
  private: {
    canView: 'invitees',
    canJoin: 'invited',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: false,
    appearInSearch: false,
    showAttendeesToPublic: false
  }
};

export default function EventPrivacyManagerScreen({ route, navigation }) {
  const { eventId } = route.params || {};
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  
  // Privacy settings
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [permissions, setPermissions] = useState(PERMISSION_PRESETS.public);
  const [customSettings, setCustomSettings] = useState(false);

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
      headerTitle: 'Privacy Settings',
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
          onPress={handleSave}
          style={styles.headerButton}
          activeOpacity={0.7}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, saving && styles.saveButtonDisabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, saving]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  useEffect(() => {
    // Auto-apply preset when privacy level changes
    if (!customSettings) {
      setPermissions(PERMISSION_PRESETS[privacyLevel] || PERMISSION_PRESETS.public);
    }
  }, [privacyLevel, customSettings]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/events/${eventId}`);
      setEvent(data);
      setPrivacyLevel(data.privacyLevel || 'public');
      setPermissions(data.permissions || PERMISSION_PRESETS.public);
      
      // Check if using custom settings
      const currentPreset = PERMISSION_PRESETS[data.privacyLevel || 'public'];
      const isCustom = JSON.stringify(currentPreset) !== JSON.stringify(data.permissions);
      setCustomSettings(isCustom);
    } catch (error) {
      console.error('Fetch event error:', error);
      Alert.alert('Error', 'Unable to load event settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/events/${eventId}`, {
        privacyLevel,
        permissions: JSON.stringify(permissions)
      });
      Alert.alert('Success', 'Privacy settings updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePrivacyLevelChange = (newLevel) => {
    setPrivacyLevel(newLevel);
    setCustomSettings(false);
    setShowPresetModal(false);
  };

  const handlePermissionChange = (key, value) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
    setCustomSettings(true);
  };

  const renderPrivacyLevelSelector = () => {
    const currentLevel = PRIVACY_LEVELS.find(l => l.key === privacyLevel) || PRIVACY_LEVELS[0];
    
    return (
      <TouchableOpacity
        style={styles.privacyLevelCard}
        onPress={() => setShowPresetModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.privacyLevelHeader}>
          <View style={[styles.privacyIconContainer, { backgroundColor: currentLevel.color }]}>
            <Ionicons name={currentLevel.icon} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.privacyLevelInfo}>
            <Text style={styles.privacyLevelLabel}>{currentLevel.label}</Text>
            <Text style={styles.privacyLevelDescription}>{currentLevel.description}</Text>
            {customSettings && (
              <Text style={styles.customBadge}>Custom Settings Applied</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderPresetModal = () => (
    <Modal
      visible={showPresetModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPresetModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPresetModal(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Privacy Level</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalSubtitle}>
            Choose how people can discover and interact with your event
          </Text>
          
          {PRIVACY_LEVELS.map(level => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.privacyPresetCard,
                privacyLevel === level.key && styles.selectedPresetCard
              ]}
              onPress={() => handlePrivacyLevelChange(level.key)}
              activeOpacity={0.8}
            >
              <View style={styles.presetHeader}>
                <View style={[styles.presetIconContainer, { backgroundColor: level.color }]}>
                  <Ionicons name={level.icon} size={20} color="#FFFFFF" />
                </View>
                <View style={styles.presetInfo}>
                  <Text style={styles.presetLabel}>{level.label}</Text>
                  <Text style={styles.presetDescription}>{level.description}</Text>
                </View>
                {privacyLevel === level.key && (
                  <Ionicons name="checkmark-circle" size={24} color={level.color} />
                )}
              </View>
              
              <View style={styles.presetFeatures}>
                {level.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={16} color={level.color} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderAdvancedSettings = () => (
    <View style={styles.advancedSection}>
      <Text style={styles.sectionTitle}>Advanced Settings</Text>
      <Text style={styles.sectionSubtitle}>
        Customize individual permissions for fine-grained control
      </Text>
      
      {/* Discovery Settings */}
      <View style={styles.settingsGroup}>
        <Text style={styles.groupTitle}>Discovery</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Appear in Feed</Text>
            <Text style={styles.settingDescription}>Show in users' event feeds</Text>
          </View>
          <Switch
            value={permissions.appearInFeed}
            onValueChange={(value) => handlePermissionChange('appearInFeed', value)}
            trackColor={{ false: '#E1E1E1', true: '#3797EF' }}
            thumbColor={'#FFFFFF'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Appear in Search</Text>
            <Text style={styles.settingDescription}>Allow discovery through search</Text>
          </View>
          <Switch
            value={permissions.appearInSearch}
            onValueChange={(value) => handlePermissionChange('appearInSearch', value)}
            trackColor={{ false: '#E1E1E1', true: '#3797EF' }}
            thumbColor={'#FFFFFF'}
          />
        </View>
      </View>

      {/* Attendance Settings */}
      <View style={styles.settingsGroup}>
        <Text style={styles.groupTitle}>Attendance</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Show Attendees Publicly</Text>
            <Text style={styles.settingDescription}>Display attendee list to everyone</Text>
          </View>
          <Switch
            value={permissions.showAttendeesToPublic}
            onValueChange={(value) => handlePermissionChange('showAttendeesToPublic', value)}
            trackColor={{ false: '#E1E1E1', true: '#3797EF' }}
            thumbColor={'#FFFFFF'}
          />
        </View>
      </View>
    </View>
  );

  const renderImpactWarning = () => {
    if (privacyLevel === 'public') return null;
    
    const impacts = [];
    if (privacyLevel === 'friends') {
      impacts.push('Only your followers will see this event');
    }
    if (privacyLevel === 'private') {
      impacts.push('Event won\'t appear in search results');
      impacts.push('Only invited users can join');
    }
    if (privacyLevel === 'secret') {
      impacts.push('Event is completely hidden from discovery');
      impacts.push('You control all invitations and sharing');
    }

    return (
      <View style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Ionicons name="information-circle-outline" size={20} color="#FF9500" />
          <Text style={styles.warningTitle}>Privacy Impact</Text>
        </View>
        {impacts.map((impact, index) => (
          <Text key={index} style={styles.warningText}>• {impact}</Text>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading privacy settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Event Info Header */}
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{event?.title}</Text>
          <Text style={styles.eventDate}>
            {new Date(event?.time).toLocaleDateString()}
          </Text>
        </View>

        {/* Privacy Level Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Level</Text>
          <Text style={styles.sectionSubtitle}>
            Choose who can see and interact with your event
          </Text>
          {renderPrivacyLevelSelector()}
        </View>

        {/* Impact Warning */}
        {renderImpactWarning()}

        {/* Advanced Settings */}
        {renderAdvancedSettings()}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setPermissions(PERMISSION_PRESETS[privacyLevel]);
              setCustomSettings(false);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#8E8E93" />
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderPresetModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  saveButtonDisabled: {
    color: '#8E8E93',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  scrollContainer: {
    flex: 1,
  },

  // Event Header
  eventHeader: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Sections
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },

  // Privacy Level Card
  privacyLevelCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  privacyLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  privacyLevelInfo: {
    flex: 1,
  },
  privacyLevelLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  privacyLevelDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  customBadge: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '600',
    marginTop: 4,
  },

  // Warning Card
  warningCard: {
    backgroundColor: '#FFF8F0',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    lineHeight: 16,
    marginBottom: 2,
  },

  // Advanced Settings
  advancedSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingsGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },

  // Quick Actions
  quickActions: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginBottom: 32,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  resetButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginLeft: 6,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },

  // Privacy Preset Cards
  privacyPresetCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPresetCard: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  presetIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  presetInfo: {
    flex: 1,
  },
  presetLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  presetFeatures: {
    paddingLeft: 56,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
    lineHeight: 16,
  },
});