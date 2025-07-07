// components/QuestionTypeSelector.js - Phase 3: Question Type Selection
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const QUESTION_TYPES = [
  {
    type: 'short_answer',
    label: 'Short Answer',
    icon: 'text-outline',
    description: 'Single line text input',
    color: '#3797EF',
    examples: ['Name', 'Department', 'Phone number']
  },
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    icon: 'radio-button-on-outline',
    description: 'Select one option from a list',
    color: '#34C759',
    examples: ['How did you hear about us?', 'What\'s your role?']
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    icon: 'checkbox-outline',
    description: 'Select multiple options',
    color: '#FF9500',
    examples: ['Which topics interest you?', 'Dietary restrictions']
  },
  {
    type: 'yes_no',
    label: 'Yes/No',
    icon: 'checkmark-circle-outline',
    description: 'Simple yes or no question',
    color: '#5856D6',
    examples: ['First time attending?', 'Need parking?']
  },
  {
    type: 'rating',
    label: 'Rating Scale',
    icon: 'star-outline',
    description: '1-5 star rating',
    color: '#FF3B30',
    examples: ['Rate this event', 'How satisfied are you?']
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'mail-outline',
    description: 'Email address input with validation',
    color: '#007AFF',
    examples: ['Contact email', 'Work email']
  },
  {
    type: 'phone',
    label: 'Phone Number',
    icon: 'call-outline',
    description: 'Phone number input with formatting',
    color: '#00C7BE',
    examples: ['Emergency contact', 'Mobile number']
  },
  {
    type: 'number',
    label: 'Number',
    icon: 'calculator-outline',
    description: 'Numeric input only',
    color: '#8E8E93',
    examples: ['Age', 'Years of experience', 'Group size']
  }
];

export default function QuestionTypeSelector({ 
  visible, 
  onSelect, 
  onClose,
  showExamples = true 
}) {
  
  const renderQuestionType = ({ item }) => (
    <TouchableOpacity
      style={styles.typeItem}
      onPress={() => onSelect(item.type)}
      activeOpacity={0.8}
    >
      <View style={[styles.typeIcon, { backgroundColor: `${item.color}15` }]}>
        <Ionicons name={item.icon} size={28} color={item.color} />
      </View>
      
      <View style={styles.typeContent}>
        <Text style={styles.typeLabel}>{item.label}</Text>
        <Text style={styles.typeDescription}>{item.description}</Text>
        
        {showExamples && item.examples && (
          <View style={styles.examplesContainer}>
            <Text style={styles.examplesLabel}>Examples:</Text>
            <Text style={styles.examplesText}>
              {item.examples.join(' • ')}
            </Text>
          </View>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Choose Question Type</Text>
      <Text style={styles.headerDescription}>
        Select the type of information you want to collect
      </Text>
    </View>
  );

  const renderCategories = () => {
    const basicTypes = QUESTION_TYPES.filter(type => 
      ['short_answer', 'multiple_choice', 'checkbox', 'yes_no'].includes(type.type)
    );
    
    const advancedTypes = QUESTION_TYPES.filter(type => 
      ['rating', 'email', 'phone', 'number'].includes(type.type)
    );

    return (
      <View style={styles.categoriesContainer}>
        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>Basic Question Types</Text>
          <Text style={styles.categoryDescription}>
            Most commonly used question formats
          </Text>
          {basicTypes.map(type => (
            <View key={type.type}>
              {renderQuestionType({ item: type })}
            </View>
          ))}
        </View>

        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>Advanced Question Types</Text>
          <Text style={styles.categoryDescription}>
            Specialized inputs with validation
          </Text>
          {advancedTypes.map(type => (
            <View key={type.type}>
              {renderQuestionType({ item: type })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Question</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={[{ key: 'content' }]}
            renderItem={() => (
              <View>
                {renderHeader()}
                {renderCategories()}
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Header section
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
  },

  // Categories
  categoriesContainer: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#8E8E93',
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  // Question type items
  typeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  typeContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 8,
  },
  examplesContainer: {
    marginTop: 4,
  },
  examplesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 2,
  },
  examplesText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});