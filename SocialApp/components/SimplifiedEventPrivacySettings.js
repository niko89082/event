// components/SimplifiedEventPrivacySettings.js - Cleaned up privacy without redundant toggles
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  SafeAreaView, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIVACY_LEVELS = [
  {
    key: 'public',
    label: 'Public Event',
    description: 'Anyone can discover and join',
    icon: 'globe-outline',
    color: '#34C759',
    details: 'Appears in search • Visible in feeds • Open to everyone'
  },
  {
    key: 'friends',
    label: 'Friends Only',
    description: 'Only your followers can see and join',
    icon: 'people-outline',
    color: '#3797EF',
    details: 'Visible to followers • Limited discovery'
  },
  {
    key: 'private',
    label: 'Private Event',
    description: 'Invitation only, but attendees can share',
    icon: 'lock-closed-outline',
    color: '#FF9500',
    details: 'Invitation required • Hidden from search • Attendees can invite'
  },
  {
    key: 'secret',
    label: 'Secret Event',
    description: 'Completely hidden, host controls everything',
    icon: 'eye-off-outline',
    color: '#FF3B30',
    details: 'Maximum privacy • Host-only invitations • No public sharing'
  }
];

export default function SimplifiedEventPrivacySettings({
  privacyLevel,
  onPrivacyChange,
  style
}) {
  const [showModal, setShowModal] = useState(false);

  const selectedPrivacy = PRIVACY_LEVELS.find(p => p.key === privacyLevel) || PRIVACY_LEVELS[0];

  const handlePrivacySelect = (newPrivacy) => {
    onPrivacyChange(newPrivacy);
    setShowModal(false);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Privacy Level</Text>
      <Text style={styles.sectionDescription}>
        Controls who can see and join your event
      </Text>

      <TouchableOpacity
        style={styles.privacySelector}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.privacySelectorContent}>
          <View style={[styles.privacyIcon, { backgroundColor: selectedPrivacy.color }]}>
            <Ionicons name={selectedPrivacy.icon} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.privacyInfo}>
            <Text style={styles.privacyLabel}>{selectedPrivacy.label}</Text>
            <Text style={styles.privacyDescription}>{selectedPrivacy.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </View>
      </TouchableOpacity>

      <View style={styles.privacyHint}>
        <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
        <Text style={styles.privacyHintText}>{selectedPrivacy.details}</Text>
      </View>

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
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Privacy Level</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {PRIVACY_LEVELS.map(privacy => (
              <TouchableOpacity
                key={privacy.key}
                style={[
                  styles.privacyOption,
                  privacyLevel === privacy.key && styles.selectedPrivacyOption
                ]}
                onPress={() => handlePrivacySelect(privacy.key)}
                activeOpacity={0.8}
              >
                <View style={styles.privacyOptionContent}>
                  <View style={[styles.privacyOptionIcon, { backgroundColor: privacy.color }]}>
                    <Ionicons name={privacy.icon} size={28} color="#FFFFFF" />
                  </View>
                  <View style={styles.privacyOptionInfo}>
                    <Text style={styles.privacyOptionLabel}>{privacy.label}</Text>
                    <Text style={styles.privacyOptionDescription}>{privacy.description}</Text>
                    <Text style={styles.privacyOptionDetails}>{privacy.details}</Text>
                  </View>
                  {privacyLevel === privacy.key && (
                    <Ionicons name="checkmark-circle" size={24} color={privacy.color} />
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  privacySelector: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  privacySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
  privacyHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  privacyHintText: {
    flex: 1,
    fontSize: 13,
    color: '#3797EF',
    lineHeight: 18,
  },

  // Modal styles
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
    fontSize: 17,
    color: '#3797EF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  privacyOption: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPrivacyOption: {
    backgroundColor: '#F0F9FF',
    borderColor: '#3797EF',
  },
  privacyOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
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
    fontSize: 16,
    color: '#666666',
    marginBottom: 6,
  },
  privacyOptionDetails: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
});