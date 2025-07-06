// components/EventFormToggle.js - Check-in form toggle with smart recommendations
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function EventFormToggle({
  category,
  requiresForm = false,
  selectedForm = null,
  onToggleChange,
  onFormSelect,
  style
}) {
  const [userForms, setUserForms] = useState([]);
  const [loading, setLoading] = useState(false);

  // Get recommendation based on event category
  const getRecommendation = () => {
    const clubCategories = ['Meeting', 'Club', 'Education', 'Business', 'Professional'];
    const partyCategories = ['Party', 'Social', 'Celebration', 'Entertainment', 'Music'];
    
    if (clubCategories.includes(category)) {
      return {
        type: 'recommended',
        text: '✅ Recommended for club meetings and organized events',
        color: '#34C759'
      };
    } else if (partyCategories.includes(category)) {
      return {
        type: 'not-recommended',
        text: '⚠️ Not recommended for parties - may slow down entry',
        color: '#FF9500'
      };
    } else {
      return {
        type: 'neutral',
        text: 'ℹ️ Forms help collect attendee information and feedback',
        color: '#3797EF'
      };
    }
  };

  const recommendation = getRecommendation();

  // Fetch user's forms when toggle is enabled
  useEffect(() => {
    if (requiresForm && userForms.length === 0) {
      fetchUserForms();
    }
  }, [requiresForm]);

  const fetchUserForms = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/forms/my-forms', {
        params: { limit: 20, isActive: true }
      });
      setUserForms(response.data.forms || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
      Alert.alert('Error', 'Failed to load your forms');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChange = (value) => {
    if (value && userForms.length === 0) {
      fetchUserForms();
    }
    onToggleChange(value);
  };

  const handleCreateNewForm = () => {
    onFormSelect({ action: 'create' });
  };

  const handleSelectExistingForm = () => {
    onFormSelect({ action: 'select', forms: userForms });
  };

  const handleFormSelected = (form) => {
    onFormSelect({ action: 'selected', form });
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.toggleHeader}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Require Check-in Form</Text>
          <Text style={styles.toggleDescription}>
            Collect information when attendees check in
          </Text>
        </View>
        <Switch
          value={requiresForm}
          onValueChange={handleToggleChange}
          trackColor={{ false: '#E1E1E1', true: '#34C759' }}
          thumbColor="#FFFFFF"
          style={styles.toggle}
        />
      </View>

      {/* Recommendation */}
      <View style={[styles.recommendation, { backgroundColor: `${recommendation.color}15` }]}>
        <Text style={[styles.recommendationText, { color: recommendation.color }]}>
          {recommendation.text}
        </Text>
      </View>

      {/* Form Selection (when enabled) */}
      {requiresForm && (
        <View style={styles.formSelection}>
          {selectedForm ? (
            <View style={styles.selectedForm}>
              <View style={styles.selectedFormHeader}>
                <Ionicons name="document-text" size={24} color="#34C759" />
                <View style={styles.selectedFormInfo}>
                  <Text style={styles.selectedFormTitle}>{selectedForm.title}</Text>
                  <Text style={styles.selectedFormQuestions}>
                    {selectedForm.questions?.length || 0} questions
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onFormSelect({ action: 'clear' })}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              {selectedForm.description && (
                <Text style={styles.selectedFormDescription}>
                  {selectedForm.description}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.formOptions}>
              <TouchableOpacity
                style={styles.formOption}
                onPress={handleCreateNewForm}
                activeOpacity={0.8}
              >
                <View style={styles.formOptionIcon}>
                  <Ionicons name="add-circle" size={28} color="#3797EF" />
                </View>
                <View style={styles.formOptionContent}>
                  <Text style={styles.formOptionTitle}>Create New Form</Text>
                  <Text style={styles.formOptionDescription}>
                    Build a custom form for this event
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </TouchableOpacity>

              {userForms.length > 0 && (
                <TouchableOpacity
                  style={styles.formOption}
                  onPress={handleSelectExistingForm}
                  activeOpacity={0.8}
                >
                  <View style={styles.formOptionIcon}>
                    <Ionicons name="library" size={28} color="#FF9500" />
                  </View>
                  <View style={styles.formOptionContent}>
                    <Text style={styles.formOptionTitle}>Use Existing Form</Text>
                    <Text style={styles.formOptionDescription}>
                      Choose from {userForms.length} saved form{userForms.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              )}

              {loading && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading your forms...</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  toggle: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  recommendation: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  recommendationText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  formSelection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
  },
  selectedForm: {
    // Styles for when a form is selected
  },
  selectedFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedFormInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  selectedFormQuestions: {
    fontSize: 14,
    color: '#8E8E93',
  },
  selectedFormDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginTop: 8,
  },
  clearButton: {
    padding: 4,
  },
  formOptions: {
    gap: 12,
  },
  formOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  formOptionIcon: {
    marginRight: 16,
  },
  formOptionContent: {
    flex: 1,
  },
  formOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  formOptionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});