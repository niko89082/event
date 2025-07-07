// screens/FormLibraryScreen.js - Phase 3: Form Selection & Management
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, TextInput, Alert,
  StatusBar, RefreshControl, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Forms' },
  { key: 'recent', label: 'Recently Used' },
  { key: 'popular', label: 'Most Popular' },
  { key: 'templates', label: 'Templates Only' }
];

const CATEGORY_COLORS = {
  general: '#8E8E93',
  club_meeting: '#3797EF',
  professional_event: '#34C759',
  social_gathering: '#FF9500',
  educational: '#5856D6',
  check_in: '#FF3B30',
  feedback: '#AF52DE',
  registration: '#007AFF'
};

export default function FormLibraryScreen({ navigation, route }) {
  const { onFormSelect } = route.params || {};
  
  const [forms, setForms] = useState([]);
  const [filteredForms, setFilteredForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    skip: 0,
    hasMore: false
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Choose Form',
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
  }, [selectedFilter]);

  useEffect(() => {
    filterForms();
  }, [searchQuery, forms]);

  const fetchForms = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      let endpoint = '/api/forms/my-forms';
      let params = { 
        limit: pagination.limit, 
        skip: isRefresh ? 0 : pagination.skip,
        isActive: true 
      };

      // Apply filter-specific parameters
      switch (selectedFilter) {
        case 'recent':
          params.sortBy = 'lastUsed';
          break;
        case 'popular':
          endpoint = '/api/forms/popular';
          params.limit = 10;
          break;
        case 'templates':
          params.isTemplate = true;
          break;
      }

      const response = await api.get(endpoint, { params });
      const newForms = response.data.forms || [];
      
      if (isRefresh) {
        setForms(newForms);
      } else {
        setForms(prev => pagination.skip > 0 ? [...prev, ...newForms] : newForms);
      }
      
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
      Alert.alert('Error', 'Failed to load your forms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterForms = () => {
    if (searchQuery.trim()) {
      const filtered = forms.filter(form =>
        form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredForms(filtered);
    } else {
      setFilteredForms(forms);
    }
  };

  const handleRefresh = () => {
    setPagination(prev => ({ ...prev, skip: 0 }));
    fetchForms(true);
  };

  const handleLoadMore = () => {
    if (pagination.hasMore && !loading) {
      setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }));
      fetchForms();
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

  const handleEditForm = (form) => {
    navigation.navigate('FormBuilderScreen', {
      formId: form._id,
      onFormCreated: (updatedForm) => {
        // Update the form in local state
        setForms(prev => prev.map(f => f._id === updatedForm._id ? updatedForm : f));
      }
    });
  };

  const handleDeleteForm = (form) => {
    Alert.alert(
      'Delete Form',
      `Are you sure you want to delete "${form.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteForm(form._id)
        }
      ]
    );
  };

  const deleteForm = async (formId) => {
    try {
      await api.delete(`/api/forms/${formId}`);
      setForms(prev => prev.filter(f => f._id !== formId));
      Alert.alert('Success', 'Form deleted successfully');
    } catch (error) {
      console.error('Error deleting form:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.message || 'Failed to delete form'
      );
    }
  };

  const duplicateForm = async (form) => {
    try {
      const duplicateData = {
        title: `${form.title} (Copy)`,
        description: form.description,
        category: form.category,
        questions: form.questions,
        isTemplate: form.isTemplate,
        settings: form.settings
      };

      const response = await api.post('/api/forms/create', duplicateData);
      setForms(prev => [response.data.form, ...prev]);
      Alert.alert('Success', 'Form duplicated successfully');
    } catch (error) {
      console.error('Error duplicating form:', error);
      Alert.alert('Error', 'Failed to duplicate form');
    }
  };

  const getCategoryStyle = (category) => {
    const color = CATEGORY_COLORS[category] || '#8E8E93';
    return {
      backgroundColor: `${color}15`,
      borderColor: `${color}40`,
    };
  };

  const getCategoryTextStyle = (category) => {
    const color = CATEGORY_COLORS[category] || '#8E8E93';
    return { color };
  };

  const formatLastUsed = (date) => {
    if (!date) return 'Never used';
    
    const now = new Date();
    const lastUsed = new Date(date);
    const diffInHours = (now - lastUsed) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return 'Used today';
    } else if (diffInHours < 48) {
      return 'Used yesterday';
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24);
      return `Used ${days} days ago`;
    } else {
      return lastUsed.toLocaleDateString();
    }
  };

  const renderFormItem = ({ item: form }) => (
    <TouchableOpacity
      style={styles.formItem}
      onPress={() => handleFormSelect(form)}
      activeOpacity={0.8}
    >
      <View style={styles.formHeader}>
        <View style={styles.formIconContainer}>
          <Ionicons 
            name={form.isTemplate ? "library" : "document-text"} 
            size={24} 
            color="#3797EF" 
          />
        </View>
        <View style={styles.formInfo}>
          <View style={styles.formTitleRow}>
            <Text style={styles.formTitle} numberOfLines={1}>
              {form.title}
            </Text>
            {form.isTemplate && (
              <View style={styles.templateBadge}>
                <Text style={styles.templateBadgeText}>Template</Text>
              </View>
            )}
          </View>
          {form.description && (
            <Text style={styles.formDescription} numberOfLines={2}>
              {form.description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowFormActions(form)}
          style={styles.formMenuButton}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
        </TouchableOpacity>
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
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {formatLastUsed(form.lastUsed)}
            </Text>
          </View>
        </View>
        {form.category && (
          <View style={[styles.categoryBadge, getCategoryStyle(form.category)]}>
            <Text style={[styles.categoryText, getCategoryTextStyle(form.category)]}>
              {form.category.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) return null;
    
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyStateTitle}>No forms found</Text>
          <Text style={styles.emptyStateDesc}>
            Try adjusting your search or filter criteria
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyStateTitle}>No forms yet</Text>
        <Text style={styles.emptyStateDesc}>
          Create your first form to collect information from event attendees
        </Text>
        <TouchableOpacity
          style={styles.createFirstFormButton}
          onPress={handleCreateNew}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.createFirstFormButtonText}>Create Your First Form</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search forms..."
            placeholderTextColor="#C7C7CC"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                selectedFilter === filter.key && styles.filterTabActive
              ]}
              onPress={() => setSelectedFilter(filter.key)}
            >
              <Text style={[
                styles.filterTabText,
                selectedFilter === filter.key && styles.filterTabTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Summary */}
      {!loading && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''}
            {searchQuery.trim() && ` matching "${searchQuery}"`}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {loading && forms.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading your forms...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredForms}
          keyExtractor={(item) => item._id}
          renderItem={renderFormItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3797EF"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() => (
            pagination.hasMore && !loading ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#3797EF" />
                <Text style={styles.loadMoreText}>Loading more forms...</Text>
              </View>
            ) : null
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Form Actions Modal */}
      <FormActionsModal
        visible={!!showFormActions}
        form={showFormActions}
        onClose={() => setShowFormActions(null)}
        onEdit={() => {
          handleEditForm(showFormActions);
          setShowFormActions(null);
        }}
        onDuplicate={() => {
          duplicateForm(showFormActions);
          setShowFormActions(null);
        }}
        onDelete={() => {
          handleDeleteForm(showFormActions);
          setShowFormActions(null);
        }}
      />
    </SafeAreaView>
  );
}

// Form Actions Modal Component
const FormActionsModal = ({ visible, form, onClose, onEdit, onDuplicate, onDelete }) => {
  if (!form) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.actionsModal}>
          <View style={styles.actionsHeader}>
            <Text style={styles.actionsTitle} numberOfLines={1}>
              {form.title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionsList}>
            <TouchableOpacity style={styles.actionItem} onPress={onEdit}>
              <Ionicons name="create-outline" size={24} color="#3797EF" />
              <Text style={styles.actionText}>Edit Form</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionItem} onPress={onDuplicate}>
              <Ionicons name="copy-outline" size={24} color="#34C759" />
              <Text style={styles.actionText}>Duplicate Form</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionItem, styles.deleteAction]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.actionText, styles.deleteText]}>Delete Form</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Header section
  header: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
  },
  clearSearchButton: {
    padding: 4,
  },

  // Filter section
  filterContainer: {
    paddingTop: 16,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
  },
  filterTab: {
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#3797EF',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Results header
  resultsHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // List content
  listContent: {
    flexGrow: 1,
  },
  formItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  formIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  formInfo: {
    flex: 1,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  templateBadge: {
    backgroundColor: '#E8F5FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  templateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3797EF',
  },
  formDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  formMenuButton: {
    padding: 8,
    marginTop: -4,
  },

  // Form metadata
  formMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#8E8E93',
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Empty states
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  createFirstFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  createFirstFormButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Load more
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },

  // Actions modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionsModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 16,
  },
  actionsList: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#000000',
  },
  deleteAction: {
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    marginTop: 8,
  },
  deleteText: {
    color: '#FF3B30',
  },
});