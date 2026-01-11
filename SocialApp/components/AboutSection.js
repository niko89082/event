// components/AboutSection.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 300;

export default function AboutSection({ user, isSelf, onEditPress, navigation }) {
  const aboutData = user?.about || {};
  const basicIdentity = aboutData.basicIdentity || {};
  const socialContext = aboutData.socialContext || {};
  const interests = aboutData.interests || {};
  const activity = aboutData.activity || {};

  // For self: always show cards (even if empty). For others: only show if data exists
  const hasEducation = isSelf ? true : !!(basicIdentity.school || basicIdentity.major || basicIdentity.classYear || basicIdentity.minor);
  const hasWork = isSelf ? true : !!(basicIdentity.hometown);
  const hasSocialContext = isSelf ? true : !!(socialContext.relationshipStatus || socialContext.lookingFor);
  const hasInterests = isSelf ? true : !!(interests.favoriteMovie || interests.favoriteArtist || interests.favoriteTVShow || interests.favoriteCampusSpot);
  const hasActivity = !!(activity.recentlyWatched?.length > 0 || activity.recentlyListened?.length > 0);
  
  // Check if sections actually have data (for displaying content)
  const hasEducationData = !!(basicIdentity.school || basicIdentity.major || basicIdentity.classYear || basicIdentity.minor);
  const hasWorkData = !!(basicIdentity.hometown);
  const hasSocialContextData = !!(socialContext.relationshipStatus || socialContext.lookingFor);
  const hasInterestsData = !!(interests.favoriteMovie || interests.favoriteArtist || interests.favoriteTVShow || interests.favoriteCampusSpot);

  const renderEducationCard = () => {
    if (!hasEducation) return null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconContainer, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
            <Ionicons name="school" size={28} color="#2B8CEE" />
          </View>
          {isSelf && (
            <TouchableOpacity
              onPress={() => navigation?.navigate('EditAboutScreen', { section: 'education' })}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>{hasEducationData ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardTitle}>Education</Text>
        <View style={styles.cardContent}>
          {isSelf ? (
            <>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !basicIdentity.school && styles.emptyFieldValue]}>
                  {basicIdentity.school || 'Add school'}
                </Text>
                <Text style={styles.cardTag}>College</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !basicIdentity.major && styles.emptyFieldValue]}>
                  {basicIdentity.major || 'Add major'}
                </Text>
                <Text style={styles.cardTag}>Major</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !basicIdentity.classYear && styles.emptyFieldValue]}>
                  {basicIdentity.classYear || 'Add class year'}
                </Text>
                <Text style={styles.cardTag}>Year</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !basicIdentity.minor && styles.emptyFieldValue]}>
                  {basicIdentity.minor || 'Add minor (optional)'}
                </Text>
                <Text style={styles.cardTag}>Minor</Text>
              </View>
            </>
          ) : hasEducationData ? (
            <>
              {basicIdentity.school && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{basicIdentity.school}</Text>
                  <Text style={styles.cardTag}>College</Text>
                </View>
              )}
              {basicIdentity.major && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{basicIdentity.major}</Text>
                  <Text style={styles.cardTag}>Major</Text>
                </View>
              )}
              {basicIdentity.classYear && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{basicIdentity.classYear}</Text>
                  <Text style={styles.cardTag}>Year</Text>
                </View>
              )}
              {basicIdentity.minor && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{basicIdentity.minor}</Text>
                  <Text style={styles.cardTag}>Minor</Text>
                </View>
              )}
            </>
          ) : null}
        </View>
      </View>
    );
  };

  const renderWorkCard = () => {
    if (!hasWork) return null;

    return (
      <View style={[styles.card, styles.workCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconContainer, { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
            <Ionicons name="briefcase" size={28} color="#10B981" />
          </View>
          {isSelf && (
            <TouchableOpacity
              onPress={() => navigation?.navigate('EditAboutScreen', { section: 'work' })}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>{hasWorkData ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardTitle}>Work & Info</Text>
        <View style={styles.cardContent}>
          {isSelf ? (
            <View style={styles.workItem}>
              <View style={styles.workIcon}>
                <Ionicons name="location" size={18} color="#64748B" />
              </View>
              <View style={styles.workText}>
                <Text style={[styles.workValue, !basicIdentity.hometown && styles.emptyFieldValue]}>
                  {basicIdentity.hometown || 'Add hometown'}
                </Text>
                <Text style={styles.workLabel}>Lives in</Text>
              </View>
            </View>
          ) : hasWorkData ? (
            basicIdentity.hometown && (
              <View style={styles.workItem}>
                <View style={styles.workIcon}>
                  <Ionicons name="location" size={18} color="#64748B" />
                </View>
                <View style={styles.workText}>
                  <Text style={styles.workValue}>{basicIdentity.hometown}</Text>
                  <Text style={styles.workLabel}>Lives in</Text>
                </View>
              </View>
            )
          ) : null}
        </View>
      </View>
    );
  };

  const renderSocialContextCard = () => {
    if (!hasSocialContext) return null;

    const getRelationshipStatusLabel = (status) => {
      const labels = {
        'single': 'Single',
        'in-relationship': 'In a relationship',
        'complicated': "It's complicated",
        'prefer-not-say': 'Prefer not to say'
      };
      return labels[status] || status;
    };

    const getLookingForLabel = (lookingFor) => {
      const labels = {
        'roommates': 'Roommates',
        'study-group': 'Study group',
        'parties': 'Parties',
        'nothing': 'Nothing'
      };
      return labels[lookingFor] || lookingFor;
    };

    return (
      <View style={[styles.card, styles.socialCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconContainer, { backgroundColor: '#FDF4FF', borderColor: '#F3E8FF' }]}>
            <Ionicons name="heart" size={28} color="#A855F7" />
          </View>
          {isSelf && (
            <TouchableOpacity
              onPress={() => navigation?.navigate('EditAboutScreen', { section: 'social' })}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>{hasSocialContextData ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardTitle}>Relationships</Text>
        <View style={styles.cardContent}>
          {isSelf ? (
            <>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !socialContext.relationshipStatus && styles.emptyFieldValue]}>
                  {socialContext.relationshipStatus ? getRelationshipStatusLabel(socialContext.relationshipStatus) : 'Add relationship status'}
                </Text>
                <Text style={styles.cardTag}>Status</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, (!socialContext.lookingFor || socialContext.lookingFor === 'nothing') && styles.emptyFieldValue]}>
                  {socialContext.lookingFor && socialContext.lookingFor !== 'nothing' ? getLookingForLabel(socialContext.lookingFor) : 'Add what you\'re looking for'}
                </Text>
                <Text style={styles.cardTag}>Looking for</Text>
              </View>
            </>
          ) : hasSocialContextData ? (
            <>
              {socialContext.relationshipStatus && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{getRelationshipStatusLabel(socialContext.relationshipStatus)}</Text>
                  <Text style={styles.cardTag}>Status</Text>
                </View>
              )}
              {socialContext.lookingFor && socialContext.lookingFor !== 'nothing' && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{getLookingForLabel(socialContext.lookingFor)}</Text>
                  <Text style={styles.cardTag}>Looking for</Text>
                </View>
              )}
            </>
          ) : null}
        </View>
      </View>
    );
  };

  const renderInterestsCard = () => {
    if (!hasInterests) return null;

    return (
      <View style={[styles.card, styles.interestsCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconContainer, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Ionicons name="star" size={28} color="#F59E0B" />
          </View>
          {isSelf && (
            <TouchableOpacity
              onPress={() => navigation?.navigate('EditAboutScreen', { section: 'interests' })}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>{hasInterestsData ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardTitle}>Interests</Text>
        <View style={styles.cardContent}>
          {isSelf ? (
            <>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !interests.favoriteMovie && styles.emptyFieldValue]}>
                  {interests.favoriteMovie || 'Add favorite movie'}
                </Text>
                <Text style={styles.cardTag}>Movie</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !interests.favoriteArtist && styles.emptyFieldValue]}>
                  {interests.favoriteArtist || 'Add favorite artist'}
                </Text>
                <Text style={styles.cardTag}>Artist</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !interests.favoriteTVShow && styles.emptyFieldValue]}>
                  {interests.favoriteTVShow || 'Add favorite TV show'}
                </Text>
                <Text style={styles.cardTag}>TV Show</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !interests.favoriteCampusSpot && styles.emptyFieldValue]}>
                  {interests.favoriteCampusSpot || 'Add favorite campus spot'}
                </Text>
                <Text style={styles.cardTag}>Campus Spot</Text>
              </View>
            </>
          ) : hasInterestsData ? (
            <>
              {interests.favoriteMovie && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{interests.favoriteMovie}</Text>
                  <Text style={styles.cardTag}>Movie</Text>
                </View>
              )}
              {interests.favoriteArtist && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{interests.favoriteArtist}</Text>
                  <Text style={styles.cardTag}>Artist</Text>
                </View>
              )}
              {interests.favoriteTVShow && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{interests.favoriteTVShow}</Text>
                  <Text style={styles.cardTag}>TV Show</Text>
                </View>
              )}
              {interests.favoriteCampusSpot && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardValue}>{interests.favoriteCampusSpot}</Text>
                  <Text style={styles.cardTag}>Campus Spot</Text>
                </View>
              )}
            </>
          ) : null}
        </View>
      </View>
    );
  };

  const renderActivityCard = () => {
    if (!hasActivity) return null;

    return (
      <View style={[styles.card, styles.activityCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconContainer, { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }]}>
            <Ionicons name="play-circle" size={28} color="#A855F7" />
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>See All</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.cardTitle}>Activity</Text>
        <View style={styles.cardContent}>
          {activity.recentlyWatched && activity.recentlyWatched.length > 0 && (
            <View style={styles.activitySection}>
              <Text style={styles.activityLabel}>Recently Watched:</Text>
              {activity.recentlyWatched.slice(0, 3).map((item, index) => (
                <Text key={index} style={styles.activityItem}>
                  {item.title}{item.artist ? ` by ${item.artist}` : ''}
                </Text>
              ))}
            </View>
          )}
          {activity.recentlyListened && activity.recentlyListened.length > 0 && (
            <View style={styles.activitySection}>
              <Text style={styles.activityLabel}>Recently Listened:</Text>
              {activity.recentlyListened.slice(0, 3).map((item, index) => (
                <Text key={index} style={styles.activityItem}>
                  {item.title}{item.artist ? ` by ${item.artist}` : ''}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  // For others: don't render if no sections have data. For self: always show all cards
  if (!isSelf && !hasEducation && !hasWork && !hasSocialContext && !hasInterests && !hasActivity) {
    return null;
  }

  const cards = [];
  // For self, always show all cards (even if empty). For others, only show if they have data
  if (isSelf || hasEducation) cards.push(renderEducationCard());
  if (isSelf || hasWork) cards.push(renderWorkCard());
  if (isSelf || hasSocialContext) cards.push(renderSocialContextCard());
  if (isSelf || hasInterests) cards.push(renderInterestsCard());
  if (isSelf || hasActivity) cards.push(renderActivityCard());

  // If no cards to show, return null
  if (cards.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingRight: 16 } // Prevent scrolling past last card
        ]}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        snapToAlignment="start"
        bounces={false}
      >
        {cards.map((card, index) => (
          <View key={index} style={styles.cardWrapper}>
            {card}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
    marginBottom: 0, // No bottom margin - let content determine spacing
    minHeight: 0, // Allow container to collapse when empty
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced vertical padding
    gap: 16,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginRight: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 200,
  },
  workCard: {
    borderColor: '#D1FAE5',
  },
  socialCard: {
    borderColor: '#E9D5FF',
  },
  interestsCard: {
    borderColor: '#FDE68A',
  },
  activityCard: {
    borderColor: '#E9D5FF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  cardContent: {
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  cardTag: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  workItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workText: {
    flex: 1,
  },
  workValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  workLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  activitySection: {
    marginBottom: 12,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
  },
  activityItem: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyFieldValue: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});

