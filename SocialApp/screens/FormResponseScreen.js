// screens/FormResponsesScreen.js - Phase 5: Complete Form Analytics & Response Management
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
  TextInput,
  Share,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FormResponsesScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId, formId } = route.params;

  // State
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [form, setForm] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);

  // View mode
  const [viewMode, setViewMode] = useState('list'); // 'list', 'analytics'

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Form Responses',
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setViewMode(viewMode === 'list' ? 'analytics' : 'list')}
          >
            <Ionicons 
              name={viewMode === 'list' ? 'analytics' : 'list'} 
              size={24} 
              color="#3797EF" 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleExportResponses}
          >
            <Ionicons name="download" size={24} color="#3797EF" />
          </TouchableOpacity>
        </View>
      ),
    });

    fetchFormResponses();
    fetchFormAnalytics();
  }, []);

  useEffect(() => {
    // Filter submissions based on search
    const filtered = submissions.filter(submission => 
      submission.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.responses?.some(response => 
        response.answer?.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    setFilteredSubmissions(filtered);
  }, [submissions, searchQuery]);

  const fetchFormResponses = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/forms/${formId}/submissions`, {
        params: { eventId, includeUser: true }
      });
      
      setSubmissions(response.data.submissions || []);
      setForm(response.data.form);
    } catch (error) {
      console.error('Error fetching form responses:', error);
      Alert.alert('Error', 'Failed to load form responses');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormAnalytics = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/form-responses-summary`);
      setAnalytics(response.data.summary);
    } catch (error) {
      console.error('Error fetching form analytics:', error);
    }
  };

  const handleExportResponses = async () => {
    try {
      const response = await api.post(`/api/forms/${formId}/export`, {
        eventId,
        format: 'csv'
      });

      await Share.share({
        title: 'Form Responses Export',
        message: 'Form responses have been exported',
        url: `data:text/csv;base64,${btoa(response.data.csvContent)}`
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export responses');
    }
  };

  const handleViewSubmission = (submission) => {
    setSelectedSubmission(submission);
    setShowSubmissionModal(true);
  };

  const renderSubmissionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.submissionItem}
      onPress={() => handleViewSubmission(item)}
      activeOpacity={0.8}
    >
      <View style={styles.submissionHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.user?.username || 'Anonymous'}</Text>
          <Text style={styles.submissionDate}>
            {new Date(item.submittedAt).toLocaleDateString()} at{' '}
            {new Date(item.submittedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
        <View style={styles.submissionStats}>
          <View style={styles.statBadge}>
            <Text style={styles.statText}>{item.responses?.length || 0} answers</Text>
          </View>
          {item.completionTime && (
            <View style={styles.statBadge}>
              <Text style={styles.statText}>{item.completionTime}s</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Preview of first few responses */}
      <View style={styles.responsePreview}>
        {item.responses?.slice(0, 2).map((response, index) => (
          <View key={index} style={styles.previewResponse}>
            <Text style={styles.previewQuestion} numberOfLines={1}>
              {response.questionText}
            </Text>
            <Text style={styles.previewAnswer} numberOfLines={1}>
              {Array.isArray(response.answer) ? 
                response.answer.join(', ') : response.answer}
            </Text>
          </View>
        ))}
        {item.responses?.length > 2 && (
          <Text style={styles.moreResponses}>
            +{item.responses.length - 2} more responses
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderAnalyticsView = () => {
    if (!analytics) {
      return (
        <View style={styles.analyticsLoading}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.analyticsContainer} showsVerticalScrollIndicator={false}>
        {/* Overview Stats */}
        <View style={styles.analyticsSection}>
          <Text style={styles.analyticsSectionTitle}>Overview</Text>
          <View style={styles.overviewStats}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewNumber}>{analytics.totalSubmissions}</Text>
              <Text style={styles.overviewLabel}>Total Responses</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={[styles.overviewNumber, { color: '#34C759' }]}>
                {Math.round(analytics.submissionRate)}%
              </Text>
              <Text style={styles.overviewLabel}>Response Rate</Text>
            </View>
          </View>
        </View>

        {/* Question Analytics */}
        {analytics.questionSummaries?.map((question, index) => (
          <View key={question.questionId} style={styles.analyticsSection}>
            <Text style={styles.questionTitle}>
              {index + 1}. {question.questionText}
            </Text>
            <View style={styles.questionStats}>
              <Text style={styles.questionStatsText}>
                {question.responseCount} responses ({Math.round(question.responseRate)}% response rate)
              </Text>
            </View>

            {/* Question-specific analytics */}
            {renderQuestionAnalytics(question)}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderQuestionAnalytics = (question) => {
    switch (question.questionType) {
      case 'multiple_choice':
      case 'yes_no':
        if (question.optionCounts) {
          const sortedOptions = Object.entries(question.optionCounts)
            .sort(([,a], [,b]) => b - a);

          return (
            <View style={styles.chartContainer}>
              {sortedOptions.map(([option, count], index) => (
                <View key={index} style={styles.optionBar}>
                  <Text style={styles.optionText}>{option}</Text>
                  <View style={styles.barContainer}>
                    <View 
                      style={[
                        styles.barFill, 
                        { 
                          width: `${(count / question.responseCount) * 100}%`,
                          backgroundColor: `hsl(${(index * 60) % 360}, 70%, 50%)`
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.countText}>{count}</Text>
                </View>
              ))}
              <Text style={styles.mostPopular}>
                Most popular: {question.mostPopularAnswer}
              </Text>
            </View>
          );
        }
        break;

      case 'rating':
        if (question.ratingDistribution) {
          const ratings = Object.keys(question.ratingDistribution).sort();
          const maxCount = Math.max(...Object.values(question.ratingDistribution));

          return (
            <View style={styles.chartContainer}>
              <View style={styles.ratingChart}>
                {ratings.map(rating => (
                  <View key={rating} style={styles.ratingBar}>
                    <Text style={styles.ratingLabel}>{rating}★</Text>
                    <View style={styles.barContainer}>
                      <View 
                        style={[
                          styles.barFill, 
                          { 
                            width: `${(question.ratingDistribution[rating] / maxCount) * 100}%`,
                            backgroundColor: '#FFD700'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.countText}>{question.ratingDistribution[rating]}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.averageRating}>
                Average rating: {question.averageRating?.toFixed(1)} stars
              </Text>
            </View>
          );
        }
        break;

      case 'checkbox':
        if (question.optionCounts) {
          const sortedOptions = Object.entries(question.optionCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5); // Top 5 options

          return (
            <View style={styles.checkboxAnalytics}>
              {sortedOptions.map(([option, count], index) => (
                <View key={index} style={styles.checkboxOption}>
                  <Text style={styles.checkboxOptionText}>{option}</Text>
                  <View style={styles.checkboxBar}>
                    <View 
                      style={[
                        styles.checkboxBarFill, 
                        { width: `${(count / question.responseCount) * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.checkboxCount}>{count}</Text>
                </View>
              ))}
            </View>
          );
        }
        break;

      case 'short_answer':
        if (question.sampleAnswers?.length > 0) {
          return (
            <View style={styles.sampleAnswers}>
              <Text style={styles.sampleAnswersTitle}>Sample responses:</Text>
              {question.sampleAnswers.map((answer, index) => (
                <Text key={index} style={styles.sampleAnswer}>
                  "{answer}"
                </Text>
              ))}
            </View>
          );
        }
        break;
    }

    return null;
  };

  const renderSubmissionModal = () => (
    <Modal
      visible={showSubmissionModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSubmissionModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.submissionModal}>
          <View style={styles.submissionModalHeader}>
            <Text style={styles.submissionModalTitle}>Form Response</Text>
            <TouchableOpacity onPress={() => setShowSubmissionModal(false)}>
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>

          {selectedSubmission && (
            <ScrollView style={styles.submissionModalContent}>
              {/* User Info */}
              <View style={styles.submissionUserInfo}>
                <Text style={styles.submissionUserName}>
                  {selectedSubmission.user?.username || 'Anonymous'}
                </Text>
                <Text style={styles.submissionUserDate}>
                  Submitted on {new Date(selectedSubmission.submittedAt).toLocaleDateString()}
                  {selectedSubmission.completionTime && 
                    ` • Completed in ${selectedSubmission.completionTime}s`
                  }
                </Text>
              </View>

              {/* Responses */}
              <View style={styles.responsesContainer}>
                {selectedSubmission.responses?.map((response, index) => (
                  <View key={index} style={styles.responseItem}>
                    <Text style={styles.responseQuestion}>
                      {index + 1}. {response.questionText}
                    </Text>
                    <View style={styles.responseAnswerContainer}>
                      <Text style={styles.responseAnswer}>
                        {Array.isArray(response.answer) ? 
                          response.answer.join(', ') : response.answer}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#8E8E93" />
      <TextInput
        style={styles.searchInput}
        placeholder="Search responses..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#C7C7CC"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Ionicons name="close-circle" size={20} color="#8E8E93" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No matching responses' : 'No responses yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 
          'Try adjusting your search terms' : 
          'Form responses will appear here as attendees submit them'
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading form responses...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {viewMode === 'list' ? (
        <>
          {/* Form Info Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{form?.title || 'Form Responses'}</Text>
            {form?.description && (
              <Text style={styles.formDescription}>{form.description}</Text>
            )}
            <View style={styles.formStats}>
              <View style={styles.formStat}>
                <Text style={styles.formStatNumber}>{submissions.length}</Text>
                <Text style={styles.formStatLabel}>Total Responses</Text>
              </View>
              <View style={styles.formStat}>
                <Text style={styles.formStatNumber}>{form?.questions?.length || 0}</Text>
                <Text style={styles.formStatLabel}>Questions</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          {renderSearchBar()}

          {/* Responses List */}
          <FlatList
            data={filteredSubmissions}
            keyExtractor={(item) => item._id}
            renderItem={renderSubmissionItem}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={filteredSubmissions.length === 0 ? styles.emptyList : undefined}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        renderAnalyticsView()
      )}

      {/* Submission Detail Modal */}
      {renderSubmissionModal()}
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

  // Header
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },

  // Form Header
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
    lineHeight: 22,
    marginBottom: 16,
  },
  formStats: {
    flexDirection: 'row',
    gap: 24,
  },
  formStat: {
    alignItems: 'center',
  },
  formStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3797EF',
  },
  formStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },

  // Submission Items
  submissionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  submissionDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  submissionStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    backgroundColor: '#F0F8FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
  },
  responsePreview: {
    gap: 8,
  },
  previewResponse: {
    borderLeftWidth: 3,
    borderLeftColor: '#3797EF',
    paddingLeft: 12,
  },
  previewQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  previewAnswer: {
    fontSize: 14,
    color: '#8E8E93',
  },
  moreResponses: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // Analytics View
  analyticsContainer: {
    flex: 1,
  },
  analyticsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  analyticsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    gap: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  overviewNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3797EF',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  questionStats: {
    marginBottom: 16,
  },
  questionStatsText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Charts
  chartContainer: {
    marginVertical: 16,
  },
  optionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  optionText: {
    flex: 2,
    fontSize: 14,
    color: '#000000',
  },
  barContainer: {
    flex: 3,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  countText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  mostPopular: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    marginTop: 8,
  },

  // Rating Chart
  ratingChart: {
    gap: 8,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#000000',
    minWidth: 30,
  },
  averageRating: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
    marginTop: 8,
  },

  // Checkbox Analytics
  checkboxAnalytics: {
    gap: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
  },
  checkboxBar: {
    flex: 2,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
  },
  checkboxBarFill: {
    height: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 4,
  },
  checkboxCount: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },

  // Sample Answers
  sampleAnswers: {
    gap: 8,
  },
  sampleAnswersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  sampleAnswer: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#F0F0F0',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyList: {
    flexGrow: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  submissionModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  submissionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  submissionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  submissionModalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  submissionUserInfo: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  submissionUserName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  submissionUserDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  responsesContainer: {
    paddingVertical: 16,
  },
  responseItem: {
    marginBottom: 24,
  },
  responseQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  responseAnswerContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
  },
  responseAnswer: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },
});