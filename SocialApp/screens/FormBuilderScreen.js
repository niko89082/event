// screens/FormBuilderScreen.js - Phase 3: Complete Form Builder
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, SafeAreaView, StatusBar, Modal, FlatList, Switch,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList from 'react-native-draggable-flatlist';

import api from '../services/api';

const QUESTION_TYPES = [
  {
    type: 'short_answer',
    label: 'Short Answer',
    icon: 'text-outline',
    description: 'Single line text input',
    color: '#3797EF'
  },
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    icon: 'radio-button-on-outline',
    description: 'Select one option',
    color: '#34C759'
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    icon: 'checkbox-outline',
    description: 'Select multiple options',
    color: '#FF9500'
  },
  {
    type: 'yes_no',
    label: 'Yes/No',
    icon: 'checkmark-circle-outline',
    description: 'Simple yes or no question',
    color: '#5856D6'
  },
  {
    type: 'rating',
    label: 'Rating Scale',
    icon: 'star-outline',
    description: '1-5 star rating',
    color: '#FF3B30'
  }
];

const FORM_CATEGORIES = [
  'general',
  'club_meeting',
  'professional_event',
  'social_gathering',
  'educational',
  'check_in',
  'feedback',
  'registration'
];

const FORM_TEMPLATES = {
  club_meeting: [
    {
      type: 'short_answer',
      question: 'What department are you in?',
      required: true,
      placeholder: 'e.g., Computer Science'
    },
    {
      type: 'multiple_choice',
      question: 'How did you hear about this meeting?',
      required: false,
      options: ['Friend', 'Social Media', 'Email', 'Club Website', 'Other']
    },
    {
      type: 'yes_no',
      question: 'Is this your first time attending?',
      required: false
    }
  ],
  professional_event: [
    {
      type: 'short_answer',
      question: 'Company/Organization',
      required: true,
      placeholder: 'Your company name'
    },
    {
      type: 'short_answer',
      question: 'Job Title',
      required: false,
      placeholder: 'Your current role'
    },
    {
      type: 'multiple_choice',
      question: 'Industry',
      required: false,
      options: ['Technology', 'Finance', 'Healthcare', 'Education', 'Marketing', 'Other']
    }
  ],
  check_in: [
    {
      type: 'short_answer',
      question: 'Phone number (for emergency contact)',
      required: true,
      placeholder: '(555) 123-4567'
    },
    {
      type: 'yes_no',
      question: 'Have you been here before?',
      required: false
    }
  ]
};

export default function FormBuilderScreen({ navigation, route }) {
  const { formId, onFormCreated } = route.params || {};
  const isEditing = !!formId;

  // Form metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [isTemplate, setIsTemplate] = useState(true);

  // Questions management
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Form settings
  const [settings, setSettings] = useState({
    allowMultipleSubmissions: false,
    showProgressBar: true,
    showQuestionNumbers: true,
    submitButtonText: 'Submit'
  });

  // UI state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const scrollViewRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: isEditing ? 'Edit Form' : 'New Form',
      headerLeft: () => (
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave() || saving}
          style={[styles.saveButton, (!canSave() || saving) && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3797EF" />
          ) : (
            <Text style={[styles.saveButtonText, (!canSave() || saving) && styles.saveButtonTextDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      ),
    });

    if (isEditing) {
      loadForm();
    }
  }, [title, questions, saving]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/forms/${formId}`);
      const form = response.data.form;
      
      setTitle(form.title);
      setDescription(form.description || '');
      setCategory(form.category || 'general');
      setIsTemplate(form.isTemplate !== false);
      setQuestions(form.questions || []);
      setSettings({ ...settings, ...form.settings });
    } catch (error) {
      console.error('Error loading form:', error);
      Alert.alert('Error', 'Failed to load form');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const canSave = () => {
    return title.trim() && questions.length > 0;
  };

  const handleCancel = () => {
    if (title.trim() || questions.length > 0) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!canSave() || saving) return;

    try {
      setSaving(true);

      const formData = {
        title: title.trim(),
        description: description.trim(),
        category,
        isTemplate,
        questions: questions.map((q, index) => ({ ...q, order: index })),
        settings
      };

      let response;
      if (isEditing) {
        response = await api.put(`/api/forms/${formId}`, formData);
      } else {
        response = await api.post('/api/forms/create', formData);
      }

      Alert.alert(
        'Success!',
        `Form ${isEditing ? 'updated' : 'created'} successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
              onFormCreated?.(response.data.form);
            }
          }
        ]
      );

    } catch (error) {
      console.error('Save form error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} form`
      );
    } finally {
      setSaving(false);
    }
  };

  const generateQuestionId = () => {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addQuestion = (type) => {
    const newQuestion = {
      id: generateQuestionId(),
      type,
      question: '',
      required: false,
      placeholder: '',
      options: ['multiple_choice', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : undefined
    };

    setEditingQuestion(newQuestion);
    setShowQuestionModal(true);
    setShowTypeSelector(false);
  };

  const editQuestion = (question) => {
    setEditingQuestion({ ...question });
    setShowQuestionModal(true);
  };

  const saveQuestion = () => {
    if (!editingQuestion.question.trim()) {
      Alert.alert('Error', 'Question text is required');
      return;
    }

    if (['multiple_choice', 'checkbox'].includes(editingQuestion.type)) {
      const validOptions = editingQuestion.options?.filter(opt => opt.trim()) || [];
      if (validOptions.length < 2) {
        Alert.alert('Error', 'At least 2 options are required for multiple choice/checkbox questions');
        return;
      }
      editingQuestion.options = validOptions;
    }

    const existingIndex = questions.findIndex(q => q.id === editingQuestion.id);
    if (existingIndex >= 0) {
      const updatedQuestions = [...questions];
      updatedQuestions[existingIndex] = editingQuestion;
      setQuestions(updatedQuestions);
    } else {
      setQuestions(prev => [...prev, editingQuestion]);
    }

    setShowQuestionModal(false);
    setEditingQuestion(null);
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
            setQuestions(prev => prev.filter(q => q.id !== questionId));
          }
        }
      ]
    );
  };

  const duplicateQuestion = (question) => {
    const duplicated = {
      ...question,
      id: generateQuestionId(),
      question: `${question.question} (Copy)`
    };
    const originalIndex = questions.findIndex(q => q.id === question.id);
    const newQuestions = [...questions];
    newQuestions.splice(originalIndex + 1, 0, duplicated);
    setQuestions(newQuestions);
  };

  const reorderQuestions = ({ data }) => {
    setQuestions(data);
  };

  const applyTemplate = (templateKey) => {
    const template = FORM_TEMPLATES[templateKey];
    if (template) {
      const templateQuestions = template.map(q => ({
        ...q,
        id: generateQuestionId()
      }));
      setQuestions(templateQuestions);
      setShowTemplateModal(false);
      Alert.alert('Template Applied', 'Template questions have been added to your form.');
    }
  };

  const renderQuestionItem = ({ item: question, drag, isActive }) => (
    <TouchableOpacity
      style={[styles.questionItem, isActive && styles.questionItemActive]}
      onPress={() => editQuestion(question)}
      onLongPress={drag}
      activeOpacity={0.8}
    >
      <View style={styles.questionHeader}>
        <View style={styles.questionIconContainer}>
          <Ionicons
            name={QUESTION_TYPES.find(t => t.type === question.type)?.icon || 'help-outline'}
            size={20}
            color={QUESTION_TYPES.find(t => t.type === question.type)?.color || '#8E8E93'}
          />
        </View>
        <View style={styles.questionContent}>
          <Text style={styles.questionText}>
            {question.question || 'Untitled Question'}
          </Text>
          <Text style={styles.questionType}>
            {QUESTION_TYPES.find(t => t.type === question.type)?.label || question.type}
            {question.required && <Text style={styles.requiredIndicator}> • Required</Text>}
          </Text>
        </View>
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
      </View>
      
      {/* Question Preview */}
      {question.type === 'multiple_choice' && question.options && (
        <View style={styles.questionPreview}>
          {question.options.slice(0, 3).map((option, index) => (
            <View key={index} style={styles.previewOption}>
              <Ionicons name="radio-button-off-outline" size={16} color="#C7C7CC" />
              <Text style={styles.previewOptionText}>{option}</Text>
            </View>
          ))}
          {question.options.length > 3 && (
            <Text style={styles.moreOptionsText}>+{question.options.length - 3} more</Text>
          )}
        </View>
      )}
      
      {question.type === 'checkbox' && question.options && (
        <View style={styles.questionPreview}>
          {question.options.slice(0, 3).map((option, index) => (
            <View key={index} style={styles.previewOption}>
              <Ionicons name="square-outline" size={16} color="#C7C7CC" />
              <Text style={styles.previewOptionText}>{option}</Text>
            </View>
          ))}
          {question.options.length > 3 && (
            <Text style={styles.moreOptionsText}>+{question.options.length - 3} more</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

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
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Form Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Form Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Form Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="What is this form for?"
                placeholderTextColor="#C7C7CC"
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Briefly describe what information you're collecting..."
                placeholderTextColor="#C7C7CC"
                multiline
                numberOfLines={3}
                maxLength={300}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={styles.selectButtonText}>
                  {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Save as Template</Text>
              <Switch
                value={isTemplate}
                onValueChange={setIsTemplate}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Questions Section */}
          <View style={styles.section}>
            <View style={styles.questionsHeader}>
              <Text style={styles.sectionTitle}>Questions ({questions.length})</Text>
              <TouchableOpacity
                style={styles.templateButton}
                onPress={() => setShowTemplateModal(true)}
              >
                <Ionicons name="library-outline" size={16} color="#3797EF" />
                <Text style={styles.templateButtonText}>Templates</Text>
              </TouchableOpacity>
            </View>

            {questions.length === 0 ? (
              <View style={styles.emptyQuestions}>
                <Ionicons name="help-circle-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyQuestionsTitle}>No Questions Yet</Text>
                <Text style={styles.emptyQuestionsDesc}>
                  Add questions to collect information from your attendees
                </Text>
              </View>
            ) : (
              <DraggableFlatList
                data={questions}
                keyExtractor={(item) => item.id}
                renderItem={renderQuestionItem}
                onDragEnd={reorderQuestions}
                style={styles.questionsList}
                scrollEnabled={false}
              />
            )}

            {/* Add Question Button */}
            <TouchableOpacity
              style={styles.addQuestionButton}
              onPress={() => setShowTypeSelector(true)}
            >
              <Ionicons name="add" size={24} color="#3797EF" />
              <Text style={styles.addQuestionButtonText}>Add Question</Text>
            </TouchableOpacity>
          </View>

          {/* Form Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Form Settings</Text>
            
            <View style={styles.settingsContainer}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Allow Multiple Submissions</Text>
                  <Text style={styles.settingDesc}>Users can submit this form multiple times</Text>
                </View>
                <Switch
                  value={settings.allowMultipleSubmissions}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, allowMultipleSubmissions: value }))}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Progress Bar</Text>
                  <Text style={styles.settingDesc}>Display progress while filling out the form</Text>
                </View>
                <Switch
                  value={settings.showProgressBar}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, showProgressBar: value }))}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Number Questions</Text>
                  <Text style={styles.settingDesc}>Show question numbers (1, 2, 3...)</Text>
                </View>
                <Switch
                  value={settings.showQuestionNumbers}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, showQuestionNumbers: value }))}
                  trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Submit Button Text</Text>
                <TextInput
                  style={styles.input}
                  value={settings.submitButtonText}
                  onChangeText={(text) => setSettings(prev => ({ ...prev, submitButtonText: text }))}
                  placeholder="Submit"
                  placeholderTextColor="#C7C7CC"
                  maxLength={20}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Question Type Selector Modal */}
      <Modal
        visible={showTypeSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTypeSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Question</Text>
              <TouchableOpacity onPress={() => setShowTypeSelector(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={QUESTION_TYPES}
              keyExtractor={(item) => item.type}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.questionTypeItem}
                  onPress={() => addQuestion(item.type)}
                >
                  <View style={[styles.questionTypeIcon, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon} size={24} color={item.color} />
                  </View>
                  <View style={styles.questionTypeInfo}>
                    <Text style={styles.questionTypeLabel}>{item.label}</Text>
                    <Text style={styles.questionTypeDesc}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Question Editor Modal */}
      {editingQuestion && (
        <QuestionEditorModal
          visible={showQuestionModal}
          question={editingQuestion}
          onSave={saveQuestion}
          onCancel={() => {
            setShowQuestionModal(false);
            setEditingQuestion(null);
          }}
          onChange={setEditingQuestion}
        />
      )}

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={FORM_CATEGORIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    setCategory(item);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.categoryText,
                    category === item && styles.categoryTextSelected
                  ]}>
                    {item.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                  {category === item && (
                    <Ionicons name="checkmark" size={20} color="#3797EF" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Template Modal */}
      <Modal
        visible={showTemplateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Question Templates</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={Object.keys(FORM_TEMPLATES)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.templateItem}
                  onPress={() => applyTemplate(item)}
                >
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateLabel}>
                      {item.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={styles.templateDesc}>
                      {FORM_TEMPLATES[item].length} pre-built questions
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Question Editor Modal Component
const QuestionEditorModal = ({ visible, question, onSave, onCancel, onChange }) => {
  const [localQuestion, setLocalQuestion] = useState(question);

  useEffect(() => {
    setLocalQuestion(question);
  }, [question]);

  const updateQuestion = (updates) => {
    const updated = { ...localQuestion, ...updates };
    setLocalQuestion(updated);
    onChange(updated);
  };

  const addOption = () => {
    const options = localQuestion.options || [];
    updateQuestion({ options: [...options, `Option ${options.length + 1}`] });
  };

  const updateOption = (index, value) => {
    const options = [...(localQuestion.options || [])];
    options[index] = value;
    updateQuestion({ options });
  };

  const removeOption = (index) => {
    const options = [...(localQuestion.options || [])];
    if (options.length > 2) {
      options.splice(index, 1);
      updateQuestion({ options });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.questionModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Question</Text>
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity onPress={onCancel} style={styles.modalHeaderButton}>
                <Text style={styles.modalHeaderButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSave} style={styles.modalHeaderButton}>
                <Text style={[styles.modalHeaderButtonText, styles.saveText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.questionEditContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Question Text *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={localQuestion.question}
                onChangeText={(text) => updateQuestion({ question: text })}
                placeholder="Enter your question..."
                placeholderTextColor="#C7C7CC"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            {localQuestion.type === 'short_answer' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Placeholder Text</Text>
                <TextInput
                  style={styles.input}
                  value={localQuestion.placeholder || ''}
                  onChangeText={(text) => updateQuestion({ placeholder: text })}
                  placeholder="e.g., Enter your name..."
                  placeholderTextColor="#C7C7CC"
                  maxLength={100}
                />
              </View>
            )}

            {['multiple_choice', 'checkbox'].includes(localQuestion.type) && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Options</Text>
                {(localQuestion.options || []).map((option, index) => (
                  <View key={index} style={styles.optionRow}>
                    <TextInput
                      style={styles.optionInput}
                      value={option}
                      onChangeText={(text) => updateOption(index, text)}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor="#C7C7CC"
                      maxLength={100}
                    />
                    {(localQuestion.options?.length || 0) > 2 && (
                      <TouchableOpacity
                        onPress={() => removeOption(index)}
                        style={styles.removeOptionButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addOptionButton}
                  onPress={addOption}
                >
                  <Ionicons name="add" size={16} color="#3797EF" />
                  <Text style={styles.addOptionButtonText}>Add Option</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Required Question</Text>
              <Switch
                value={localQuestion.required}
                onValueChange={(value) => updateQuestion({ required: value })}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerButton: {
    fontSize: 16,
    color: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  saveButtonTextDisabled: {
    color: '#C7C7CC',
  },

  // Form sections
  section: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  settingDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  settingsContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
  },

  // Questions section
  questionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  templateButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  emptyQuestions: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyQuestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptyQuestionsDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  questionsList: {
    marginBottom: 16,
  },
  questionItem: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  questionItemActive: {
    backgroundColor: '#E8F5FF',
    borderWidth: 1,
    borderColor: '#3797EF',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  questionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questionContent: {
    flex: 1,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  questionType: {
    fontSize: 14,
    color: '#8E8E93',
  },
  requiredIndicator: {
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
  questionPreview: {
    marginTop: 12,
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
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#B3D9FF',
    borderStyle: 'dashed',
  },
  addQuestionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  questionModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
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
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  modalHeaderButtonText: {
    fontSize: 16,
    color: '#3797EF',
  },
  saveText: {
    fontWeight: '600',
  },

  // Question type selector
  questionTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  questionTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  questionTypeInfo: {
    flex: 1,
  },
  questionTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  questionTypeDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Question editor
  questionEditContent: {
    flex: 1,
    padding: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000000',
  },
  removeOptionButton: {
    marginLeft: 8,
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  addOptionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },

  // Category modal
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  categoryText: {
    fontSize: 16,
    color: '#000000',
  },
  categoryTextSelected: {
    color: '#3797EF',
    fontWeight: '600',
  },

  // Template modal
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  templateInfo: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  templateDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
});