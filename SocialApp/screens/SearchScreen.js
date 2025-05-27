// screens/SearchScreen.js - Simple search screen
import React, { useState } from 'react';
import {
  View, TextInput, Button, FlatList, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('users'); // users | events
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

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
      headerTitle: 'Search',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const runSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const route = tab === 'users' ? '/api/search/users' : '/api/search/events';
      const res = await api.get(`${route}?q=${encodeURIComponent(query)}`);
      setResults(res.data);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const render = ({ item }) =>
    tab === 'users' ? (
      <TouchableOpacity 
        style={styles.item}
        onPress={() => navigation.navigate('ProfileScreen', { userId: item._id })}
      >
        <View style={styles.userItem}>
          <Ionicons name="person-circle-outline" size={40} color="#8E8E93" />
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.username}</Text>
            {item.displayName && (
              <Text style={styles.displayName}>{item.displayName}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity 
        style={styles.item}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
      >
        <View style={styles.eventItem}>
          <Ionicons name="calendar-outline" size={40} color="#8E8E93" />
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventLocation}>{item.location}</Text>
            {item.time && (
              <Text style={styles.eventTime}>
                {new Date(item.time).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search..."
            style={styles.searchInput}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, tab === 'users' && styles.activeTab]}
          onPress={() => setTab('users')}
        >
          <Text style={[styles.tabText, tab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, tab === 'events' && styles.activeTab]}
          onPress={() => setTab('events')}
        >
          <Text style={[styles.tabText, tab === 'events' && styles.activeTabText]}>
            Events
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <FlatList 
        data={results} 
        keyExtractor={(item) => item._id} 
        renderItem={render}
        contentContainerStyle={styles.resultsList}
        ListEmptyComponent={() => (
          query.trim() ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name={tab === 'users' ? 'people-outline' : 'calendar-outline'} 
                size={80} 
                color="#C7C7CC" 
              />
              <Text style={styles.emptyTitle}>
                No {tab} found
              </Text>
              <Text style={styles.emptySubtitle}>
                Try searching for something else
              </Text>
            </View>
          ) : null
        )}
      />
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F8F9FA',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },
  resultsList: {
    paddingHorizontal: 16,
  },
  item: { 
    paddingVertical: 12,
    borderBottomWidth: 0.5, 
    borderBottomColor: '#E1E1E1' 
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  displayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventInfo: {
    marginLeft: 12,
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  eventLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  eventTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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
    lineHeight: 22,
  },
});