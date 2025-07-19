// SocialApp/components/SimplifiedEventPrivacySettings.js - PHASE 1 COMPLETED: Fixed for React Native

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  SafeAreaView, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ✅ PHASE 1 COMPLETED: Self-contained privacy constants (no external dependencies)
const PRIVACY_LEVELS = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private'
};

const PRIVACY_LEVEL_INFO = {
  [PRIVACY_LEVELS.PUBLIC]: {
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
  [PRIVACY_LEVELS.FRIENDS]: {
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
  [PRIVACY_LEVELS.PRIVATE]: {
    label: 'Private Event',
    description: 'Invitation only, but attendees can share',
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
};

// ✅ PHASE 1 COMPLETED: Privacy levels array for UI
const PRIVACY_LEVELS_ARRAY = [
  {
    key: PRIVACY_LEVELS.PUBLIC,
    ...PRIVACY_LEVEL_INFO[PRIVACY_LEVELS.PUBLIC],
    guestPassSupport: 'full',
    guestPassInfo: 'Guest passes work seamlessly for everyone'
  },
  {
    key: PRIVACY_LEVELS.FRIENDS,
    ...PRIVACY_LEVEL_INFO[PRIVACY_LEVELS.FRIENDS],
    guestPassSupport: 'limited',
    guestPassInfo: 'Guest passes work, but event won\'t appear in public feeds'
  },
  {
    key: PRIVACY_LEVELS.PRIVATE,
    ...PRIVACY_LEVEL_INFO[PRIVACY_LEVELS.PRIVATE],
    guestPassSupport: 'full',
    guestPassInfo: 'Guest passes work perfectly for private invitations'
  }
];

export default function SimplifiedEventPrivacySettings({
  privacyLevel,
  onPrivacyChange,
  style,
  showGuestPassInfo = true
}) {
  const [showModal, setShowModal] = useState(false);

  // ✅ PHASE 1: Use standardized privacy levels
  const selectedPrivacy = PRIVACY_LEVELS_ARRAY.find(p => p.key === privacyLevel) || PRIVACY_LEVELS_ARRAY[0];

  const handlePrivacySelect = (newPrivacy) => {
    // ✅ PHASE 1: Updated warnings for 3 privacy levels only
    if (newPrivacy === PRIVACY_LEVELS.PRIVATE && privacyLevel !== PRIVACY_LEVELS.PRIVATE) {
      Alert.alert(
        'Private Event',
        'This event will require invitations to join. Only invited people will be able to see and attend the event.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              onPrivacyChange(newPrivacy);
              setShowModal(false);
            }
          }
        ]
      );
      return;
    }

    if (newPrivacy === PRIVACY_LEVELS.FRIENDS && privacyLevel !== PRIVACY_LEVELS.FRIENDS) {
      Alert.alert(
        'Friends Only Event',
        'This event will only be visible to your followers. Guest passes will still work, but the event won\'t appear in public feeds.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              onPrivacyChange(newPrivacy);
              setShowModal(false);
            }
          }
        ]
      );
      return;
    }

    // No warning needed for public events
    onPrivacyChange(newPrivacy);
    setShowModal(false);
  };

  const PrivacyLevelCard = ({ level, isSelected, onSelect }) => (
    <TouchableOpacity
      style={[styles.privacyCard, isSelected && styles.selectedCard]}
      onPress={() => onSelect(level.key)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: level.color + '20' }]}>
          <Ionicons name={level.icon} size={24} color={level.color} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{level.label}</Text>
          <Text style={styles.cardDescription}>{level.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color={level.color} />
          </View>
        )}
      </View>
      
      <View style={styles.featuresList}>
        {level.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark" size={16} color={level.color} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {showGuestPassInfo && (
        <View style={[styles.guestPassInfo, { borderColor: level.color + '30' }]}>
          <Text style={[styles.guestPassTitle, { color: level.color }]}>Guest Pass Support</Text>
          <Text style={styles.guestPassText}>{level.guestPassInfo}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.privacySelector} onPress={() => setShowModal(true)}>
        <View style={styles.selectorLeft}>
          <View style={[styles.iconContainer, { backgroundColor: selectedPrivacy.color + '20' }]}>
            <Ionicons name={selectedPrivacy.icon} size={20} color={selectedPrivacy.color} />
          </View>
          <View style={styles.selectorInfo}>
            <Text style={styles.selectorTitle}>{selectedPrivacy.label}</Text>
            <Text style={styles.selectorDescription}>{selectedPrivacy.description}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Privacy Settings</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalDescription}>
              Choose who can discover and join your event. You can change this later.
            </Text>

            {PRIVACY_LEVELS_ARRAY.map((level) => (
              <PrivacyLevelCard
                key={level.key}
                level={level}
                isSelected={level.key === privacyLevel}
                onSelect={handlePrivacySelect}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  privacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectorInfo: {
    flex: 1,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  selectorDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Modal styles
  modal: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  cancelButton: {
    fontSize: 16,
    color: '#3797EF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: 60, // Same width as cancel button for centering
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  // Privacy card styles
  privacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedCard: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  checkmark: {
    marginLeft: 12,
  },

  // Features list
  featuresList: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
    flex: 1,
  },

  // Guest pass info
  guestPassInfo: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  guestPassTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  guestPassText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
});

// ✅ Export privacy constants for use in other components
export { PRIVACY_LEVELS, PRIVACY_LEVEL_INFO };