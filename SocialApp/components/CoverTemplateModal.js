// // components/CoverTemplateModal.js - Phase 1 Default Cover Photo Templates
// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Modal,
//   TouchableOpacity,
//   ScrollView,
//   Image,
//   Dimensions,
//   FlatList,
//   SafeAreaView,
//   StatusBar,
//   Alert
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { LinearGradient } from 'expo-linear-gradient';

// const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// // Template categories with sample template data
// const TEMPLATE_CATEGORIES = [
//   {
//     id: 'party',
//     name: 'Party/Nightlife',
//     icon: 'sparkles',
//     color: '#FF6B9D',
//     templates: [
//       { id: 'party_1', name: 'Neon Lights', image: require('../../assets/event-templates/party/neon_lights.jpg') },
//       { id: 'party_2', name: 'Club Vibes', image: require('../../assets/event-templates/party/club_vibes.jpg') },
//       { id: 'party_3', name: 'Dancing Silhouettes', image: require('../../assets/event-templates/party/dancing_silhouettes.jpg') },
//       { id: 'party_4', name: 'Night Party', image: require('../../assets/event-templates/party/night_party.jpg') },
//       { id: 'party_5', name: 'Disco Ball', image: require('../../assets/event-templates/party/disco_ball.jpg') },
//       { id: 'party_6', name: 'Cocktail Party', image: require('../../assets/event-templates/party/cocktail_party.jpg') },
//       { id: 'party_7', name: 'Rooftop Party', image: require('../../assets/event-templates/party/rooftop_party.jpg') }
//     ]
//   },
//   {
//     id: 'birthday',
//     name: 'Birthday',
//     icon: 'gift',
//     color: '#FFD93D',
//     templates: [
//       { id: 'birthday_1', name: 'Birthday Balloons', image: require('../../assets/event-templates/birthday/balloons.jpg') },
//       { id: 'birthday_2', name: 'Birthday Cake', image: require('../../assets/event-templates/birthday/birthday_cake.jpg') },
//       { id: 'birthday_3', name: 'Confetti Party', image: require('../../assets/event-templates/birthday/confetti.jpg') },
//       { id: 'birthday_4', name: 'Golden Birthday', image: require('../../assets/event-templates/birthday/golden_birthday.jpg') },
//       { id: 'birthday_5', name: 'Kids Birthday', image: require('../../assets/event-templates/birthday/kids_birthday.jpg') },
//       { id: 'birthday_6', name: 'Adult Birthday', image: require('../../assets/event-templates/birthday/adult_birthday.jpg') },
//       { id: 'birthday_7', name: 'Birthday Surprise', image: require('../../assets/event-templates/birthday/surprise.jpg') },
//       { id: 'birthday_8', name: 'Birthday Candles', image: require('../../assets/event-templates/birthday/candles.jpg') }
//     ]
//   },
//   {
//     id: 'outdoor',
//     name: 'Outdoor/Nature',
//     icon: 'leaf',
//     color: '#6BCF7F',
//     templates: [
//       { id: 'outdoor_1', name: 'Sunset Gathering', image: require('../../assets/event-templates/outdoor/sunset.jpg') },
//       { id: 'outdoor_2', name: 'Beach Party', image: require('../../assets/event-templates/outdoor/beach.jpg') },
//       { id: 'outdoor_3', name: 'Park Picnic', image: require('../../assets/event-templates/outdoor/park.jpg') },
//       { id: 'outdoor_4', name: 'Hiking Adventure', image: require('../../assets/event-templates/outdoor/hiking.jpg') },
//       { id: 'outdoor_5', name: 'Camping Trip', image: require('../../assets/event-templates/outdoor/camping.jpg') },
//       { id: 'outdoor_6', name: 'Garden Party', image: require('../../assets/event-templates/outdoor/garden.jpg') },
//       { id: 'outdoor_7', name: 'Outdoor Concert', image: require('../../assets/event-templates/outdoor/outdoor_concert.jpg') }
//     ]
//   },
//   {
//     id: 'food',
//     name: 'Food/Dining',
//     icon: 'restaurant',
//     color: '#FF8A65',
//     templates: [
//       { id: 'food_1', name: 'Fine Dining', image: require('../../assets/event-templates/food/fine_dining.jpg') },
//       { id: 'food_2', name: 'Cooking Class', image: require('../../assets/event-templates/food/cooking.jpg') },
//       { id: 'food_3', name: 'Cocktail Hour', image: require('../../assets/event-templates/food/cocktails.jpg') },
//       { id: 'food_4', name: 'Food Festival', image: require('../../assets/event-templates/food/food_festival.jpg') },
//       { id: 'food_5', name: 'Wine Tasting', image: require('../../assets/event-templates/food/wine_tasting.jpg') },
//       { id: 'food_6', name: 'BBQ Party', image: require('../../assets/event-templates/food/bbq.jpg') },
//       { id: 'food_7', name: 'Brunch Event', image: require('../../assets/event-templates/food/brunch.jpg') }
//     ]
//   },
//   {
//     id: 'music',
//     name: 'Music/Concert',
//     icon: 'musical-notes',
//     color: '#9C27B0',
//     templates: [
//       { id: 'music_1', name: 'Stage Lights', image: require('../../assets/event-templates/music/stage_lights.jpg') },
//       { id: 'music_2', name: 'Live Concert', image: require('../../assets/event-templates/music/concert.jpg') },
//       { id: 'music_3', name: 'Music Festival', image: require('../../assets/event-templates/music/festival.jpg') },
//       { id: 'music_4', name: 'DJ Night', image: require('../../assets/event-templates/music/dj_night.jpg') },
//       { id: 'music_5', name: 'Band Performance', image: require('../../assets/event-templates/music/band.jpg') },
//       { id: 'music_6', name: 'Acoustic Session', image: require('../../assets/event-templates/music/acoustic.jpg') },
//       { id: 'music_7', name: 'Music Venue', image: require('../../assets/event-templates/music/venue.jpg') }
//     ]
//   },
//   {
//     id: 'sports',
//     name: 'Sports/Fitness',
//     icon: 'fitness',
//     color: '#03DAC6',
//     templates: [
//       { id: 'sports_1', name: 'Gym Workout', image: require('../../assets/event-templates/sports/gym.jpg') },
//       { id: 'sports_2', name: 'Running Event', image: require('../../assets/event-templates/sports/running.jpg') },
//       { id: 'sports_3', name: 'Team Sports', image: require('../../assets/event-templates/sports/team_sports.jpg') },
//       { id: 'sports_4', name: 'Yoga Class', image: require('../../assets/event-templates/sports/yoga.jpg') },
//       { id: 'sports_5', name: 'Sports Tournament', image: require('../../assets/event-templates/sports/tournament.jpg') },
//       { id: 'sports_6', name: 'Fitness Challenge', image: require('../../assets/event-templates/sports/fitness.jpg') },
//       { id: 'sports_7', name: 'Outdoor Sports', image: require('../../assets/event-templates/sports/outdoor_sports.jpg') }
//     ]
//   },
//   {
//     id: 'business',
//     name: 'Professional/Business',
//     icon: 'business',
//     color: '#455A64',
//     templates: [
//       { id: 'business_1', name: 'Conference', image: require('../../assets/event-templates/business/conference.jpg') },
//       { id: 'business_2', name: 'Networking', image: require('../../assets/event-templates/business/networking.jpg') },
//       { id: 'business_3', name: 'Workshop', image: require('../../assets/event-templates/business/workshop.jpg') },
//       { id: 'business_4', name: 'Meeting', image: require('../../assets/event-templates/business/meeting.jpg') },
//       { id: 'business_5', name: 'Presentation', image: require('../../assets/event-templates/business/presentation.jpg') },
//       { id: 'business_6', name: 'Team Building', image: require('../../assets/event-templates/business/team_building.jpg') },
//       { id: 'business_7', name: 'Corporate Event', image: require('../../assets/event-templates/business/corporate.jpg') }
//     ]
//   }
// ];

// const CoverTemplateModal = ({ 
//   visible, 
//   onClose, 
//   onSelectTemplate,
//   eventTitle = "Your Event" 
// }) => {
//   const [selectedCategory, setSelectedCategory] = useState('party');
//   const [selectedTemplate, setSelectedTemplate] = useState(null);

//   const currentCategory = TEMPLATE_CATEGORIES.find(cat => cat.id === selectedCategory);

//   const handleTemplateSelect = (template) => {
//     setSelectedTemplate(template);
//   };

//   const handleConfirmSelection = () => {
//     if (selectedTemplate) {
//       onSelectTemplate(selectedTemplate);
//       onClose();
//       setSelectedTemplate(null);
//     }
//   };

//   const renderCategoryTab = ({ item }) => (
//     <TouchableOpacity
//       style={[
//         styles.categoryTab,
//         selectedCategory === item.id && { backgroundColor: item.color }
//       ]}
//       onPress={() => setSelectedCategory(item.id)}
//       activeOpacity={0.7}
//     >
//       <Ionicons 
//         name={item.icon} 
//         size={20} 
//         color={selectedCategory === item.id ? '#FFFFFF' : item.color} 
//       />
//       <Text style={[
//         styles.categoryTabText,
//         selectedCategory === item.id && { color: '#FFFFFF' }
//       ]}>
//         {item.name}
//       </Text>
//     </TouchableOpacity>
//   );

//   const renderTemplate = ({ item, index }) => (
//     <TouchableOpacity
//       style={[
//         styles.templateItem,
//         selectedTemplate?.id === item.id && styles.templateItemSelected
//       ]}
//       onPress={() => handleTemplateSelect(item)}
//       activeOpacity={0.8}
//     >
//       <Image source={item.image} style={styles.templateImage} />
      
//       {/* Event Title Overlay Preview */}
//       <LinearGradient
//         colors={['transparent', 'rgba(0,0,0,0.7)']}
//         style={styles.templateOverlay}
//       >
//         <Text style={styles.templatePreviewTitle} numberOfLines={2}>
//           {eventTitle}
//         </Text>
//       </LinearGradient>

//       {/* Selection Indicator */}
//       {selectedTemplate?.id === item.id && (
//         <View style={styles.selectionIndicator}>
//           <Ionicons name="checkmark-circle" size={24} color="#3797EF" />
//         </View>
//       )}

//       {/* Template Name */}
//       <View style={styles.templateNameContainer}>
//         <Text style={styles.templateName}>{item.name}</Text>
//       </View>
//     </TouchableOpacity>
//   );

//   if (!visible) return null;

//   return (
//     <Modal
//       visible={visible}
//       animationType="slide"
//       presentationStyle="pageSheet"
//       onRequestClose={onClose}
//     >
//       <SafeAreaView style={styles.container}>
//         <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
//         {/* Header */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={onClose} style={styles.closeButton}>
//             <Ionicons name="close" size={24} color="#000000" />
//           </TouchableOpacity>
          
//           <View style={styles.headerTitleContainer}>
//             <Text style={styles.headerTitle}>Choose Template</Text>
//             <Text style={styles.headerSubtitle}>Make your event colorful and inviting</Text>
//           </View>

//           {selectedTemplate && (
//             <TouchableOpacity 
//               onPress={handleConfirmSelection}
//               style={styles.selectButton}
//             >
//               <Text style={styles.selectButtonText}>Use</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         {/* Category Tabs */}
//         <View style={styles.categoriesContainer}>
//           <FlatList
//             data={TEMPLATE_CATEGORIES}
//             renderItem={renderCategoryTab}
//             keyExtractor={(item) => item.id}
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             contentContainerStyle={styles.categoriesList}
//           />
//         </View>

//         {/* Templates Grid */}
//         <FlatList
//           data={currentCategory?.templates || []}
//           renderItem={renderTemplate}
//           keyExtractor={(item) => item.id}
//           numColumns={2}
//           contentContainerStyle={styles.templatesGrid}
//           columnWrapperStyle={styles.templateRow}
//           showsVerticalScrollIndicator={false}
//         />
//       </SafeAreaView>
//     </Modal>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
  
//   // Header
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//     borderBottomWidth: 0.5,
//     borderBottomColor: '#E5E5EA',
//   },
//   closeButton: {
//     padding: 4,
//   },
//   headerTitleContainer: {
//     flex: 1,
//     alignItems: 'center',
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#000000',
//   },
//   headerSubtitle: {
//     fontSize: 12,
//     color: '#8E8E93',
//     marginTop: 2,
//   },
//   selectButton: {
//     backgroundColor: '#3797EF',
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 20,
//   },
//   selectButtonText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '600',
//   },

//   // Categories
//   categoriesContainer: {
//     borderBottomWidth: 0.5,
//     borderBottomColor: '#E5E5EA',
//     backgroundColor: '#FAFAFA',
//   },
//   categoriesList: {
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//   },
//   categoryTab: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     marginRight: 8,
//     borderRadius: 20,
//     backgroundColor: '#FFFFFF',
//     borderWidth: 1,
//     borderColor: '#E5E5EA',
//   },
//   categoryTabText: {
//     marginLeft: 6,
//     fontSize: 12,
//     fontWeight: '600',
//     color: '#8E8E93',
//   },

//   // Templates
//   templatesGrid: {
//     padding: 16,
//   },
//   templateRow: {
//     justifyContent: 'space-between',
//   },
//   templateItem: {
//     width: (screenWidth - 48) / 2,
//     marginBottom: 16,
//     borderRadius: 12,
//     overflow: 'hidden',
//     backgroundColor: '#F8F8F8',
//   },
//   templateItemSelected: {
//     borderWidth: 2,
//     borderColor: '#3797EF',
//   },
//   templateImage: {
//     width: '100%',
//     height: 120,
//     resizeMode: 'cover',
//   },
//   templateOverlay: {
//     position: 'absolute',
//     bottom: 28,
//     left: 0,
//     right: 0,
//     height: 60,
//     justifyContent: 'flex-end',
//     paddingHorizontal: 12,
//     paddingBottom: 8,
//   },
//   templatePreviewTitle: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '700',
//     textShadowColor: 'rgba(0,0,0,0.3)',
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 2,
//   },
//   selectionIndicator: {
//     position: 'absolute',
//     top: 8,
//     right: 8,
//     backgroundColor: '#FFFFFF',
//     borderRadius: 12,
//   },
//   templateNameContainer: {
//     padding: 8,
//   },
//   templateName: {
//     fontSize: 12,
//     fontWeight: '500',
//     color: '#000000',
//     textAlign: 'center',
//   },
// });

// export default CoverTemplateModal;