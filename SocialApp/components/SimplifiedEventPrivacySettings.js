// components/SimplifiedEventPrivacySettings.js - PHASE 1: Cleaned up to 3 privacy levels

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  SafeAreaView, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// PHASE 1: SIMPLIFIED TO 3 PRIVACY LEVELS ONLY
const PRIVACY_LEVELS = [
  {
    key: 'public',
    label: 'Public Event',
    description: 'Anyone can discover and join',
    icon: 'globe-outline',
    color: '#34C759',
    details: 'Appears in search • Visible in feeds • Open to everyone',
    guestPassSupport: 'full',
    guestPassInfo: 'Guest passes work seamlessly for everyone'
  },
  {
    key: 'friends',
    label: 'Friends Only',
    description: 'Only your followers can see and join',
    icon: 'people-outline',
    color: '#3797EF',
    details: 'Visible to followers • Limited discovery • Guest passes allowed',
    guestPassSupport: 'limited',
    guestPassInfo: 'Guest passes work, but event won\'t appear in public feeds'
  },
  {
    key: 'private',
    label: 'Private Event',
    description: 'Invitation only, but attendees can share',
    icon: 'lock-closed-outline',
    color: '#FF9500',
    details: 'Invitation required • Hidden from search • Attendees can invite',
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

  // Default to 'public' if invalid privacy level is provided
  const selectedPrivacy = PRIVACY_LEVELS.find(p => p.key === privacyLevel) || PRIVACY_LEVELS[0];

  const handlePrivacySelect = (newPrivacy) => {
    // PHASE 1: Updated warnings for simplified privacy levels
    if (newPrivacy === 'private' && privacyLevel !== 'private') {
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

    if (newPrivacy === 'friends' && privacyLevel !== 'friends') {
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

    // For public events, no warning needed
    onPrivacyChange(newPrivacy);
    setShowModal(false);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.privacySelector}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.privacySelectorContent}>
          <View style={[styles.iconContainer, { backgroundColor: selectedPrivacy.color }]}>
            <Ionicons name={selectedPrivacy.icon} size={20} color="#FFFFFF" />
          </View>
          <View style={styles.privacyInfo}>
            <Text style={styles.privacyLabel}>{selectedPrivacy.label}</Text>
            <Text style={styles.privacyDescription}>{selectedPrivacy.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </View>
      </TouchableOpacity>

      {/* Privacy Selection Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Event Privacy</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalDescription}>
              Choose who can see and join your event
            </Text>

            {PRIVACY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.key}
                style={[
                  styles.privacyOption,
                  privacyLevel === level.key && styles.selectedPrivacyOption
                ]}
                onPress={() => handlePrivacySelect(level.key)}
                activeOpacity={0.8}
              >
                <View style={styles.privacyOptionHeader}>
                  <View style={[styles.privacyOptionIcon, { backgroundColor: level.color }]}>
                    <Ionicons name={level.icon} size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.privacyOptionInfo}>
                    <Text style={styles.privacyOptionLabel}>{level.label}</Text>
                    <Text style={styles.privacyOptionDescription}>{level.description}</Text>
                  </View>
                  {privacyLevel === level.key && (
                    <Ionicons name="checkmark-circle" size={24} color={level.color} />
                  )}
                </View>

                <View style={styles.privacyDetails}>
                  <Text style={styles.privacyDetailsText}>{level.details}</Text>
                  
                  {showGuestPassInfo && (
                    <View style={styles.guestPassInfo}>
                      <Ionicons name="ticket-outline" size={16} color="#8E8E93" />
                      <Text style={styles.guestPassText}>{level.guestPassInfo}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  privacySelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  privacySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  privacyDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  cancelButton: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginVertical: 20,
  },

  // Privacy Option Styles
  privacyOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedPrivacyOption: {
    borderWidth: 2,
    borderColor: '#3797EF',
  },
  privacyOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  privacyOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  privacyOptionInfo: {
    flex: 1,
  },
  privacyOptionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  privacyOptionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  privacyDetails: {
    paddingLeft: 64,
  },
  privacyDetailsText: {
    fontSize: 13,
    color: '#6D6D72',
    lineHeight: 18,
    marginBottom: 8,
  },
  guestPassInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
  },
  guestPassText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 6,
    flex: 1,
  },
});