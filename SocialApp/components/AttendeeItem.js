// components/AttendeeItem.js - Enhanced attendee item with swipe-to-delete and toggle
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeableRow from './SwipeableRow';
import { API_BASE_URL } from '@env';

export default function AttendeeItem({
  attendee,
  event,
  canManage,
  bulkMode,
  isSelected,
  onToggleSelection,
  onRemove,
  onCheckInToggle,
  onViewProfile,
  onViewFormResponses,
  style = {},
}) {
  const [isToggling, setIsToggling] = useState(false);
  
  // Check if attendee is checked in
  const isCheckedIn = canManage && event?.checkedIn?.includes(attendee._id);
  const hasFormResponse = canManage && event?.requiresFormForCheckIn && attendee.formSubmission;

  // Handle check-in toggle with loading state
  const handleCheckInToggle = async () => {
    if (isToggling) return;
    
    setIsToggling(true);
    try {
      await onCheckInToggle(attendee._id, isCheckedIn);
    } catch (error) {
      console.error('Check-in toggle error:', error);
      Alert.alert('Error', 'Failed to update check-in status');
    } finally {
      setIsToggling(false);
    }
  };

  // Handle removal with confirmation
  const handleRemove = () => {
    Alert.alert(
      'Remove Attendee',
      `Remove ${attendee.username} from the event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(attendee._id),
        },
      ]
    );
  };

  const renderContent = () => (
    <View style={[styles.attendeeItem, style]}>
      {/* Main Attendee Info */}
      <TouchableOpacity
        style={styles.attendeeContent}
        onPress={() => onViewProfile(attendee._id)}
        activeOpacity={0.8}
      >
        <Image
          source={{
            uri: attendee.profilePicture
              ? `http://${API_BASE_URL}:3000${attendee.profilePicture}`
              : 'https://placehold.co/50x50.png?text=👤'
          }}
          style={styles.profilePicture}
        />
        
        <View style={styles.attendeeInfo}>
          <View style={styles.attendeeNameRow}>
            <Text style={styles.username}>{attendee.username}</Text>
            {/* Payment Badge (only for managers) */}
            {canManage && attendee.hasPaid && (
              <View style={styles.paidBadge}>
                <Ionicons name="card" size={12} color="#34C759" />
                <Text style={styles.paidText}>Paid</Text>
              </View>
            )}
          </View>
          
          {attendee.bio && <Text style={styles.bio}>{attendee.bio}</Text>}
          
          {/* Status Indicators (only for managers) */}
          {canManage && (
            <View style={styles.statusRow}>
              {isCheckedIn && (
                <View style={styles.checkedInBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.checkedInText}>Checked In</Text>
                </View>
              )}
              {hasFormResponse && (
                <View style={styles.formBadge}>
                  <Ionicons name="document-text" size={14} color="#3797EF" />
                  <Text style={styles.formText}>Form Done</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Host Actions (only in manage mode) */}
      {canManage && (
        <View style={styles.hostActions}>
          {/* Form Response Button */}
          {hasFormResponse && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onViewFormResponses(attendee)}
            >
              <Ionicons name="document-text" size={20} color="#3797EF" />
            </TouchableOpacity>
          )}
          
          {/* Enhanced Check-in Toggle */}
          <TouchableOpacity
            style={[
              styles.checkInToggle,
              isCheckedIn ? styles.checkedInToggle : styles.notCheckedInToggle
            ]}
            onPress={handleCheckInToggle}
            disabled={isToggling}
          >
            {isToggling ? (
              <ActivityIndicator size="small" color={isCheckedIn ? "#FFFFFF" : "#8E8E93"} />
            ) : (
              <Ionicons 
                name={isCheckedIn ? "checkmark" : "checkmark"} 
                size={20} 
                color={isCheckedIn ? "#FFFFFF" : "#8E8E93"}
              />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Wrap with swipeable row if user can manage
  if (canManage) {
    console.log('🔄 [ATTENDEE-ITEM] Rendering with SwipeableRow for:', attendee.username);
    return (
      <SwipeableRow
        onDelete={handleRemove}
        deleteText="Remove"
      >
        {renderContent()}
      </SwipeableRow>
    );
  }

  // Return regular content if no swipe functionality needed
  console.log('📱 [ATTENDEE-ITEM] Rendering without SwipeableRow for:', attendee.username);
  return renderContent();
}

const styles = StyleSheet.create({
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },

  attendeeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 12, // Square with curved corners (50/4 ≈ 12)
    marginRight: 12,
  },

  attendeeInfo: {
    flex: 1,
  },

  attendeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },

  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },

  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },

  paidText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
    marginLeft: 3,
  },

  bio: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },

  checkedInText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
    marginLeft: 3,
  },

  formBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },

  formText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 3,
  },

  hostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },

  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  checkInToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },

  checkedInToggle: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },

  notCheckedInToggle: {
    backgroundColor: 'transparent',
    borderColor: '#E1E1E1',
  },
});