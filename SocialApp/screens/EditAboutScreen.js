// screens/EditAboutScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function EditAboutScreen({ route, navigation }) {
  const { section } = route.params || {};
  
  // State for all About fields
  const [school, setSchool] = useState('');
  const [classYear, setClassYear] = useState('');
  const [major, setMajor] = useState('');
  const [minor, setMinor] = useState('');
  const [hometown, setHometown] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [favoriteMovie, setFavoriteMovie] = useState('');
  const [favoriteArtist, setFavoriteArtist] = useState('');
  const [favoriteTVShow, setFavoriteTVShow] = useState('');
  const [favoriteCampusSpot, setFavoriteCampusSpot] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/api/profile');
      setSchool(data.school || '');
      setClassYear(data.classYear || '');
      setMajor(data.major || '');
      setMinor(data.minor || '');
      setHometown(data.hometown || '');
      setRelationshipStatus(data.relationshipStatus || '');
      setLookingFor(data.lookingFor || '');
      setFavoriteMovie(data.favoriteMovie || '');
      setFavoriteArtist(data.favoriteArtist || '');
      setFavoriteTVShow(data.favoriteTVShow || '');
      setFavoriteCampusSpot(data.favoriteCampusSpot || '');
    } catch (e) {
      console.error('EditAbout fetch:', e.response?.data || e);
      Alert.alert('Error', 'Could not load profile');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/api/profile', {
        school: school.trim() || undefined,
        classYear: classYear.trim() || undefined,
        major: major.trim() || undefined,
        minor: minor.trim() || undefined,
        hometown: hometown.trim() || undefined,
        relationshipStatus: relationshipStatus || undefined,
        lookingFor: lookingFor || undefined,
        favoriteMovie: favoriteMovie.trim() || undefined,
        favoriteArtist: favoriteArtist.trim() || undefined,
        favoriteTVShow: favoriteTVShow.trim() || undefined,
        favoriteCampusSpot: favoriteCampusSpot.trim() || undefined,
      });

      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (e) {
      console.error('EditAbout save:', e.response?.data || e);
      Alert.alert('Error', 'Could not save changes');
    } finally {
      setLoading(false);
    }
  };

  const renderEducationFields = () => (
    <>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>School</Text>
        <TextInput
          style={styles.textInput}
          value={school}
          onChangeText={setSchool}
          placeholder="Your school or college"
          placeholderTextColor="#aaa"
        />
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Class Year</Text>
        <TextInput
          style={styles.textInput}
          value={classYear}
          onChangeText={setClassYear}
          placeholder="e.g., Senior, 2024"
          placeholderTextColor="#aaa"
        />
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Major</Text>
        <TextInput
          style={styles.textInput}
          value={major}
          onChangeText={setMajor}
          placeholder="Your major"
          placeholderTextColor="#aaa"
        />
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Minor (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={minor}
          onChangeText={setMinor}
          placeholder="Your minor"
          placeholderTextColor="#aaa"
        />
      </View>
    </>
  );

  const renderWorkFields = () => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>Hometown</Text>
      <TextInput
        style={styles.textInput}
        value={hometown}
        onChangeText={setHometown}
        placeholder="City only"
        placeholderTextColor="#aaa"
      />
    </View>
  );

  const renderSocialFields = () => (
    <>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Relationship Status</Text>
        <View style={styles.radioGroup}>
          {['single', 'in-relationship', 'complicated', 'prefer-not-say'].map((status) => (
            <TouchableOpacity
              key={status}
              style={styles.radioOption}
              onPress={() => setRelationshipStatus(status)}
            >
              <View style={styles.radioCircle}>
                {relationshipStatus === status && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.radioLabel}>
                {status === 'single' ? 'Single' :
                 status === 'in-relationship' ? 'In a relationship' :
                 status === 'complicated' ? "It's complicated" :
                 'Prefer not to say'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Looking For</Text>
        <View style={styles.radioGroup}>
          {['roommates', 'study-group', 'parties', 'nothing'].map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.radioOption}
              onPress={() => setLookingFor(option)}
            >
              <View style={styles.radioCircle}>
                {lookingFor === option && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.radioLabel}>
                {option === 'roommates' ? 'Roommates' :
                 option === 'study-group' ? 'Study group' :
                 option === 'parties' ? 'Parties' :
                 'Nothing'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  const renderInterestsFields = () => (
    <>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Favorite Movie</Text>
        <TextInput
          style={styles.textInput}
          value={favoriteMovie}
          onChangeText={setFavoriteMovie}
          placeholder="Your favorite movie"
          placeholderTextColor="#aaa"
        />
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Favorite Artist</Text>
        <TextInput
          style={styles.textInput}
          value={favoriteArtist}
          onChangeText={setFavoriteArtist}
          placeholder="Your favorite artist"
          placeholderTextColor="#aaa"
        />
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Favorite TV Show</Text>
        <TextInput
          style={styles.textInput}
          value={favoriteTVShow}
          onChangeText={setFavoriteTVShow}
          placeholder="Your favorite TV show"
          placeholderTextColor="#aaa"
        />
      </View>
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>Favorite Campus Spot</Text>
        <TextInput
          style={styles.textInput}
          value={favoriteCampusSpot}
          onChangeText={setFavoriteCampusSpot}
          placeholder="Your favorite campus spot"
          placeholderTextColor="#aaa"
        />
      </View>
    </>
  );

  const getSectionTitle = () => {
    switch (section) {
      case 'education': return 'Education';
      case 'work': return 'Work & Info';
      case 'social': return 'Social Context';
      case 'interests': return 'Interests';
      default: return 'About';
    }
  };

  const renderFields = () => {
    switch (section) {
      case 'education': return renderEducationFields();
      case 'work': return renderWorkFields();
      case 'social': return renderSocialFields();
      case 'interests': return renderInterestsFields();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{getSectionTitle()}</Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.headerButton, loading && styles.headerButtonDisabled]}
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.fieldsContainer}>
              {renderFields()}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'right',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  fieldsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldWrapper: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 17,
    color: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#000',
  },
});

