// screens/FormSubmissionScreen.js - Phase 4: Complete Form Rendering for Check-in
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Switch, FlatList, Slider
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';

export default function FormSubmissionScreen({ navigation, route }) {
  const { 
    formId, 
    eventId, 
    userId, 
    onSubmissionComplete, 
    isCheckIn = false,
    mode = 'submit' 
  } = route.params || {};

  // Form data
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});

  // UI state
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [startTime] = useState(new Date());
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [focusedQuestion, setFocusedQuestion] = useState(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: isCheckIn ? 'Check-in Form' : 'Form',
      headerLeft: () => (
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit() || submitting}
          style={[styles.headerSubmitButton, (!canSubmit() || submitting) && styles.headerButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.headerSubmitText, (!canSubmit() || submitting) && styles.headerButtonTextDisabled]}>
              {form?.settings?.submitButtonText || 'Submit'}
            </Text>
          )}
        </TouchableOpacity>
      ),
    });

    loadForm();
  }, [responses, submitting]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/forms/${formId}`);
      const formData = response.data.form;
      
      setForm(formData);
      setShowProgressBar(formData.settings?.showProgressBar !== false);
      
      // Initialize responses for all questions
      const initialResponses = {};
      formData.questions?.forEach(question => {
        initialResponses[question.id] = question.type === 'checkbox' ? [] : 
                                       question.type === 'rating' ? 0 : '';
      });
      setResponses(initialResponses);
      
    } catch (error) {
      console.error('Error loading form:', error);
      Alert.alert('Error', 'Failed to load form');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const hasResponses = Object.values(responses).some(response => 
      Array.isArray(response) ? response.length > 0 : response
    );

    if (hasResponses) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved responses. Are you sure you want to leave?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const updateResponse = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear validation error for this question
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateResponses = () => {
    const errors = {};
    
    form?.questions?.forEach(question => {
      const response = responses[question.id];
      
      // Required field validation
      if (question.required) {
        if (question.type === 'checkbox') {
          if (!Array.isArray(response) || response.length === 0) {
            errors[question.id] = 'This field is required';
          }
        } else if (question.type === 'rating') {
          if (!response || response === 0) {
            errors[question.id] = 'Please provide a rating';
          }
        } else {
          if (!response || !response.toString().trim()) {
            errors[question.id] = 'This field is required';
          }
        }
      }
      
      // Type-specific validation
      if (response && response.toString().trim()) {
        switch (question.type) {
          case 'short_answer':
            if (question.maxLength && response.length > question.maxLength) {
              errors[question.id] = `Maximum ${question.maxLength} characters allowed`;
            }
            break;
          case 'rating':
            const rating = parseInt(response);
            if (isNaN(rating) || rating < 1 || rating > (question.maxRating || 5)) {
              errors[question.id] = `Rating must be between 1 and ${question.maxRating || 5}`;
            }
            break;
          case 'multiple_choice':
            if (!question.options?.includes(response)) {
              errors[question.id] = 'Invalid option selected';
            }
            break;
          case 'checkbox':
            if (Array.isArray(response)) {
              const invalidOptions = response.filter(option => !question.options?.includes(option));
              if (invalidOptions.length > 0) {
                errors[question.id] = 'Invalid options selected';
              }
            }
            break;
        }
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canSubmit = () => {
    if (!form || submitting) return false;
    
    // Check required fields
    return form.questions?.every(question => {
      if (!question.required) return true;
      
      const response = responses[question.id];
      if (question.type === 'checkbox') {
        return Array.isArray(response) && response.length > 0;
      } else if (question.type === 'rating') {
        return response && response > 0;
      }
      return response && response.toString().trim();
    });
  };

  const handleSubmit = async () => {
    if (!validateResponses() || submitting) return;

    try {
      setSubmitting(true);

      const completionTime = Math.round((new Date() - startTime) / 1000);
      
      // Format responses for submission
      const formattedResponses = form.questions.map(question => ({
        questionId: question.id,
        answer: responses[question.id]
      }));

      let endpoint;
      let payload;

      if (isCheckIn && eventId) {
        // Submit form as part of check-in process
        endpoint = `/api/events/${eventId}/checkin-with-form`;
        payload = {
          formResponses: formattedResponses,
          completionTime,
          targetUserId: userId // For host checking in others
        };
      } else {
        // Regular form submission
        endpoint = `/api/forms/${formId}/submit`;
        payload = {
          responses: formattedResponses,
          completionTime,
          eventId: eventId || null
        };
      }

      const response = await api.post(endpoint, payload);

      // Show success and navigate back
      if (isCheckIn) {
        Alert.alert(
          'Check-in Complete!',
          'Form submitted successfully. User has been checked in.',
          [
            { 
              text: 'Done', 
              onPress: () => {
                navigation.goBack();
                onSubmissionComplete?.();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Form Submitted!',
          'Thank you for your responses.',
          [
            { 
              text: 'Done', 
              onPress: () => {
                navigation.goBack();
                onSubmissionComplete?.();
              }
            }
          ]
        );
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert(
        'Submission Failed',
        error.response?.data?.message || 'Failed to submit form. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderProgressBar = () => {
    if (!showProgressBar || !form?.questions) return null;

    const completedQuestions = form.questions.filter(q => {
      const response = responses[q.id];
      if (q.type === 'checkbox') return Array.isArray(response) && response.length > 0;
      if (q.type === 'rating') return response && response > 0;
      return response && response.toString().trim();
    }).length;

    const progress = completedQuestions / form.questions.length;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedQuestions} of {form.questions.length} completed
        </Text>
      </View>
    );
  };

  const renderShortAnswerQuestion = (question) => (
    <View style={styles.questionContainer}>
      <View style={styles.questionHeader}>
        {form?.settings?.showQuestionNumbers && (
          <Text style={styles.questionNumber}>{question.order + 1}.</Text>
        )}
        <View style={styles.questionTitleContainer}>
          <Text style={styles.questionTitle}>
            {question.question}
            {question.required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      </View>

      {validationErrors[question.id] && (
        <Text style={styles.errorText}>{validationErrors[question.id]}</Text>
      )}

      <TextInput
        style={[
          styles.textInput,
          validationErrors[question.id] && styles.textInputError
        ]}
        value={responses[question.id] || ''}
        onChangeText={(text) => updateResponse(question.id, text)}
        placeholder={question.placeholder || 'Enter your answer...'}
        placeholderTextColor="#C7C7CC"
        maxLength={question.maxLength || 500}
        multiline={question.maxLength > 100}
        numberOfLines={question.maxLength > 100 ? 3 : 1}
        onFocus={() => setFocusedQuestion(question.id)}
        onBlur={() => setFocusedQuestion(null)}
      />

      {question.maxLength && (
        <Text style={styles.characterCount}>
          {(responses[question.id] || '').length} / {question.maxLength}
        </Text>
      )}
    </View>
  );

  const renderMultipleChoiceQuestion = (question) => (
    <View style={styles.questionContainer}>
      <View style={styles.questionHeader}>
        {form?.settings?.showQuestionNumbers && (
          <Text style={styles.questionNumber}>{question.order + 1}.</Text>
        )}
        <View style={styles.questionTitleContainer}>
          <Text style={styles.questionTitle}>
            {question.question}
            {question.required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      </View>

      {validationErrors[question.id] && (
        <Text style={styles.errorText}>{validationErrors[question.id]}</Text>
      )}

      <View style={styles.optionsContainer}>
        {question.options?.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              responses[question.id] === option && styles.optionButtonSelected
            ]}
            onPress={() => updateResponse(question.id, option)}
            activeOpacity={0.8}
          >
            <View style={[
              styles.radioButton,
              responses[question.id] === option && styles.radioButtonSelected
            ]}>
              {responses[question.id] === option && (
                <View style={styles.radioButtonInner} />
              )}
            </View>
            <Text style={[
              styles.optionText,
              responses[question.id] === option && styles.optionTextSelected
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCheckboxQuestion = (question) => (
    <View style={styles.questionContainer}>
      <View style={styles.questionHeader}>
        {form?.settings?.showQuestionNumbers && (
          <Text style={styles.questionNumber}>{question.order + 1}.</Text>
        )}
        <View style={styles.questionTitleContainer}>
          <Text style={styles.questionTitle}>
            {question.question}
            {question.required && <Text style={styles.required}> *</Text>}
          </Text>
          <Text style={styles.questionSubtitle}>Select all that apply</Text>
        </View>
      </View>

      {validationErrors[question.id] && (
        <Text style={styles.errorText}>{validationErrors[question.id]}</Text>
      )}

      <View style={styles.optionsContainer}>
        {question.options?.map((option, index) => {
          const isSelected = Array.isArray(responses[question.id]) && 
                           responses[question.id].includes(option);
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                isSelected && styles.optionButtonSelected
              ]}
              onPress={() => {
                const currentResponses = responses[question.id] || [];
                const newResponses = isSelected
                  ? currentResponses.filter(r => r !== option)
                  : [...currentResponses, option];
                updateResponse(question.id, newResponses);
              }}
              activeOpacity={0.8}
            >
              <View style={[
                styles.checkboxButton,
                isSelected && styles.checkboxButtonSelected
              ]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={[
                styles.optionText,
                isSelected && styles.optionTextSelected
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderYesNoQuestion = (question) => (
    <View style={styles.questionContainer}>
      <View style={styles.questionHeader}>
        {form?.settings?.showQuestionNumbers && (
          <Text style={styles.questionNumber}>{question.order + 1}.</Text>
        )}
        <View style={styles.questionTitleContainer}>
          <Text style={styles.questionTitle}>
            {question.question}
            {question.required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      </View>

      {validationErrors[question.id] && (
        <Text style={styles.errorText}>{validationErrors[question.id]}</Text>
      )}

      <View style={styles.yesNoContainer}>
        {['yes', 'no'].map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.yesNoButton,
              responses[question.id] === option && styles.yesNoButtonSelected,
              option === 'yes' && styles.yesButton,
              option === 'no' && styles.noButton
            ]}
            onPress={() => updateResponse(question.id, option)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.yesNoText,
              responses[question.id] === option && styles.yesNoTextSelected
            ]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderRatingQuestion = (question) => {
    const maxRating = question.maxRating || 5;
    const currentRating = responses[question.id] || 0;

    return (
      <View style={styles.questionContainer}>
        <View style={styles.questionHeader}>
          {form?.settings?.showQuestionNumbers && (
            <Text style={styles.questionNumber}>{question.order + 1}.</Text>
          )}
          <View style={styles.questionTitleContainer}>
            <Text style={styles.questionTitle}>
              {question.question}
              {question.required && <Text style={styles.required}> *</Text>}
            </Text>
          </View>
        </View>

        {validationErrors[question.id] && (
          <Text style={styles.errorText}>{validationErrors[question.id]}</Text>
        )}

        <View style={styles.ratingContainer}>
          <View style={styles.starsContainer}>
            {Array.from({ length: maxRating }, (_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => updateResponse(question.id, index + 1)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={index < currentRating ? "star" : "star-outline"}
                  size={32}
                  color={index < currentRating ? "#FFD700" : "#C7C7CC"}
                  style={styles.starIcon}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingText}>
            {currentRating > 0 ? `${currentRating} of ${maxRating} stars` : 'Tap to rate'}
          </Text>
        </View>
      </View>
    );
  };

  const renderQuestion = (question) => {
    switch (question.type) {
      case 'short_answer':
        return renderShortAnswerQuestion(question);
      case 'multiple_choice':
        return renderMultipleChoiceQuestion(question);
      case 'checkbox':
        return renderCheckboxQuestion(question);
      case 'yes_no':
        return renderYesNoQuestion(question);
      case 'rating':
        return renderRatingQuestion(question);
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Form Header */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>{form?.title}</Text>
          {form?.description && (
            <Text style={styles.formDescription}>{form.description}</Text>
          )}
          {isCheckIn && (
            <View style={styles.checkInBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.checkInBadgeText}>Check-in Form</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Questions */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.questionsContainer}>
            {form?.questions?.map((question, index) => (
              <View key={question.id || index}>
                {renderQuestion(question)}
              </View>
            ))}
          </View>

          {/* Submit Button (Mobile) */}
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!canSubmit() || submitting) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit() || submitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canSubmit() && !submitting ? ['#3797EF', '#1E3A8A'] : ['#C7C7CC', '#C7C7CC']}
                style={styles.submitGradient}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isCheckIn ? 'Complete Check-in' : form?.settings?.submitButtonText || 'Submit Form'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Header buttons
  headerButton: {
    fontSize: 16,
    color: '#3797EF',
    paddingHorizontal: 16,
  },
  headerSubmitButton: {
    paddingHorizontal: 16,
  },
  headerSubmitText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonTextDisabled: {
    color: '#C7C7CC',
  },

  // Form header
  formHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  formDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 24,
    marginBottom: 12,
  },
  checkInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  checkInBadgeText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },

  // Progress bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Questions
  questionsContainer: {
    padding: 20,
  },
  questionContainer: {
    marginBottom: 32,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3797EF',
    marginRight: 12,
    marginTop: 2,
    minWidth: 24,
  },
  questionTitleContainer: {
    flex: 1,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 26,
  },
  questionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  required: {
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
    marginLeft: 36,
  },

  // Text input
  textInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: 'transparent',
    marginLeft: 36,
    textAlignVertical: 'top',
  },
  textInputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 6,
    marginLeft: 36,
    textAlign: 'right',
  },

  // Options
  optionsContainer: {
    marginLeft: 36,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: '#E8F4FD',
    borderColor: '#3797EF',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#3797EF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3797EF',
  },
  checkboxButton: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxButtonSelected: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  optionTextSelected: {
    color: '#3797EF',
    fontWeight: '500',
  },

  // Yes/No buttons
  yesNoContainer: {
    flexDirection: 'row',
    marginLeft: 36,
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
  },
  yesNoButtonSelected: {
    borderColor: '#3797EF',
    backgroundColor: '#E8F4FD',
  },
  yesButton: {
    // Additional styling for yes button if needed
  },
  noButton: {
    // Additional styling for no button if needed
  },
  yesNoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  yesNoTextSelected: {
    color: '#3797EF',
  },

  // Rating
  ratingContainer: {
    marginLeft: 36,
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Submit button
  submitContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});