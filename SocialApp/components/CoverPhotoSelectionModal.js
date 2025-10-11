// components/CoverPhotoSelectionModal.js - Enhanced cover photo selection with templates first
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const { width: screenWidth } = Dimensions.get('window');

// Template categories with fewer options for easier testing
const TEMPLATE_CATEGORIES = [
  {
    id: 'party',
    name: 'Party',
    icon: 'sparkles',
    color: '#FF6B9D',
    templates: [
      { 
        id: 'party_1', 
        name: 'Neon Lights', 
        image: require('../assets/event-templates/party1.jpg') 
      },
      { 
        id: 'party_2', 
        name: 'Club Vibes', 
        image: require('../assets/event-templates/party2.jpg') 
      },
    ]
  },
  {
    id: 'birthday',
    name: 'Birthday',
    icon: 'gift',
    color: '#FFD93D',
    templates: [
      { 
        id: 'birthday_1', 
        name: 'Birthday Balloons', 
        image: require('../assets/event-templates/birthday1.jpg') 
      },
      { 
        id: 'birthday_2', 
        name: 'Birthday Cake', 
        image: require('../assets/event-templates/birthday2.jpg') 
      },
    ]
  },
  {
    id: 'food',
    name: 'Food',
    icon: 'restaurant',
    color: '#FF8A65',
    templates: [
      { 
        id: 'food_1', 
        name: 'Fine Dining', 
        image: require('../assets/event-templates/food1.jpg') 
      },
      { 
        id: 'food_2', 
        name: 'BBQ Party', 
        image: require('../assets/event-templates/food2.jpg') 
      },
    ]
  },
  {
    id: 'music',
    name: 'Music',
    icon: 'musical-notes',
    color: '#9C27B0',
    templates: [
      { 
        id: 'music_1', 
        name: 'Concert', 
        image: require('../assets/event-templates/music1.jpg') 
      },
      { 
        id: 'music_2', 
        name: 'DJ Night', 
        image: require('../assets/event-templates/music2.jpg') 
      },
    ]
  },
];


const CoverPhotoSelectionModal = ({ 
  visible, 
  onClose, 
  onSelectCover,
  eventTitle = "Your Event" 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('party');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const currentCategory = TEMPLATE_CATEGORIES.find(cat => cat.id === selectedCategory);

  const handleTemplateSelect = (template) => {
  setSelectedTemplate(template);
  onSelectCover(template.image, 'template');
  onClose();
  setSelectedTemplate(null);
};

  const handleCustomPhotoOptions = () => {
    Alert.alert(
      'Custom Photo',
      'Choose how to add your custom photo',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Take Photo', onPress: takePhoto }
      ]
    );
  };

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      onSelectCover({ uri: result.assets[0].uri }, 'upload');
      onClose();
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      onSelectCover({ uri: result.assets[0].uri }, 'upload');
      onClose();
    }
  };

  const renderCategoryTab = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === item.id && { backgroundColor: item.color }
      ]}
      onPress={() => setSelectedCategory(item.id)}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={item.icon} 
        size={20} 
        color={selectedCategory === item.id ? '#FFFFFF' : item.color} 
      />
      <Text style={[
        styles.categoryTabText,
        selectedCategory === item.id && { color: '#FFFFFF' }
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderTemplate = ({ item }) => (
    <TouchableOpacity
      style={styles.templateItem}
      onPress={() => handleTemplateSelect(item)}
      activeOpacity={0.8}
    >
      <Image source={item.image} style={styles.templateImage} />
      
      {/* Event Title Overlay Preview */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.templateOverlay}
      >
        <Text style={styles.templatePreviewTitle} numberOfLines={2}>
          {eventTitle}
        </Text>
      </LinearGradient>

      {/* Template Name */}
      <View style={styles.templateNameContainer}>
        <Text style={styles.templateName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000000" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Choose Cover Photo</Text>
            <Text style={styles.headerSubtitle}>Select a template or use your own photo</Text>
          </View>

          <TouchableOpacity 
            onPress={handleCustomPhotoOptions}
            style={styles.customPhotoButton}
          >
            <Ionicons name="camera" size={20} color="#3797EF" />
          </TouchableOpacity>
        </View>

        {/* Custom Photo Option Bar */}
        <View style={styles.customPhotoBar}>
          <TouchableOpacity
            style={styles.customPhotoOption}
            onPress={handleCustomPhotoOptions}
            activeOpacity={0.7}
          >
            <View style={styles.customPhotoIcon}>
              <Ionicons name="add" size={24} color="#3797EF" />
            </View>
            <View style={styles.customPhotoText}>
              <Text style={styles.customPhotoTitle}>Use Custom Photo</Text>
              <Text style={styles.customPhotoDesc}>Upload from gallery or camera</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Templates Section */}
        <View style={styles.templatesSection}>
          <View style={styles.templatesSectionHeader}>
            <Text style={styles.templatesSectionTitle}>Choose from Templates</Text>
            <Text style={styles.templatesSectionSubtitle}>Professional designs ready to use</Text>
          </View>

          {/* Category Tabs */}
          <View style={styles.categoriesContainer}>
            <FlatList
              data={TEMPLATE_CATEGORIES}
              renderItem={renderCategoryTab}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            />
          </View>

          {/* Templates Grid */}
          <FlatList
            data={currentCategory?.templates || []}
            renderItem={renderTemplate}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.templatesGrid}
            columnWrapperStyle={styles.templateRow}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  customPhotoButton: {
    padding: 4,
  },

  // Custom Photo Bar
  customPhotoBar: {
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  customPhotoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  customPhotoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customPhotoText: {
    flex: 1,
  },
  customPhotoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  customPhotoDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Templates Section
  templatesSection: {
    flex: 1,
  },
  templatesSectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  templatesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  templatesSectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Categories
  categoriesContainer: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAFA',
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryTabText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },

  // Templates
  templatesGrid: {
    padding: 16,
  },
  templateRow: {
    justifyContent: 'space-between',
  },
  templateItem: {
    width: (screenWidth - 48) / 2,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F8F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  templateOverlay: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  templatePreviewTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  templateNameContainer: {
    padding: 8,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
  },
});

export default CoverPhotoSelectionModal;