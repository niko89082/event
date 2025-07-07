const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyList: {
    flexGrow: 1,
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  checkedInNumber: {
    color: '#34C759',
  },
  formNumber: {
    color: '#3797EF',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
  },

  // Search and Filter
  searchFilterContainer: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  bulkButtonActive: {
    backgroundColor: '#3797EF',
  },
  bulkButtonText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  bulkButtonTextActive: {
    color: '#FFFFFF',
  },
  bulkActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkRemoveButton: {
    backgroundColor: '#FF3B30',
  },
  bulkActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bulkRemoveText: {
    color: '#FFFFFF',
  },

  // Bulk Selection
  bulkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 8,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  selectedCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Host Action Buttons
  hostActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  hostActionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  hostActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  hostNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  hostNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#3797EF',
    lineHeight: 20,
  },

  // Attendee Items
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  attendeeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  paidText: {
    fontSize: 10,
    color: '#34C759',
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedInText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  formBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
  },

  // Host Actions
  hostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
  },
  checkInButton: {
    backgroundColor: '#E8F5E8',
  },
  checkedInButton: {
    backgroundColor: '#34C759',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE5E5',
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
    marginBottom: 16,
  },
  clearSearchButton: {
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearSearchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  // Export Modal
  exportModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  exportContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  exportDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginVertical: 16,
  },
  exportSection: {
    marginBottom: 24,
  },
  exportSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  exportOption: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  exportOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  exportOptionText: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  exportOptionDesc: {
    fontSize: 14,
    color: '#8E8E93',
  },
  dataIncludedList: {
    gap: 8,
  },
  dataIncludedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dataIncludedText: {
    fontSize: 14,
    color: '#000000',
  },
  exportLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  exportLoadingText: {
    fontSize: 14,
    color: '#3797EF',
  },

  // Filter Modal
  filterModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  resetFiltersButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 20,
  },
  resetFiltersText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },

  // Analytics Modal
  analyticsModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  analyticsContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  analyticsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  analyticsLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  analyticsSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  analyticsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  analyticsCardNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  analyticsCardLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingHorizontal: 8,
  },
  timelineSlot: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 30,
  },
  timelineTime: {
    fontSize: 10,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timelineBar: {
    width: 20,
    height: 80,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    justifyContent: 'flex-end',
  },
  timelineBarFill: {
    width: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 2,
    minHeight: 2,
  },
  timelineCount: {
    fontSize: 10,
    color: '#000000',
    marginTop: 4,
  },
  formAnalyticsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  formStat: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3797EF',
    marginBottom: 4,
  },
  formStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  questionAnalytics: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  questionStats: {
    fontSize: 12,
    color: '#8E8E93',
  },
  paymentAnalyticsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  paymentStat: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  paymentStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 4,
  },
  paymentStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  analyticsError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  analyticsErrorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // QR Modal (from Phase 4)
  qrModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  qrCloseButton: {
    padding: 4,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  qrShareButton: {
    padding: 4,
  },
  qrContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  qrLoadingContainer: {
    alignItems: 'center',
  },
  qrLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  qrCodeContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 32,
  },
  qrInfo: {
    alignItems: 'center',
  },
  qrEventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrInstructions: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrExpiry: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
    marginBottom: 16,
  },
  qrFormNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  qrFormNoticeText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  qrErrorContainer: {
    alignItems: 'center',
  },
  qrErrorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  qrModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  qrRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  qrRefreshButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '600',
  },

  // Form Response Modal (from Phase 4)
  formResponseModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  formResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  formResponseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  formResponseLoading: {
    padding: 40,
    alignItems: 'center',
  },
  formResponseContent: {
    flex: 1,
  },
  formResponseUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  formResponseUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  formResponseUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  responsesList: {
    flex: 1,
  },
  responseItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  responseQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  responseAnswer: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
  },
  noResponseContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResponseText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
});// screens/AttendeeListScreen.js - Phase 5: Complete with Export, Analytics & Advanced Features
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  Share,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AttendeeListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);
  const { eventId, mode = 'view' } = route.params;

  // State
  const [attendees, setAttendees] = useState([]);
  const [filteredAttendees, setFilteredAttendees] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [formSubmissionCount, setFormSubmissionCount] = useState(0);

  // QR Code State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrExpiry, setQrExpiry] = useState(null);

  // Form Response State
  const [showFormResponses, setShowFormResponses] = useState(false);
  const [selectedUserResponses, setSelectedUserResponses] = useState(null);
  const [formResponsesLoading, setFormResponsesLoading] = useState(false);

  // Phase 5: Export & Analytics State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    showCheckedIn: true,
    showNotCheckedIn: true,
    showFormSubmitted: true,
    showFormNotSubmitted: true,
    showPaid: true,
    showNotPaid: true
  });

  // Bulk Operations State
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState(new Set());

  useEffect(() => {
    fetchAttendees();
    if (isHost) {
      fetchAnalytics();
    }
    
    // Set up navigation header with enhanced buttons
    navigation.setOptions({
      headerTitle: 'Attendees',
      headerRight: () => (
        isHost && (
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowAnalyticsModal(true)}
            >
              <Ionicons name="analytics" size={24} color="#3797EF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="download" size={24} color="#3797EF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleShowQR}
            >
              <Ionicons name="qr-code" size={24} color="#3797EF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleOpenScanner}
            >
              <Ionicons name="scan" size={24} color="#3797EF" />
            </TouchableOpacity>
          </View>
        )
      ),
    });
  }, [eventId, isHost]);

  // Auto-refresh QR code every 30 seconds when modal is open
  useEffect(() => {
    let interval;
    if (showQRModal && qrData) {
      interval = setInterval(checkQRExpiry, 30000);
    }
    return () => clearInterval(interval);
  }, [showQRModal, qrData]);

  // Filter attendees based on search and filters
  useEffect(() => {
    let filtered = attendees;
    
    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(attendee => 
        attendee.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attendee.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attendee.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Status filters
    filtered = filtered.filter(attendee => {
      const isCheckedIn = event?.checkedIn?.includes(attendee._id);
      const hasFormSubmission = attendee.formSubmission;
      const hasPaid = attendee.hasPaid;
      
      if (!filters.showCheckedIn && isCheckedIn) return false;
      if (!filters.showNotCheckedIn && !isCheckedIn) return false;
      if (!filters.showFormSubmitted && hasFormSubmission) return false;
      if (!filters.showFormNotSubmitted && !hasFormSubmission) return false;
      if (!filters.showPaid && hasPaid) return false;
      if (!filters.showNotPaid && !hasPaid) return false;
      
      return true;
    });
    
    setFilteredAttendees(filtered);
  }, [attendees, searchQuery, filters, event]);

  const fetchAttendees = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/api/events/${eventId}/attendees-detailed`);
      const data = response.data;

      setAttendees(data.attendees || []);
      setEvent(data.event || null);
      setCheckedInCount(data.checkedInCount || 0);
      setFormSubmissionCount(data.formSubmissionCount || 0);
      setIsHost(data.canManage || false);

    } catch (error) {
      console.error('Error fetching attendees:', error);
      
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Event not found or you do not have permission to view attendees');
      } else {
        Alert.alert('Error', 'Failed to load attendees');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await api.get(`/api/events/${eventId}/analytics`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Phase 5: Export Functions
  const handleExportCSV = async () => {
    try {
      setExportLoading(true);
      const response = await api.post(`/api/events/${eventId}/export`, {
        format: 'csv',
        includeFormResponses: event?.requiresFormForCheckIn,
        filters: {
          ...filters,
          searchQuery
        }
      });

      const csvContent = response.data.csvContent;
      const fileName = `${event?.title || 'event'}_attendees_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'Export file saved to device');
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportGoogleSheets = async () => {
    try {
      setExportLoading(true);
      const response = await api.post(`/api/events/${eventId}/export-google-sheets`, {
        includeFormResponses: event?.requiresFormForCheckIn,
        filters: {
          ...filters,
          searchQuery
        }
      });

      const sheetsUrl = response.data.sheetsUrl;
      Alert.alert(
        'Google Sheets Export',
        'Your data has been exported to Google Sheets. Would you like to open it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open',
            onPress: () => {
              // Open the Google Sheets URL
              Share.share({
                url: sheetsUrl,
                title: 'Event Attendee Data'
              });
            }
          }
        ]
      );

      setShowExportModal(false);
    } catch (error) {
      console.error('Google Sheets export error:', error);
      Alert.alert('Error', 'Failed to export to Google Sheets');
    } finally {
      setExportLoading(false);
    }
  };

  // Phase 5: Bulk Operations
  const handleBulkCheckIn = async () => {
    if (selectedAttendees.size === 0) {
      Alert.alert('No Selection', 'Please select attendees to check in');
      return;
    }

    try {
      const attendeeIds = Array.from(selectedAttendees);
      await api.post(`/api/events/${eventId}/bulk-checkin`, {
        attendeeIds
      });

      await fetchAttendees(true);
      setBulkMode(false);
      setSelectedAttendees(new Set());
      Alert.alert('Success', `${attendeeIds.length} attendees checked in`);
    } catch (error) {
      console.error('Bulk check-in error:', error);
      Alert.alert('Error', 'Failed to check in attendees');
    }
  };

  const handleBulkRemove = async () => {
    if (selectedAttendees.size === 0) {
      Alert.alert('No Selection', 'Please select attendees to remove');
      return;
    }

    Alert.alert(
      'Remove Attendees',
      `Are you sure you want to remove ${selectedAttendees.size} attendees?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const attendeeIds = Array.from(selectedAttendees);
              await api.post(`/api/events/${eventId}/bulk-remove`, {
                attendeeIds
              });

              await fetchAttendees(true);
              setBulkMode(false);
              setSelectedAttendees(new Set());
              Alert.alert('Success', `${attendeeIds.length} attendees removed`);
            } catch (error) {
              console.error('Bulk remove error:', error);
              Alert.alert('Error', 'Failed to remove attendees');
            }
          }
        }
      ]
    );
  };

  const toggleAttendeeSelection = (attendeeId) => {
    const newSelection = new Set(selectedAttendees);
    if (newSelection.has(attendeeId)) {
      newSelection.delete(attendeeId);
    } else {
      newSelection.add(attendeeId);
    }
    setSelectedAttendees(newSelection);
  };

  const selectAllAttendees = () => {
    if (selectedAttendees.size === filteredAttendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(filteredAttendees.map(a => a._id)));
    }
  };

  // Existing functions from Phase 4 (abbreviated for space)
  const handleRemoveAttendee = async (userId) => {
    Alert.alert(
      'Remove Attendee',
      'Are you sure you want to remove this person from the event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/events/${eventId}/remove-attendee`, { userId });
              await fetchAttendees(true);
              Alert.alert('Success', 'Attendee removed from event');
            } catch (error) {
              console.error('Error removing attendee:', error);
              Alert.alert('Error', 'Failed to remove attendee');
            }
          },
        },
      ]
    );
  };

  const handleCheckInToggle = async (userId, isCheckedIn) => {
    try {
      if (isCheckedIn) {
        await api.post(`/api/events/${eventId}/undo-checkin`, { userId });
      } else {
        if (event?.requiresFormForCheckIn && event?.checkInForm) {
          const hasSubmitted = await checkUserFormSubmission(userId);
          if (!hasSubmitted) {
            Alert.alert(
              'Form Required',
              'This attendee must complete the check-in form first.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Form',
                  onPress: () => navigation.navigate('FormSubmissionScreen', {
                    formId: event.checkInForm._id || event.checkInForm,
                    eventId,
                    userId,
                    isCheckIn: true,
                    onSubmissionComplete: () => {
                      fetchAttendees(true);
                    }
                  })
                }
              ]
            );
            return;
          }
        }
        
        await api.post(`/api/events/${eventId}/manual-checkin`, { userId });
      }
      
      await fetchAttendees(true);
    } catch (error) {
      console.error('Error toggling check-in:', error);
      Alert.alert('Error', 'Failed to update check-in status');
    }
  };

  const checkUserFormSubmission = async (userId) => {
    try {
      const response = await api.get(`/api/forms/${event.checkInForm._id || event.checkInForm}/submissions`, {
        params: { eventId, userId }
      });
      return response.data.submissions.length > 0;
    } catch (error) {
      console.error('Error checking form submission:', error);
      return false;
    }
  };

  const handleShowQR = async () => {
    try {
      setQrLoading(true);
      setShowQRModal(true);
      
      const response = await api.post(`/api/events/${eventId}/generate-checkin-qr`, {
        validityHours: 24
      });
      
      setQrData(response.data.qrData);
      setQrExpiry(new Date(response.data.expiresAt));
    } catch (error) {
      console.error('Error generating QR code:', error);
      setShowQRModal(false);
      Alert.alert('Error', 'Failed to generate check-in QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const handleRefreshQR = async () => {
    try {
      setQrLoading(true);
      const response = await api.post(`/api/events/${eventId}/generate-checkin-qr`, {
        validityHours: 24
      });
      
      setQrData(response.data.qrData);
      setQrExpiry(new Date(response.data.expiresAt));
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      Alert.alert('Error', 'Failed to refresh QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const checkQRExpiry = () => {
    if (qrExpiry && new Date() > qrExpiry) {
      Alert.alert(
        'QR Code Expired',
        'The QR code has expired. Generate a new one?',
        [
          { text: 'Close', onPress: () => setShowQRModal(false) },
          { text: 'Refresh', onPress: handleRefreshQR }
        ]
      );
    }
  };

  const handleShareQR = async () => {
    try {
      const shareUrl = `${API_BASE_URL}/events/${eventId}/join`;
      await Share.share({
        message: `Join the event: ${event?.title}\n${shareUrl}`,
        title: 'Event Check-in',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleOpenScanner = () => {
    navigation.navigate('QrScanScreen', { 
      eventId: eventId,
      eventTitle: event?.title,
      mode: 'checkin'
    });
  };

  const handleViewFormResponses = async (attendee) => {
    if (!event?.checkInForm) return;
    
    try {
      setFormResponsesLoading(true);
      setShowFormResponses(true);
      
      const response = await api.get(`/api/forms/${event.checkInForm._id || event.checkInForm}/submissions`, {
        params: { eventId, userId: attendee._id }
      });
      
      const submission = response.data.submissions[0];
      setSelectedUserResponses({
        user: attendee,
        submission: submission || null
      });
    } catch (error) {
      console.error('Error fetching form responses:', error);
      setShowFormResponses(false);
      Alert.alert('Error', 'Failed to load form responses');
    } finally {
      setFormResponsesLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!qrExpiry) return '';
    
    const now = new Date();
    const diff = qrExpiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const renderAttendeeItem = ({ item }) => {
    const isCheckedIn = event?.checkedIn?.includes(item._id) || false;
    const hasFormResponse = event?.requiresFormForCheckIn && item.formSubmission;
    const isSelected = selectedAttendees.has(item._id);

    return (
      <View style={styles.attendeeItem}>
        {/* Bulk Selection Checkbox */}
        {bulkMode && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleAttendeeSelection(item._id)}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.attendeeContent}
          onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
          activeOpacity={0.8}
        >
          <Image
            source={{
              uri: item.profilePicture
                ? `http://${API_BASE_URL}:3000${item.profilePicture}`
                : 'https://placehold.co/50x50.png?text=👤'
            }}
            style={styles.profilePicture}
          />
          <View style={styles.attendeeInfo}>
            <View style={styles.attendeeNameRow}>
              <Text style={styles.username}>{item.username}</Text>
              {item.hasPaid && (
                <View style={styles.paidBadge}>
                  <Ionicons name="card" size={12} color="#34C759" />
                  <Text style={styles.paidText}>Paid</Text>
                </View>
              )}
            </View>
            {item.bio && <Text style={styles.bio}>{item.bio}</Text>}
            
            <View style={styles.statusRow}>
              {isCheckedIn && (
                <View style={styles.checkedInBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.checkedInText}>Checked In</Text>
                </View>
              )}
              {hasFormResponse && (
                <View style={styles.formBadge}>
                  <Ionicons name="document-text" size={14} color="#3797EF" />
                  <Text style={styles.formText}>Form Completed</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Host Actions */}
        {isHost && !bulkMode && (
          <View style={styles.hostActions}>
            {/* Form Response Button */}
            {hasFormResponse && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleViewFormResponses(item)}
              >
                <Ionicons name="document-text" size={20} color="#3797EF" />
              </TouchableOpacity>
            )}
            
            {/* Check-in Toggle */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                isCheckedIn ? styles.checkedInButton : styles.checkInButton
              ]}
              onPress={() => handleCheckInToggle(item._id, isCheckedIn)}
            >
              <Ionicons 
                name={isCheckedIn ? "checkmark-circle" : "checkmark-circle-outline"} 
                size={20} 
                color={isCheckedIn ? "#FFFFFF" : "#34C759"} 
              />
            </TouchableOpacity>
            
            {/* Remove Button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveAttendee(item._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSearchAndFilter = () => (
    <View style={styles.searchFilterContainer}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search attendees..."
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

      {/* Filter and Actions Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="funnel" size={16} color="#3797EF" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>

        {isHost && (
          <>
            <TouchableOpacity
              style={[styles.bulkButton, bulkMode && styles.bulkButtonActive]}
              onPress={() => {
                setBulkMode(!bulkMode);
                setSelectedAttendees(new Set());
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color={bulkMode ? "#FFFFFF" : "#3797EF"} />
              <Text style={[styles.bulkButtonText, bulkMode && styles.bulkButtonTextActive]}>
                {bulkMode ? 'Cancel' : 'Select'}
              </Text>
            </TouchableOpacity>

            {bulkMode && selectedAttendees.size > 0 && (
              <View style={styles.bulkActionsContainer}>
                <TouchableOpacity
                  style={styles.bulkActionButton}
                  onPress={handleBulkCheckIn}
                >
                  <Text style={styles.bulkActionText}>Check In ({selectedAttendees.size})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkActionButton, styles.bulkRemoveButton]}
                  onPress={handleBulkRemove}
                >
                  <Text style={[styles.bulkActionText, styles.bulkRemoveText]}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{attendees.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, styles.checkedInNumber]}>{checkedInCount}</Text>
          <Text style={styles.statLabel}>Checked In</Text>
        </View>
        {event?.requiresFormForCheckIn && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.formNumber]}>{formSubmissionCount}</Text>
              <Text style={styles.statLabel}>Forms</Text>
            </View>
          </>
        )}
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{filteredAttendees.length}</Text>
          <Text style={styles.statLabel}>Showing</Text>
        </View>
      </View>
      
      {/* Search and Filter */}
      {renderSearchAndFilter()}

      {/* Bulk Selection Header */}
      {bulkMode && (
        <View style={styles.bulkHeader}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={selectAllAttendees}
          >
            <Text style={styles.selectAllText}>
              {selectedAttendees.size === filteredAttendees.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>
            {selectedAttendees.size} selected
          </Text>
        </View>
      )}

      {/* Host Action Buttons */}
      {isHost && !bulkMode && (
        <>
          <View style={styles.hostActionButtons}>
            <TouchableOpacity
              style={styles.hostActionButton}
              onPress={handleShowQR}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.gradientButton}
              >
                <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                <Text style={styles.hostActionText}>Show Check-in QR</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hostActionButton}
              onPress={handleOpenScanner}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3797EF', '#1E3A8A']}
                style={styles.gradientButton}
              >
                <Ionicons name="scan" size={20} color="#FFFFFF" />
                <Text style={styles.hostActionText}>Scan QR Codes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.hostNote}>
            <Ionicons name="information-circle-outline" size={16} color="#3797EF" />
            <Text style={styles.hostNoteText}>
              Project the QR code for mass check-in, or scan individual attendee codes
            </Text>
          </View>
        </>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No matching attendees' : 'No attendees yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search or filters' : 'People who join this event will appear here'}
      </Text>
      {searchQuery && (
        <TouchableOpacity
          style={styles.clearSearchButton}
          onPress={() => setSearchQuery('')}
        >
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Continue with modals in next part due to length...
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading attendees...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredAttendees}
        keyExtractor={item => item._id}
        renderItem={renderAttendeeItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAttendees(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredAttendees.length === 0 ? styles.emptyList : undefined}
      />

      {/* Phase 5: Export Modal */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.exportModal}>
            <View style={styles.exportHeader}>
              <Text style={styles.exportTitle}>Export Attendee Data</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.exportContent}>
              <Text style={styles.exportDescription}>
                Export attendee information including check-in status, payment status, and form responses.
              </Text>

              <View style={styles.exportSection}>
                <Text style={styles.exportSectionTitle}>Export Format</Text>
                
                <TouchableOpacity
                  style={styles.exportOption}
                  onPress={handleExportCSV}
                  disabled={exportLoading}
                >
                  <View style={styles.exportOptionContent}>
                    <Ionicons name="document-text" size={24} color="#34C759" />
                    <View style={styles.exportOptionText}>
                      <Text style={styles.exportOptionTitle}>CSV File</Text>
                      <Text style={styles.exportOptionDesc}>Download as spreadsheet file</Text>
                    </View>
                    <Ionicons name="download" size={20} color="#8E8E93" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exportOption}
                  onPress={handleExportGoogleSheets}
                  disabled={exportLoading}
                >
                  <View style={styles.exportOptionContent}>
                    <Ionicons name="grid" size={24} color="#4285F4" />
                    <View style={styles.exportOptionText}>
                      <Text style={styles.exportOptionTitle}>Google Sheets</Text>
                      <Text style={styles.exportOptionDesc}>Export directly to Google Sheets</Text>
                    </View>
                    <Ionicons name="open" size={20} color="#8E8E93" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.exportSection}>
                <Text style={styles.exportSectionTitle}>Data Included</Text>
                <View style={styles.dataIncludedList}>
                  <View style={styles.dataIncludedItem}>
                    <Ionicons name="person" size={16} color="#3797EF" />
                    <Text style={styles.dataIncludedText}>Contact information</Text>
                  </View>
                  <View style={styles.dataIncludedItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#3797EF" />
                    <Text style={styles.dataIncludedText}>Check-in status and timestamp</Text>
                  </View>
                  <View style={styles.dataIncludedItem}>
                    <Ionicons name="card" size={16} color="#3797EF" />
                    <Text style={styles.dataIncludedText}>Payment status</Text>
                  </View>
                  {event?.requiresFormForCheckIn && (
                    <View style={styles.dataIncludedItem}>
                      <Ionicons name="document-text" size={16} color="#3797EF" />
                      <Text style={styles.dataIncludedText}>Form responses</Text>
                    </View>
                  )}
                </View>
              </View>

              {exportLoading && (
                <View style={styles.exportLoading}>
                  <ActivityIndicator size="small" color="#3797EF" />
                  <Text style={styles.exportLoadingText}>Preparing export...</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Phase 5: Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Attendees</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterContent}>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Check-in Status</Text>
                <View style={styles.filterOption}>
                  <Text style={styles.filterOptionText}>Show checked in attendees</Text>
                  <Switch
                    value={filters.showCheckedIn}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, showCheckedIn: value }))}
                    trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={styles.filterOption}>
                  <Text style={styles.filterOptionText}>Show not checked in attendees</Text>
                  <Switch
                    value={filters.showNotCheckedIn}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, showNotCheckedIn: value }))}
                    trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {event?.requiresFormForCheckIn && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Form Status</Text>
                  <View style={styles.filterOption}>
                    <Text style={styles.filterOptionText}>Show form submitted</Text>
                    <Switch
                      value={filters.showFormSubmitted}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, showFormSubmitted: value }))}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.filterOption}>
                    <Text style={styles.filterOptionText}>Show form not submitted</Text>
                    <Switch
                      value={filters.showFormNotSubmitted}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, showFormNotSubmitted: value }))}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              )}

              {event?.pricing && !event.pricing.isFree && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Payment Status</Text>
                  <View style={styles.filterOption}>
                    <Text style={styles.filterOptionText}>Show paid attendees</Text>
                    <Switch
                      value={filters.showPaid}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, showPaid: value }))}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.filterOption}>
                    <Text style={styles.filterOptionText}>Show unpaid attendees</Text>
                    <Switch
                      value={filters.showNotPaid}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, showNotPaid: value }))}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.resetFiltersButton}
                onPress={() => setFilters({
                  showCheckedIn: true,
                  showNotCheckedIn: true,
                  showFormSubmitted: true,
                  showFormNotSubmitted: true,
                  showPaid: true,
                  showNotPaid: true
                })}
              >
                <Text style={styles.resetFiltersText}>Reset All Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Phase 5: Analytics Modal */}
      <Modal
        visible={showAnalyticsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAnalyticsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.analyticsModal}>
            <View style={styles.analyticsHeader}>
              <Text style={styles.analyticsTitle}>Event Analytics</Text>
              <TouchableOpacity onPress={() => setShowAnalyticsModal(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.analyticsContent}>
              {analyticsLoading ? (
                <View style={styles.analyticsLoading}>
                  <ActivityIndicator size="large" color="#3797EF" />
                  <Text style={styles.analyticsLoadingText}>Loading analytics...</Text>
                </View>
              ) : analytics ? (
                <>
                  {/* Overview Stats */}
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionTitle}>Overview</Text>
                    <View style={styles.analyticsGrid}>
                      <View style={styles.analyticsCard}>
                        <Text style={styles.analyticsCardNumber}>{analytics.totalAttendees}</Text>
                        <Text style={styles.analyticsCardLabel}>Total Attendees</Text>
                      </View>
                      <View style={styles.analyticsCard}>
                        <Text style={[styles.analyticsCardNumber, { color: '#34C759' }]}>
                          {Math.round((analytics.checkedInCount / analytics.totalAttendees) * 100) || 0}%
                        </Text>
                        <Text style={styles.analyticsCardLabel}>Check-in Rate</Text>
                      </View>
                      <View style={styles.analyticsCard}>
                        <Text style={[styles.analyticsCardNumber, { color: '#3797EF' }]}>
                          {analytics.averageCheckInTime}
                        </Text>
                        <Text style={styles.analyticsCardLabel}>Avg Check-in Time</Text>
                      </View>
                      <View style={styles.analyticsCard}>
                        <Text style={[styles.analyticsCardNumber, { color: '#FF9500' }]}>
                          {analytics.peakCheckInHour}
                        </Text>
                        <Text style={styles.analyticsCardLabel}>Peak Hour</Text>
                      </View>
                    </View>
                  </View>

                  {/* Check-in Timeline */}
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionTitle}>Check-in Timeline</Text>
                    <View style={styles.timelineContainer}>
                      {analytics.checkInTimeline?.map((slot, index) => (
                        <View key={index} style={styles.timelineSlot}>
                          <Text style={styles.timelineTime}>{slot.hour}</Text>
                          <View style={styles.timelineBar}>
                            <View 
                              style={[
                                styles.timelineBarFill, 
                                { height: `${(slot.count / analytics.maxHourlyCheckIns) * 100}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.timelineCount}>{slot.count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Form Analytics */}
                  {event?.requiresFormForCheckIn && analytics.formAnalytics && (
                    <View style={styles.analyticsSection}>
                      <Text style={styles.analyticsSectionTitle}>Form Insights</Text>
                      <View style={styles.formAnalyticsContainer}>
                        <View style={styles.formStat}>
                          <Text style={styles.formStatNumber}>
                            {Math.round((analytics.formAnalytics.completionRate) * 100)}%
                          </Text>
                          <Text style={styles.formStatLabel}>Completion Rate</Text>
                        </View>
                        <View style={styles.formStat}>
                          <Text style={styles.formStatNumber}>
                            {analytics.formAnalytics.averageCompletionTime}s
                          </Text>
                          <Text style={styles.formStatLabel}>Avg Time</Text>
                        </View>
                      </View>
                      
                      {analytics.formAnalytics.questionStats?.map((q, index) => (
                        <View key={index} style={styles.questionAnalytics}>
                          <Text style={styles.questionText}>{q.questionText}</Text>
                          <Text style={styles.questionStats}>
                            {q.responseRate}% response rate • Most common: "{q.mostCommonAnswer}"
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Payment Analytics */}
                  {event?.pricing && !event.pricing.isFree && analytics.paymentAnalytics && (
                    <View style={styles.analyticsSection}>
                      <Text style={styles.analyticsSectionTitle}>Payment Insights</Text>
                      <View style={styles.paymentAnalyticsContainer}>
                        <View style={styles.paymentStat}>
                          <Text style={styles.paymentStatNumber}>
                            ${analytics.paymentAnalytics.totalRevenue}
                          </Text>
                          <Text style={styles.paymentStatLabel}>Total Revenue</Text>
                        </View>
                        <View style={styles.paymentStat}>
                          <Text style={styles.paymentStatNumber}>
                            {Math.round(analytics.paymentAnalytics.paymentRate * 100)}%
                          </Text>
                          <Text style={styles.paymentStatLabel}>Payment Rate</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.analyticsError}>
                  <Ionicons name="analytics" size={48} color="#C7C7CC" />
                  <Text style={styles.analyticsErrorText}>Analytics not available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Existing QR Modal from Phase 4 */}
      <Modal
        visible={showQRModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <SafeAreaView style={styles.qrModalContainer}>
          <View style={styles.qrModalHeader}>
            <TouchableOpacity
              style={styles.qrCloseButton}
              onPress={() => setShowQRModal(false)}
            >
              <Ionicons name="close" size={28} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.qrModalTitle}>Check-in QR Code</Text>
            <TouchableOpacity
              style={styles.qrShareButton}
              onPress={handleShareQR}
            >
              <Ionicons name="share" size={24} color="#3797EF" />
            </TouchableOpacity>
          </View>

          <View style={styles.qrContentContainer}>
            {qrLoading ? (
              <View style={styles.qrLoadingContainer}>
                <ActivityIndicator size="large" color="#3797EF" />
                <Text style={styles.qrLoadingText}>Generating QR Code...</Text>
              </View>
            ) : qrData ? (
              <>
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={JSON.stringify(qrData)}
                    size={SCREEN_WIDTH * 0.6}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                    logoSize={40}
                    logoBackgroundColor="transparent"
                  />
                </View>
                
                <View style={styles.qrInfo}>
                  <Text style={styles.qrEventTitle}>{event?.title}</Text>
                  <Text style={styles.qrInstructions}>
                    Point your camera at this QR code to check in
                  </Text>
                  <Text style={styles.qrExpiry}>
                    {getTimeRemaining()}
                  </Text>
                  
                  {event?.requiresFormForCheckIn && (
                    <View style={styles.qrFormNotice}>
                      <Ionicons name="document-text" size={16} color="#FF9500" />
                      <Text style={styles.qrFormNoticeText}>
                        Form required for check-in
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.qrErrorContainer}>
                <Ionicons name="alert-circle" size={48} color="#FF3B30" />
                <Text style={styles.qrErrorText}>Failed to generate QR code</Text>
              </View>
            )}
          </View>

          <View style={styles.qrModalFooter}>
            <TouchableOpacity
              style={styles.qrRefreshButton}
              onPress={handleRefreshQR}
              disabled={qrLoading}
            >
              <Ionicons name="refresh" size={20} color="#3797EF" />
              <Text style={styles.qrRefreshButtonText}>Refresh QR Code</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Existing Form Response Modal from Phase 4 */}
      <Modal
        visible={showFormResponses}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFormResponses(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.formResponseModal}>
            <View style={styles.formResponseHeader}>
              <Text style={styles.formResponseTitle}>Form Responses</Text>
              <TouchableOpacity
                onPress={() => setShowFormResponses(false)}
              >
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            {formResponsesLoading ? (
              <View style={styles.formResponseLoading}>
                <ActivityIndicator size="large" color="#3797EF" />
              </View>
            ) : selectedUserResponses ? (
              <View style={styles.formResponseContent}>
                <View style={styles.formResponseUser}>
                  <Image
                    source={{
                      uri: selectedUserResponses.user.profilePicture
                        ? `http://${API_BASE_URL}:3000${selectedUserResponses.user.profilePicture}`
                        : 'https://placehold.co/40x40.png?text=👤'
                    }}
                    style={styles.formResponseUserAvatar}
                  />
                  <Text style={styles.formResponseUsername}>
                    {selectedUserResponses.user.username}
                  </Text>
                </View>

                {selectedUserResponses.submission ? (
                  <FlatList
                    data={selectedUserResponses.submission.responses}
                    keyExtractor={(item) => item.questionId}
                    renderItem={({ item }) => (
                      <View style={styles.responseItem}>
                        <Text style={styles.responseQuestion}>{item.questionText}</Text>
                        <Text style={styles.responseAnswer}>
                          {Array.isArray(item.answer) ? item.answer.join(', ') : item.answer}
                        </Text>
                      </View>
                    )}
                    style={styles.responsesList}
                  />
                ) : (
                  <View style={styles.noResponseContainer}>
                    <Ionicons name="document-outline" size={48} color="#C7C7CC" />
                    <Text style={styles.noResponseText}>No form submitted</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}