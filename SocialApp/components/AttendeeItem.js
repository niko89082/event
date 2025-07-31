// components/AttendeeItem.js - Enhanced attendee item with swipe-to-delete and check-in
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
  style = {},
}) {
  const [isCheckInLoading, setIsCheckInLoading] = useState(false);
  
  // Check if attendee is checked in
  const isCheckedIn = canManage && event?.checkedIn?.includes(attendee._id);
  const hasFormResponse = canManage && event?.requiresFormForCheckIn && attendee.formSubmission;

  // Handle check-in toggle with loading state
  const handleCheckInToggle = async () => {
    if (isCheckInLoading) return;
    
    setIsCheckInLoading(true);
    try {
      await onCheckInToggle(attendee._id, isCheckedIn);
    } catch (error) {
      console.error('Check-in toggle error:', error);
      Alert.alert('Error', 'Failed to update check-in status');
    } finally {
      setIsCheckInLoading(false);
    }
  };

  // Handle removal with confirmation
  const handleRemove = async () => {
    return new Promise((resolve, reject) => {
      Alert.alert(
        'Remove Attendee',
        `Remove ${attendee.username || attendee.firstName} from the event?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => reject(new Error('Cancelled'))
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await onRemove(attendee._id);
                resolve();
              } catch (error) {
                reject(error);
              }
            },
          },
        ]
      );
    });
  };

  const renderContent = () => (
    <View style={[styles.attendeeItem, style]}>
      {/* Bulk Selection Checkbox */}
      {bulkMode && canManage && (
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => onToggleSelection(attendee._id)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Main Attendee Content */}
      <TouchableOpacity
        style={styles.attendeeContent}
        onPress={() => onViewProfile(attendee._id)}
        activeOpacity={0.8}
      >
        {/* Profile Picture */}
        <Image
          source={{
            uri: attendee.profilePicture
              ? `${attendee.profilePicture}?t=${Date.now()}`
              : 'https://via.placeholder.com/40x40/CCCCCC/FFFFFF?text=?'
          }}
          style={styles.profilePicture}
          defaultSource={{ uri: 'https://via.placeholder.com/40x40/CCCCCC/FFFFFF?text=?' }}
        />

        {/* Attendee Info */}
        <View style={styles.attendeeInfo}>
          <Text style={styles.attendeeName} numberOfLines={1}>
            {attendee.username || `${attendee.firstName} ${attendee.lastName}`.trim() || 'Unknown User'}
          </Text>
          
          {attendee.email && (
            <Text style={styles.attendeeEmail} numberOfLines={1}>
              {attendee.email}
            </Text>
          )}
          
          {/* Status Indicators */}
          <View style={styles.statusContainer}>
            {isCheckedIn && (
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#34C759" />
                <Text style={styles.statusText}>Checked In</Text>
              </View>
            )}
            
            {hasFormResponse && (
              <View style={[styles.statusBadge, styles.formBadge]}>
                <Ionicons name="document-text" size={12} color="#007AFF" />
                <Text style={[styles.statusText, styles.formText]}>Form Submitted</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Host Actions */}
      {canManage && !bulkMode && (
        <View style={styles.actionsContainer}>
          {/* Check-in Toggle Button */}
          <TouchableOpacity
            style={[
              styles.checkInButton,
              isCheckedIn ? styles.checkInButtonActive : styles.checkInButtonInactive
            ]}
            onPress={handleCheckInToggle}
            disabled={isCheckInLoading}
            activeOpacity={0.8}
          >
            {isCheckInLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons 
                  name={isCheckedIn ? "checkmark-circle" : "radio-button-off"} 
                  size={16} 
                  color="#FFFFFF" 
                />
                <Text style={styles.checkInButtonText}>
                  {isCheckedIn ? 'Undo' : 'Check In'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Form Response Button (if applicable) */}
          {hasFormResponse && (
            <TouchableOpacity
              style={styles.formButton}
              onPress={() => onViewFormResponses?.(attendee._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  // Wrap with SwipeableRow only if user can manage and not in bulk mode
  if (canManage && !bulkMode) {
    return (
      <SwipeableRow
        onDelete={handleRemove}
        deleteText="Remove"
        deleteColor="#FF3B30"
        disabled={bulkMode}
        style={style}
      >
        {renderContent()}
      </SwipeableRow>
    );
  }

  // Return plain content for non-managers or bulk mode
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
    borderBottomColor: '#E5E5E7',
    minHeight: 72,
  },
  checkboxContainer: {
    marginRight: 12,
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  attendeeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginRight: 12,
  },
  attendeeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  attendeeEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#E8F5E8',
    borderRadius: 4,
    gap: 3,
  },
  formBadge: {
    backgroundColor: '#E8F4FD',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#34C759',
  },
  formText: {
    color: '#007AFF',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    minWidth: 80,
    justifyContent: 'center',
  },
  checkInButtonActive: {
    backgroundColor: '#34C759',
  },
  checkInButtonInactive: {
    backgroundColor: '#007AFF',
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  formButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
});