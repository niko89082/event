// screens/CreatePickerScreen.js - Updated with Memory option
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
  { key:'post', label:'Post', desc:'Share text, photos, or reviews', icon:'create-outline' },
  { key:'event', label:'Event', desc:'Create an event for others to join', icon:'calendar' },
  { key:'memory', label:'Memory', desc:'Create a shared memory with friends', icon:'images' },
];

export default function CreatePickerScreen({ navigation }) {

  React.useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: 'Create',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onSelect = (key) => {
  console.log('🟡 CreatePickerScreen: Selected option:', key);
  
  if (key === 'post') {
    navigation.navigate('CreatePostScreen');
  } else if (key === 'event') {
    navigation.navigate('CreateEventScreen');
  } else if (key === 'memory') {
    navigation.navigate('CreateMemoryScreen');
  }
};
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.optionCard} 
      onPress={() => onSelect(item.key)}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={32} color="#3797EF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.optionTitle}>{item.label}</Text>
        <Text style={styles.optionDescription}>{item.desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>What would you like to create?</Text>
          <Text style={styles.subtitle}>Choose what you'd like to share with your community</Text>
        </View>

        <FlatList
          data={OPTIONS}
          renderItem={renderItem}
          keyExtractor={i => i.key}
          contentContainerStyle={styles.optionsList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerSection: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsList: {
    paddingBottom: 40,
  },
  optionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    backgroundColor: '#F0F8FF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: { 
    fontWeight: '700', 
    fontSize: 18,
    color: '#000000',
    marginBottom: 4,
  },
  optionDescription: { 
    color: '#8E8E93', 
    fontSize: 14,
    lineHeight: 20,
  },
});