// components/EventPrivacySettings.js - Advanced Privacy Controls Component
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList,
  Switch, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIVACY_LEVELS = [
  {
    key: 'public',
    label: 'Public',
    description: 'Anyone can discover and join this event',
    icon: 'globe-outline',
    color: '#34C759',
    features: ['Appears in search results', 'Visible in public feed', 'Anyone can join']
  },
  {
    key: 'friends',
    label: 'Friends Only',
    description: 'Only your followers can see and join',
    icon: 'people-outline',
    color: '#3797EF',
    features: ['Visible to followers only', 'Followers can join', 'Limited discovery']
  },
  {
    key: 'private',
    label: 'Private',
    description: 'Invitation only, but guests can share',
    icon: 'lock-closed-outline',
    color: '#FF9500',
    features: ['Invitation required', 'Hidden from search', 'Attendees can invite others']
  },
  {
    key: 'secret',
    label: 'Secret',
    description: 'Completely hidden, host controls everything',
    icon: 'eye-off-outline',
    color: '#FF3B30',
    features: ['Completely hidden', 'Host-only invitations', 'No sharing allowed']
  }
];

const PERMISSION_OPTIONS = {
  canView: [
    { key: 'anyone', label: 'Anyone', description: 'Public visibility' },
    { key: 'followers', label: 'Followers Only', description: 'Your followers can see' },
    { key: 'invitees', label: 'Invited Users Only', description: 'Only invited people' },
    { key: 'host-only', label: 'Host Only', description: 'Only you can see' }
  ],
  canJoin: [
    { key: 'anyone', label: 'Anyone Can Join', description: 'Open registration' },
    { key: 'followers', label: 'Followers Can Join', description: 'Your followers can join' },
    { key: 'invited', label: 'Invitation Required', description: 'Must be invited' },
    { key: 'approval-required', label: 'Approval Required', description: 'You approve each request' }
  ],
  canShare: [
    { key: 'anyone', label: 'Anyone Can Share', description: 'Public sharing allowed' },
    { key: 'attendees', label: 'Attendees Can Share', description: 'Only attendees can share' },
    { key: 'co-hosts', label: 'Co-hosts Only', description: 'Only co-hosts can share' },
    { key: 'host-only', label: 'Host Only', description: 'Only you can share' }
  ],
  canInvite: [
    { key: 'anyone', label: 'Anyone Can Invite', description: 'Open invitations' },
    { key: 'attendees', label: 'Attendees Can Invite', description: 'Attendees can invite others' },
    { key: 'co-hosts', label: 'Co-hosts Only', description: 'Only co-hosts can invite' },
    { key: 'host-only', label: 'Host Only', description: 'Only you can invite' }
  ]
};

export default function EventPrivacySettings({
  privacyLevel,
  permissions,
  onPrivacyChange,
  onPermissionsChange,
  style
}) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [currentPermission, setCurrentPermission] = useState(null);
  const [localPermissions, setLocalPermissions] = useState({
    canView: 'anyone',
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true,
    ...permissions
  });

  useEffect(() => {
    // Auto-adjust permissions based on privacy level
    const newPermissions = { ...localPermissions };
    
    switch (privacyLevel) {
      case 'public':
        newPermissions.canView = 'anyone';
        newPermissions.canJoin = 'anyone';
        newPermissions.appearInFeed = true;
        newPermissions.appearInSearch = true;
        newPermissions.showAttendeesToPublic = true;
        break;
      case 'friends':
        newPermissions.canView = 'followers';
        newPermissions.canJoin = 'followers';
        newPermissions.appearInFeed = true;
        newPermissions.appearInSearch = true;
        break;
      case 'private':
        newPermissions.canView = 'invitees';
        newPermissions.canJoin = 'invited';
        newPermissions.appearInFeed = false;
        newPermissions.appearInSearch = false;
        break;
      case 'secret':
        newPermissions.canView = 'invitees';
        newPermissions.canJoin = 'invited';
        newPermissions.canShare = 'host-only';
        newPermissions.canInvite = 'host-only';
        newPermissions.appearInFeed = false;
        newPermissions.appearInSearch = false;
        newPermissions.showAttendeesToPublic = false;
        break;
    }
    
    setLocalPermissions(newPermissions);
    onPermissionsChange(newPermissions);
  }, [privacyLevel]);

  const selectedPrivacy = PRIVACY_LEVELS.find(p => p.key === privacyLevel) || PRIVACY_LEVELS[0];

  const handlePermissionChange = (permissionKey, value) => {
    const updated = { ...localPermissions, [permissionKey]: value };
    setLocalPermissions(updated);
    onPermissionsChange(updated);
  };

  const openPermissionModal = (permissionKey, label) => {
    setCurrentPermission({ key: permissionKey, label });
    setShowPermissionModal(true);
  };

  const renderPrivacyLevelModal = () => (
    <Modal
      visible={showPrivacyModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPrivacyModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Privacy Level</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {PRIVACY_LEVELS.map(level => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.privacyOption,
                privacyLevel === level.key && styles.selectedPrivacyOption
              ]}
              onPress={() => {
                onPrivacyChange(level.key);
                setShowPrivacyModal(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.privacyOptionHeader}>
                <View style={[styles.privacyIconContainer, { backgroundColor: level.color }]}>
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
              
              <View style={styles.privacyFeatures}>
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
      </View>
    </Modal>
  );

  const renderPermissionModal = () => {
    if (!currentPermission) return null;

    const options = PERMISSION_OPTIONS[currentPermission.key] || [];

    return (
      <Modal
        visible={showPermissionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPermissionModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{currentPermission.label}</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {options.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.permissionOption,
                  localPermissions[currentPermission.key] === option.key && styles.selectedPermissionOption
                ]}
                onPress={() => {
                  handlePermissionChange(currentPermission.key, option.key);
                  setShowPermissionModal(false);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.permissionOptionContent}>
                  <Text style={styles.permissionOptionLabel}>{option.label}</Text>
                  <Text style={styles.permissionOptionDescription}>{option.description}</Text>
                </View>
                {localPermissions[currentPermission.key] === option.key && (
                  <Ionicons name="checkmark" size={20} color="#3797EF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Privacy & Permissions</Text>
      
      {/* Privacy Level Selector */}
      <TouchableOpacity
        style={styles.privacyLevelCard}
        onPress={() => setShowPrivacyModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.privacyLevelHeader}>
          <View style={[styles.privacyIconContainer, { backgroundColor: selectedPrivacy.color }]}>
            <Ionicons name={selectedPrivacy.icon} size={20} color="#FFFFFF" />
          </View>
          <View style={styles.privacyLevelInfo}>
            <Text style={styles.privacyLevelLabel}>{selectedPrivacy.label}</Text>
            <Text style={styles.privacyLevelDescription}>{selectedPrivacy.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </View>
      </TouchableOpacity>

      {/* Granular Permissions */}
      <View style={styles.permissionsSection}>
        <Text style={styles.permissionsSectionTitle}>Detailed Permissions</Text>
        
        <View style={styles.permissionsGrid}>
          <TouchableOpacity
            style={styles.permissionCard}
            onPress={() => openPermissionModal('canView', 'Who Can View')}
            activeOpacity={0.8}
          >
            <View style={styles.permissionCardHeader}>
              <Ionicons name="eye-outline" size={20} color="#3797EF" />
              <Text style={styles.permissionCardTitle}>Who Can View</Text>
            </View>
            <Text style={styles.permissionCardValue}>
              {PERMISSION_OPTIONS.canView.find(o => o.key === localPermissions.canView)?.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionCard}
            onPress={() => openPermissionModal('canJoin', 'Who Can Join')}
            activeOpacity={0.8}
          >
            <View style={styles.permissionCardHeader}>
              <Ionicons name="person-add-outline" size={20} color="#3797EF" />
              <Text style={styles.permissionCardTitle}>Who Can Join</Text>
            </View>
            <Text style={styles.permissionCardValue}>
              {PERMISSION_OPTIONS.canJoin.find(o => o.key === localPermissions.canJoin)?.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionCard}
            onPress={() => openPermissionModal('canShare', 'Who Can Share')}
            activeOpacity={0.8}
          >
            <View style={styles.permissionCardHeader}>
              <Ionicons name="share-outline" size={20} color="#3797EF" />
              <Text style={styles.permissionCardTitle}>Who Can Share</Text>
            </View>
            <Text style={styles.permissionCardValue}>
              {PERMISSION_OPTIONS.canShare.find(o => o.key === localPermissions.canShare)?.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionCard}
            onPress={() => openPermissionModal('canInvite', 'Who Can Invite')}
            activeOpacity={0.8}
          >
            <View style={styles.permissionCardHeader}>
              <Ionicons name="mail-outline" size={20} color="#3797EF" />
              <Text style={styles.permissionCardTitle}>Who Can Invite</Text>
            </View>
            <Text style={styles.permissionCardValue}>
              {PERMISSION_OPTIONS.canInvite.find(o => o.key === localPermissions.canInvite)?.label}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Discovery Settings */}
      <View style={styles.discoverySection}>
        <Text style={styles.discoverySectionTitle}>Discovery Settings</Text>
        
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Appear in Feed</Text>
            <Text style={styles.toggleDescription}>Show in users' event feeds</Text>
          </View>
          <Switch
            value={localPermissions.appearInFeed}
            onValueChange={(value) => handlePermissionChange('appearInFeed', value)}
            trackColor={{ false: '#E1E1E1', true: '#3797EF' }}
            thumbColor={'#FFFFFF'}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Appear in Search</Text>
            <Text style={styles.toggleDescription}>Allow discovery through search</Text>
          </View>
          <Switch
            value={localPermissions.appearInSearch}
            onValueChange={(value) => handlePermissionChange('appearInSearch', value)}
            trackColor={{ false: '#E1E1E1', true: '#3797EF' }}
            thumbColor={'#FFFFFF'}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Show Attendees Publicly</Text>
            <Text style={styles.toggleDescription}>Display attendee list to everyone</Text>
          </View>
          <Switch
            value={localPermissions.showAttendeesToPublic}
            onValueChange={(value) => handlePermissionChange('showAttendeesToPublic', value)}
            trackColor={{ false: '#E1E1E1', true: '#3797EF' }}
            thumbColor={'#FFFFFF'}
          />
        </View>
      </View>

      {/* Privacy Info Box */}
      <View style={styles.privacyInfoBox}>
        <View style={styles.privacyInfoHeader}>
          <Ionicons name="information-circle-outline" size={20} color="#3797EF" />
          <Text style={styles.privacyInfoTitle}>Privacy Tip</Text>
        </View>
        <Text style={styles.privacyInfoText}>
          {privacyLevel === 'public' && 'Your event will be discoverable by anyone and appear in search results and feeds.'}
          {privacyLevel === 'friends' && 'Only your followers will be able to see and join this event.'}
          {privacyLevel === 'private' && 'This event requires invitations, but attendees can invite others and share the event.'}
          {privacyLevel === 'secret' && 'This event is completely hidden and only you can manage invitations and sharing.'}
        </Text>
      </View>

      {/* Modals */}
      {renderPrivacyLevelModal()}
      {renderPermissionModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
  },

  // Privacy Level Card
  privacyLevelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  privacyLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
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

  // Permissions Section
  permissionsSection: {
    marginBottom: 24,
  },
  permissionsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  permissionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  permissionCardValue: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
  },

  // Discovery Section
  discoverySection: {
    marginBottom: 24,
  },
  discoverySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Privacy Info Box
  privacyInfoBox: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3797EF',
  },
  privacyInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  privacyInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 8,
  },
  privacyInfoText: {
    fontSize: 12,
    color: '#3797EF',
    lineHeight: 16,
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

  // Privacy Option Styles
  privacyOption: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPrivacyOption: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
  },
  privacyOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyOptionInfo: {
    flex: 1,
    marginLeft: 16,
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
    lineHeight: 18,
  },
  privacyFeatures: {
    paddingLeft: 56,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
  },

  // Permission Option Styles
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedPermissionOption: {
    borderColor: '#3797EF',
    backgroundColor: '#F0F8FF',
  },
  permissionOptionContent: {
    flex: 1,
  },
  permissionOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  permissionOptionDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
});