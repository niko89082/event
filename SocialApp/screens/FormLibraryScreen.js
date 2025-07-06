// screens/FormLibraryScreen.js - Select existing forms
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function FormLibraryScreen({ navigation, route }) {
  const { onFormSelect } = route.params || {};
  
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredForms, setFilteredForms] = useState([]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Select Form',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleCreateNew}>
          <Text style={styles.headerButton}>Create New</Text>
        </TouchableOpacity>
      ),
    });
    
    fetchForms();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = forms.filter(form =>
        form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredForms(filtered);
    } else {
      setFilteredForms(forms);
    }
  }, [searchQuery, forms]);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/forms/my-forms', {
        params: { limit: 100, isActive: true }
      });
      setForms(response.data.forms || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
      Alert.alert('Error', 'Failed to load your forms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigation.navigate('FormBuilderScreen', {
      onFormCreated: (newForm) => {
        navigation.goBack();
        onFormSelect?.(newForm);
      }
    });
  };

  const handleFormSelect = (form) => {
    navigation.goBack();
    onFormSelect?.(form);
  };

  const renderFormItem = ({ item: form }) => (
    <TouchableOpacity
      style={styles.formItem}
      onPress={() => handleFormSelect(form)}
      activeOpacity={0.8}
    >
      <View style={styles.formHeader}>
        <View style={styles.formIconContainer}>
          <Ionicons name="document-text" size={24} color="#3797EF" />
        </View>
        <View style={styles.formInfo}>
          <Text style={styles.formTitle}>{form.title}</Text>
          {form.description && (
            <Text style={styles.formDescription} numberOfLines={2}>
              {form.description}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </View>
      
      <View style={styles.formMeta}>
        <View style={styles.formStats}>
          <View style={styles.statItem}>
            <Ionicons name="help-circle-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {form.questions?.length || 0} questions
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="bar-chart-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              Used {form.usageCount || 0} times
            </Text>
          </View>
        </View>
        {form.category && (
          <View style={[styles.categoryBadge, getCategoryStyle(form.category)]}>
            <Text style={styles.categoryText}>{form.category.replace('_', ' ')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const getCategoryStyle = (category) => {
    const styles = {
      club_meeting: { backgroundColor: '#E3F2FD' },
      event_feedback: { backgroundColor: '#F3E5F5' },
      registration: { backgroundColor: '#E8F5E8' },
      survey: { backgroundColor: '#FFF3E0' },
      other: { backgroundColor: '#F5F5F5' }
    };
    return styles[category] || styles.other;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No Forms Yet</Text>
      <Text style={styles.emptyDescription}>
        Create your first form to collect attendee information
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.createButtonText}>Create Form</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading your forms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {forms.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search forms..."
              placeholderTextColor="#C7C7CC"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <FlatList
        data={filteredForms}
        renderItem={renderFormItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[
          styles.listContainer,
          filteredForms.length === 0 && styles.emptyListContainer
        ]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    fontSize: 17,
    color: '#3797EF',
    fontWeight: '600',
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  formItem: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  formInfo: {
    flex: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  formDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  formMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});