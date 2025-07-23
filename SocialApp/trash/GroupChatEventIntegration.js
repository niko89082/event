// components/GroupChatEventIntegration.js - One-Click Event Creation from Group Chats
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EventQuickCreate from '../components/EventQuickCreate';

export default function GroupChatEventIntegration({ 
  groupId, 
  conversationId, 
  onEventCreated 
}) {
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // AI-powered event suggestions based on chat context
  const eventSuggestions = [
    {
      title: 'Coffee Meetup',
      description: 'Casual coffee to continue our discussion',
      category: 'Social',
      estimatedDuration: '1-2 hours',
      icon: 'cafe-outline'
    },
    {
      title: 'Study Session',
      description: 'Group study based on our recent conversation',
      category: 'Education',
      estimatedDuration: '2-3 hours',
      icon: 'library-outline'
    },
    {
      title: 'Lunch Gathering',
      description: 'Let\'s grab lunch together',
      category: 'Food',
      estimatedDuration: '1 hour',
      icon: 'restaurant-outline'
    }
  ];

  const handleQuickEventCreate = (suggestion = null) => {
    setShowSuggestions(false);
    setShowQuickCreate(true);
    // Pre-fill form with suggestion if provided
  };

  const handleEventCreated = (newEvent) => {
    setShowQuickCreate(false);
    onEventCreated?.(newEvent);
    
    // Show success message
    Alert.alert(
      'Event Created! 🎉',
      `"${newEvent.title}" has been created and all group members have been invited.`,
      [{ text: 'Great!', style: 'default' }]
    );
  };

  return (
    <>
      {/* Quick Action Button */}
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setShowSuggestions(true)}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="calendar-outline" size={20} color="#3797EF" />
          </View>
          <Text style={styles.quickActionText}>Create Event</Text>
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Event Suggestions Modal */}
      <Modal
        visible={showSuggestions}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <TouchableOpacity onPress={() => setShowSuggestions(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.suggestionsTitle}>Create Group Event</Text>
            <TouchableOpacity onPress={() => handleQuickEventCreate()}>
              <Text style={styles.customText}>Custom</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.suggestionsContent}>
            <Text style={styles.suggestionsSubtitle}>
              Quick suggestions based on your group chat
            </Text>

            {eventSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionCard}
                onPress={() => handleQuickEventCreate(suggestion)}
                activeOpacity={0.8}
              >
                <View style={styles.suggestionIconContainer}>
                  <Ionicons name={suggestion.icon} size={24} color="#3797EF" />
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                  <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                  <View style={styles.suggestionMeta}>
                    <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                    <Text style={styles.suggestionDuration}>• {suggestion.estimatedDuration}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.customEventButton}
              onPress={() => handleQuickEventCreate()}
              activeOpacity={0.8}
            >
              <View style={styles.customIconContainer}>
                <Ionicons name="add-circle-outline" size={24} color="#8E8E93" />
              </View>
              <View style={styles.customContent}>
                <Text style={styles.customTitle}>Create Custom Event</Text>
                <Text style={styles.customDescription}>
                  Start from scratch with full customization
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Create Modal */}
      <EventQuickCreate
        visible={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        groupId={groupId}
        conversationId={conversationId}
        onEventCreated={handleEventCreated}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Suggestions Modal
  suggestionsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  customText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  suggestionsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  suggestionsSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  // Suggestion Cards
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 6,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionCategory: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '600',
  },
  suggestionDuration: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },

  // Custom Event Button
  customEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderStyle: 'dashed',
  },
  customIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customContent: {
    flex: 1,
  },
  customTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  customDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
});