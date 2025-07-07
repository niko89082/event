// components/FormBuilder.js - Phase 3: Core Form Building Logic
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList from 'react-native-draggable-flatlist';

const QUESTION_VALIDATION = {
  short_answer: {
    minLength: 1,
    maxLength: 500,
    required: false
  },
  multiple_choice: {
    minOptions: 2,
    maxOptions: 10,
    required: false
  },
  checkbox: {
    minOptions: 2,
    maxOptions: 15,
    required: false
  },
  yes_no: {
    required: false
  },
  rating: {
    minScale: 1,
    maxScale: 10,
    defaultScale: 5,
    required: false
  },
  email: {
    validation: 'email',
    required: false
  },
  phone: {
    validation: 'phone',
    required: false
  },
  number: {
    min: null,
    max: null,
    allowDecimals: true,
    required: false
  }
};

const QUESTION_ICONS = {
  short_answer: 'text-outline',
  multiple_choice: 'radio-button-on-outline',
  checkbox: 'checkbox-outline',
  yes_no: 'checkmark-circle-outline',
  rating: 'star-outline',
  email: 'mail-outline',
  phone: 'call-outline',
  number: 'calculator-outline'
};

const QUESTION_COLORS = {
  short_answer: '#3797EF',
  multiple_choice: '#34C759',
  checkbox: '#FF9500',
  yes_no: '#5856D6',
  rating: '#FF3B30',
  email: '#007AFF',
  phone: '#00C7BE',
  number: '#8E8E93'
};

export default function FormBuilder({
  questions = [],
  onQuestionsChange,
  onQuestionEdit,
  readonly = false,
  showPreview = true
}) {
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const scrollViewRef = useRef(null);

  const generateQuestionId = () => {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addQuestion = (type) => {
    const newQuestion = createDefaultQuestion(type);
    const updatedQuestions = [...questions, newQuestion];
    onQuestionsChange?.(updatedQuestions);
    
    // Auto-open editor for new question
    setTimeout(() => {
      onQuestionEdit?.(newQuestion);
    }, 100);
  };

  const createDefaultQuestion = (type) => {
    const defaults = {
      id: generateQuestionId(),
      type,
      question: '',
      required: false,
      placeholder: '',
      order: questions.length
    };

    switch (type) {
      case 'multiple_choice':
      case 'checkbox':
        return {
          ...defaults,
          options: ['Option 1', 'Option 2']
        };
      case 'rating':
        return {
          ...defaults,
          scale: 5,
          minLabel: '',
          maxLabel: ''
        };
      case 'number':
        return {
          ...defaults,
          min: null,
          max: null,
          allowDecimals: true
        };
      case 'short_answer':
        return {
          ...defaults,
          maxLength: 100
        };
      default:
        return defaults;
    }
  };

  const duplicateQuestion = (question) => {
    const duplicated = {
      ...question,
      id: generateQuestionId(),
      question: `${question.question} (Copy)`,
      order: questions.length
    };
    
    const originalIndex = questions.findIndex(q => q.id === question.id);
    const updatedQuestions = [...questions];
    updatedQuestions.splice(originalIndex + 1, 0, duplicated);
    
    onQuestionsChange?.(updatedQuestions);
  };

  const deleteQuestion = (questionId) => {
    Alert.alert(
      'Delete Question',
      'Are you sure you want to delete this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedQuestions = questions.filter(q => q.id !== questionId);
            onQuestionsChange?.(updatedQuestions);
          }
        }
      ]
    );
  };

  const reorderQuestions = ({ data }) => {
    const reorderedQuestions = data.map((question, index) => ({
      ...question,
      order: index
    }));
    onQuestionsChange?.(reorderedQuestions);
  };

  const validateQuestion = (question) => {
    const validation = QUESTION_VALIDATION[question.type];
    const errors = [];

    if (!question.question.trim()) {
      errors.push('Question text is required');
    }

    if (['multiple_choice', 'checkbox'].includes(question.type)) {
      const validOptions = question.options?.filter(opt => opt.trim()) || [];
      if (validOptions.length < validation.minOptions) {
        errors.push(`At least ${validation.minOptions} options are required`);
      }
      if (validOptions.length > validation.maxOptions) {
        errors.push(`Maximum ${validation.maxOptions} options allowed`);
      }
    }

    if (question.type === 'rating') {
      if (question.scale < 1 || question.scale > 10) {
        errors.push('Rating scale must be between 1 and 10');
      }
    }

    if (question.type === 'number') {
      if (question.min !== null && question.max !== null && question.min >= question.max) {
        errors.push('Minimum value must be less than maximum value');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const getQuestionTypeLabel = (type) => {
    const labels = {
      short_answer: 'Short Answer',
      multiple_choice: 'Multiple Choice',
      checkbox: 'Checkboxes',
      yes_no: 'Yes/No',
      rating: 'Rating Scale',
      email: 'Email',
      phone: 'Phone',
      number: 'Number'
    };
    return labels[type] || type;
  };

  const renderQuestionPreview = (question) => {
    switch (question.type) {
      case 'multiple_choice':
        return (
          <View style={styles.previewContainer}>
            {(question.options || []).slice(0, 3).map((option, index) => (
              <View key={index} style={styles.previewOption}>
                <Ionicons name="radio-button-off-outline" size={16} color="#C7C7CC" />
                <Text style={styles.previewOptionText}>{option}</Text>
              </View>
            ))}
            {(question.options?.length || 0) > 3 && (
              <Text style={styles.moreOptionsText}>
                +{question.options.length - 3} more options
              </Text>
            )}
          </View>
        );

      case 'checkbox':
        return (
          <View style={styles.previewContainer}>
            {(question.options || []).slice(0, 3).map((option, index) => (
              <View key={index} style={styles.previewOption}>
                <Ionicons name="square-outline" size={16} color="#C7C7CC" />
                <Text style={styles.previewOptionText}>{option}</Text>
              </View>
            ))}
            {(question.options?.length || 0) > 3 && (
              <Text style={styles.moreOptionsText}>
                +{question.options.length - 3} more options
              </Text>
            )}
          </View>
        );

      case 'yes_no':
        return (
          <View style={styles.previewContainer}>
            <View style={styles.previewOption}>
              <Ionicons name="radio-button-off-outline" size={16} color="#C7C7CC" />
              <Text style={styles.previewOptionText}>Yes</Text>
            </View>
            <View style={styles.previewOption}>
              <Ionicons name="radio-button-off-outline" size={16} color="#C7C7CC" />
              <Text style={styles.previewOptionText}>No</Text>
            </View>
          </View>
        );

      case 'rating':
        return (
          <View style={styles.previewContainer}>
            <View style={styles.ratingPreview}>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons 
                  key={star} 
                  name="star-outline" 
                  size={20} 
                  color="#FFD700" 
                  style={styles.ratingStar}
                />
              ))}
              <Text style={styles.ratingText}>
                1 to {question.scale || 5}
              </Text>
            </View>
          </View>
        );

      case 'short_answer':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <View style={styles.previewContainer}>
            <View style={styles.inputPreview}>
              <Text style={styles.inputPreviewText}>
                {question.placeholder || 'Enter your answer...'}
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderQuestionItem = ({ item: question, drag, isActive }) => {
    const validation = validateQuestion(question);
    const hasErrors = !validation.isValid;

    return (
      <TouchableOpacity
        style={[
          styles.questionItem,
          isActive && styles.questionItemActive,
          hasErrors && styles.questionItemError
        ]}
        onPress={() => !readonly && onQuestionEdit?.(question)}
        onLongPress={!readonly ? drag : undefined}
        disabled={readonly}
        activeOpacity={0.8}
      >
        <View style={styles.questionHeader}>
          <View style={styles.questionIconContainer}>
            <Ionicons
              name={QUESTION_ICONS[question.type] || 'help-outline'}
              size={20}
              color={QUESTION_COLORS[question.type] || '#8E8E93'}
            />
          </View>
          
          <View style={styles.questionContent}>
            <Text style={styles.questionText}>
              {question.question || 'Untitled Question'}
            </Text>
            <View style={styles.questionMeta}>
              <Text style={styles.questionType}>
                {getQuestionTypeLabel(question.type)}
              </Text>
              {question.required && (
                <Text style={styles.requiredIndicator}> • Required</Text>
              )}
              {hasErrors && (
                <Text style={styles.errorIndicator}> • Has errors</Text>
              )}
            </View>
          </View>

          {!readonly && (
            <View style={styles.questionActions}>
              <TouchableOpacity
                onPress={() => duplicateQuestion(question)}
                style={styles.questionAction}
              >
                <Ionicons name="copy-outline" size={18} color="#8E8E93" />
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => deleteQuestion(question.id)}
                style={styles.questionAction}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </TouchableOpacity>
              
              <View style={styles.dragHandle}>
                <Ionicons name="reorder-two-outline" size={18} color="#C7C7CC" />
              </View>
            </View>
          )}
        </View>
        
        {/* Question Preview */}
        {showPreview && renderQuestionPreview(question)}
        
        {/* Error Messages */}
        {hasErrors && (
          <View style={styles.errorContainer}>
            {validation.errors.map((error, index) => (
              <Text key={index} style={styles.errorText}>
                • {error}
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="help-circle-outline" size={48} color="#C7C7CC" />
      <Text style={styles.emptyStateTitle}>No Questions Yet</Text>
      <Text style={styles.emptyStateDesc}>
        Add questions to collect information from your attendees
      </Text>
    </View>
  );

  const renderQuestionsList = () => {
    if (questions.length === 0) {
      return renderEmptyState();
    }

    if (readonly) {
      return (
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderQuestionItem({ item, drag: () => {}, isActive: false })}
          style={styles.questionsList}
          scrollEnabled={false}
        />
      );
    }

    return (
      <DraggableFlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={renderQuestionItem}
        onDragEnd={reorderQuestions}
        style={styles.questionsList}
        scrollEnabled={false}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderQuestionsList()}
      
      {/* Form Statistics */}
      {questions.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="help-circle-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {questions.filter(q => q.required).length} required
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              ~{Math.max(1, Math.ceil(questions.length * 0.5))} min to complete
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  questionsList: {
    flex: 1,
  },
  
  // Question items
  questionItem: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  questionItemActive: {
    backgroundColor: '#E8F5FF',
    borderColor: '#3797EF',
    transform: [{ scale: 1.02 }],
  },
  questionItemError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  questionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  questionContent: {
    flex: 1,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    lineHeight: 22,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionType: {
    fontSize: 14,
    color: '#8E8E93',
  },
  requiredIndicator: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  errorIndicator: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  questionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  questionAction: {
    padding: 8,
    marginLeft: 4,
  },
  dragHandle: {
    padding: 8,
    marginLeft: 4,
  },

  // Question previews
  previewContainer: {
    marginTop: 8,
    paddingLeft: 44,
  },
  previewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewOptionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  moreOptionsText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
  },
  ratingPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    marginRight: 4,
  },
  ratingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  inputPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  inputPreviewText: {
    fontSize: 14,
    color: '#C7C7CC',
    fontStyle: 'italic',
  },

  // Error display
  errorContainer: {
    marginTop: 8,
    paddingLeft: 44,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE5E5',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Statistics
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});