// screens/FormSubmissionScreen.js - Phase 4: Dynamic Form Rendering for Check-in
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';

export default function FormSubmissionScreen({ navigation, route }) {
  const { formId, eventId, userId, onSubmissionComplete, isCheckIn = false } = route.params || {};

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
          style={[styles.headerButton, (!canSubmit() || submitting) && styles.headerButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.headerButtonText, (!canSubmit() || submitting) && styles.headerButtonTextDisabled]}>
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
        initialResponses[question.id] = question.type === 'checkbox' ? [] : '';
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
    if (Object.values(responses).some(response => 
      Array.isArray(response) ? response.length > 0 : response.trim()
    )) {
      Alert.alert(
        'Discard Form?',
        'You have unsaved responses. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const validateResponses = () => {
    const errors = {};
    
    form.questions?.forEach(question => {
      const response = responses[question.id];
      
      if (question.required) {
        if (question.type === 'checkbox') {
          if (!Array.isArray(response) || response.length === 0) {
            errors[question.id] = 'This field is required';
          }
        } else if (!response || !response.toString().trim()) {
          errors[question.id] = 'This field is required';
        }
      }
      
      // Type-specific validation
      if (response && response.toString().trim()) {
        switch (question.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(response)) {
              errors[question.id] = 'Please enter a valid email address';
            }
            break;
          case 'phone':
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(response.replace(/\D/g, ''))) {
              errors[question.id] = 'Please enter a valid phone number';
            }
            break;
          case 'number':
            const num = parseFloat(response);
            if (isNaN(num)) {
              errors[question.id] = 'Please enter a valid number';
            } else {
              if (question.min !== null && num < question.min) {
                errors[question.id] = `Value must be at least ${question.min}`;
              }
              if (question.max !== null && num > question.max) {
                errors[question.id] = `Value must be at most ${question.max}`;
              }
            }
            break;
          case 'short_answer':
            if (question.maxLength && response.length > question.maxLength) {
              errors[question.id] = `Maximum ${question.maxLength} characters allowed`;
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
              text: 'OK',
              onPress: () => {
                onSubmissionComplete?.(response.data);
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Thank You!',
          'Your form has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                onSubmissionComplete?.(response.data);
                navigation.goBack();
              }
            }
          ]
        );
      }

    } catch (error) {
      console.error('Form submission error:', error);
      Alert.alert(
        'Submission Failed',
        error.response?.data?.message || 'Failed to submit form. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateResponse = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const renderQuestion = (question, index) => {
    const response = responses[question.id];
    const hasError = validationErrors[question.id];
    const showQuestionNumbers = form.settings?.showQuestionNumbers !== false;

    return (
      <View key={question.id} style={styles.questionContainer}>
        <View style={styles.questionHeader}>
          {showQuestionNumbers && (
            <Text style={styles.questionNumber}>{index + 1}</Text>
          )}
          <View style={styles.questionTitleContainer}>
            <Text style={styles.questionTitle}>
              {question.question}
              {question.required && <Text style={styles.required}> *</Text>}
            </Text>
          </View>
        </View>

        {hasError && (
          <Text style={styles.errorText}>{hasError}</Text>
        )}

        {renderQuestionInput(question)}
      </View>
    );
  };

  const renderQuestionInput = (question) => {
    const response = responses[question.id];
    const hasError = validationErrors[question.id];

    switch (question.type) {
      case 'short_answer':
        return (
          <TextInput
            style={[styles.textInput, hasError && styles.inputError]}
            value={response}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder || 'Enter your answer...'}
            placeholderTextColor="#C7C7CC"
            maxLength={question.maxLength || 500}
            multiline={false}
          />
        );

      case 'email':
        return (
          <TextInput
            style={[styles.textInput, hasError && styles.inputError]}
            value={response}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder || 'Enter your email...'}
            placeholderTextColor="#C7C7CC"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        );

      case 'phone':
        return (
          <TextInput
            style={[styles.textInput, hasError && styles.inputError]}
            value={response}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder || 'Enter your phone number...'}
            placeholderTextColor="#C7C7CC"
            keyboardType="phone-pad"
          />
        );

      case 'number':
        return (
          <TextInput
            style={[styles.textInput, hasError && styles.inputError]}
            value={response}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder || 'Enter a number...'}
            placeholderTextColor="#C7C7CC"
            keyboardType={question.allowDecimals ? 'decimal-pad' : 'numeric'}
          />
        );

      case 'multiple_choice':
        return (
          <View style={styles.optionsContainer}>
            {question.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionRow}
                onPress={() => updateResponse(question.id, option)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={response === option ? "radio-button-on" : "radio-button-off"}
                  size={24}
                  color={response === option ? "#3797EF" : "#C7C7CC"}
                />
                <Text style={[
                  styles.optionText,
                  response === option && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'checkbox':
        return (
          <View style={styles.optionsContainer}>
            {question.options?.map((option, index) => {
              const isSelected = Array.isArray(response) && response.includes(option);
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.optionRow}
                  onPress={() => {
                    const currentResponses = Array.isArray(response) ? response : [];
                    if (isSelected) {
                      updateResponse(question.id, currentResponses.filter(r => r !== option));
                    } else {
                      updateResponse(question.id, [...currentResponses, option]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={24}
                    color={isSelected ? "#3797EF" : "#C7C7CC"}
                  />
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
        );

      case 'yes_no':
        return (
          <View style={styles.optionsContainer}>
            {['Yes', 'No'].map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => updateResponse(question.id, option)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={response === option ? "radio-button-on" : "radio-button-off"}
                  size={24}
                  color={response === option ? "#3797EF" : "#C7C7CC"}
                />
                <Text style={[
                  styles.optionText,
                  response === option && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'rating':
        const scale = question.scale || 5;
        return (
          <View style={styles.ratingContainer}>
            <View style={styles.ratingScale}>
              {Array.from({ length: scale }, (_, i) => i + 1).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={styles.ratingButton}
                  onPress={() => updateResponse(question.id, value.toString())}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={parseInt(response) >= value ? "star" : "star-outline"}
                    size={32}
                    color={parseInt(response) >= value ? "#FFD700" : "#C7C7CC"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.ratingLabels}>
              {question.minLabel && (
                <Text style={styles.ratingLabel}>{question.minLabel}</Text>
              )}
              <View style={styles.ratingLabelSpacer} />
              {question.maxLabel && (
                <Text style={styles.ratingLabel}>{question.maxLabel}</Text>
              )}
            </View>
          </View>
        );

      default:
        return (
          <Text style={styles.unsupportedType}>
            Unsupported question type: {question.type}
          </Text>
        );
    }
  };

  const renderProgressBar = () => {
    if (!showProgressBar || !form?.questions?.length) return null;

    const answeredQuestions = form.questions.filter(question => {
      const response = responses[question.id];
      if (question.type === 'checkbox') {
        return Array.isArray(response) && response.length > 0;
      }
      return response && response.toString().trim();
    }).length;

    const progress = answeredQuestions / form.questions.length;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {answeredQuestions} of {form.questions.length} completed
        </Text>
      </View>
    );
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

  if (!form) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="document-outline" size={48} color="#C7C7CC" />
          <Text style={styles.errorTitle}>Form Not Found</Text>
          <Text style={styles.errorDesc}>The requested form could not be loaded.</Text>
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
        {/* Progress Bar */}
        {renderProgressBar()}

        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Form Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{form.title}</Text>
            {form.description && (
              <Text style={styles.formDescription}>{form.description}</Text>
            )}
            {isCheckIn && (
              <View style={styles.checkInBadge}>
                <Ionicons name="log-in-outline" size={16} color="#34C759" />
                <Text style={styles.checkInBadgeText}>Check-in Form</Text>
              </View>
            )}
          </View>

          {/* Questions */}
          <View style={styles.questionsContainer}>
            {form.questions?.map((question, index) => renderQuestion(question, index))}
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, (!canSubmit() || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit() || submitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canSubmit() && !submitting ? ['#34C759', '#34C759'] : ['#E5E5EA', '#E5E5EA']}
                style={styles.submitGradient}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons 
                      name={isCheckIn ? "log-in" : "checkmark"} 
                      size={20} 
                      color={canSubmit() ? "#FFFFFF" : "#8E8E93"} 
                    />
                    <Text style={[
                      styles.submitButtonText,
                      (!canSubmit() || submitting) && styles.submitButtonTextDisabled
                    ]}>
                      {isCheckIn ? 'Complete Check-in' : (form.settings?.submitButtonText || 'Submit')}
                    </Text>
                  </>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  headerButton: {
    fontSize: 16,
    color: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  headerButtonTextDisabled: {
    color: '#C7C7CC',
  },

  // Progress bar
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
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
  required: {
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
    marginLeft: 36,
  },

  // Inputs
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
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },

  // Options
  optionsContainer: {
    marginLeft: 36,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 8,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#3797EF',
  },

  // Rating
  ratingContainer: {
    marginLeft: 36,
    alignItems: 'center',
  },
  ratingScale: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ratingButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  ratingLabelSpacer: {
    flex: 1,
  },

  // Unsupported
  unsupportedType: {
    fontSize: 14,
    color: '#FF3B30',
    fontStyle: 'italic',
    marginLeft: 36,
  },

  // Submit
  submitContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
});