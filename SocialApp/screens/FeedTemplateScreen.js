// FeedTemplateScreen.js - Template showing all post types for debugging
// This screen displays examples of all post types that can appear in feeds

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FeedTemplateScreen({ navigation }) {
  
  // Template data for each post type
  const templatePosts = [
    {
      type: 'regular_post',
      title: 'Regular Post (Photo)',
      description: 'Photo post with caption from followed user',
      data: {
        user: { username: 'johndoe', fullName: 'John Doe', profilePicture: null },
        paths: ['/uploads/photos/example.jpg'],
        caption: 'This is a regular photo post with a caption. It can include text and an image.',
        postType: 'photo',
        event: { title: 'Summer Festival 2024' },
        userLiked: false,
        likeCount: 42,
        commentCount: 8,
        timestamp: new Date(),
      }
    },
    {
      type: 'text_post',
      title: 'Text Post',
      description: 'Text-only post without images',
      data: {
        user: { username: 'janedoe', fullName: 'Jane Doe', profilePicture: null },
        textContent: 'This is a text-only post. It contains no images, just text content. Users can still like and comment on text posts.',
        postType: 'text',
        caption: 'This is a text-only post. It contains no images, just text content. Users can still like and comment on text posts.',
        userLiked: true,
        likeCount: 15,
        commentCount: 3,
        timestamp: new Date(),
      }
    },
    {
      type: 'text_photo_post',
      title: 'Text + Photo Post',
      description: 'Post with both text and photo',
      data: {
        user: { username: 'alice', fullName: 'Alice Smith', profilePicture: null },
        paths: ['/uploads/photos/example2.jpg'],
        caption: 'This post has both text content and a photo. The caption can be long and detailed.',
        postType: 'photo',
        userLiked: false,
        likeCount: 28,
        commentCount: 5,
        timestamp: new Date(),
      }
    },
    {
      type: 'review_post',
      title: 'Review Post (Movie/Song)',
      description: 'Review post with rating and media info',
      data: {
        user: { username: 'movielover', fullName: 'Movie Lover', profilePicture: null },
        postType: 'photo',
        review: {
          type: 'movie',
          title: 'Inception',
          artist: 'Christopher Nolan',
          year: 2010,
          poster: 'https://example.com/poster.jpg',
          rating: 4.5,
          ratingType: 'stars',
          genre: ['Sci-Fi', 'Thriller'],
          duration: 148,
        },
        caption: 'Just watched this amazing movie! The plot twists are incredible.',
        paths: ['/uploads/photos/review.jpg'],
        userLiked: true,
        likeCount: 67,
        commentCount: 12,
        timestamp: new Date(),
      }
    },
    {
      type: 'photo_comment',
      title: 'Photo Comment Activity',
      description: 'Shows when someone comments on a photo',
      data: {
        comment: {
          text: 'Great photo! Love the composition.',
          createdAt: new Date(),
        },
        photo: {
          url: '/uploads/photos/commented.jpg',
          caption: 'Original photo caption',
        },
        commenter: { username: 'commenter', fullName: 'Comment User', profilePicture: null },
        photoOwner: { username: 'photographer', fullName: 'Photo Owner', profilePicture: null },
      }
    },
    {
      type: 'memory_post',
      title: 'Memory Post',
      description: 'Photo from a shared memory',
      data: {
        user: { username: 'friend', fullName: 'Friend Name', profilePicture: null },
        paths: ['/uploads/memory-photos/memory.jpg'],
        caption: 'Amazing memories from last summer!',
        postType: 'memory',
        memoryInfo: {
          memoryId: 'memory_123',
          memoryTitle: 'Summer 2024',
          participantCount: 5,
        },
        userLiked: false,
        likeCount: 23,
        commentCount: 4,
        timestamp: new Date(),
      }
    },
    {
      type: 'memory_photo_comment',
      title: 'Memory Photo Comment',
      description: 'Shows when someone comments on a memory photo',
      data: {
        comment: {
          text: 'Remember this moment! So much fun.',
          createdAt: new Date(),
        },
        photo: {
          url: '/uploads/memory-photos/commented.jpg',
          caption: 'Memory photo caption',
        },
        memory: {
          title: 'Summer 2024',
        },
        commenter: { username: 'memoryfriend', fullName: 'Memory Friend', profilePicture: null },
        photoUploader: { username: 'uploader', fullName: 'Photo Uploader', profilePicture: null },
      }
    },
    {
      type: 'event_invitation',
      title: 'Event Invitation',
      description: 'Invitation to an event',
      data: {
        event: {
          title: 'Music Festival 2024',
          coverImage: '/uploads/event-covers/festival.jpg',
          time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          privacyLevel: 'public',
        },
        invitedBy: { username: 'host', fullName: 'Event Host', profilePicture: null },
        inviterCount: 1,
        message: 'You\'re invited to this amazing event!',
      }
    },
    {
      type: 'friend_event_join',
      title: 'Friend Event Join',
      description: 'Shows when friends join an event',
      data: {
        event: {
          title: 'Concert Night',
          coverImage: '/uploads/event-covers/concert.jpg',
          time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          attendeeCount: 15,
        },
        friends: [
          { username: 'friend1', fullName: 'Friend One', profilePicture: null },
          { username: 'friend2', fullName: 'Friend Two', profilePicture: null },
        ],
        groupCount: 2,
        isGrouped: true,
      }
    },
    {
      type: 'event_created',
      title: 'Event Created',
      description: 'Shows when someone creates an event',
      data: {
        event: {
          title: 'New Year Party',
          description: 'Join us for an amazing New Year celebration!',
          time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          location: 'Downtown Venue',
          coverImage: '/uploads/event-covers/party.jpg',
          privacyLevel: 'public',
          category: 'Party',
          attendeeCount: 0,
        },
        user: { username: 'eventcreator', fullName: 'Event Creator', profilePicture: null },
      }
    },
    {
      type: 'event_reminder',
      title: 'Event Reminder',
      description: 'Reminder for upcoming event',
      data: {
        event: {
          title: 'Workshop Tomorrow',
          coverImage: '/uploads/event-covers/workshop.jpg',
          time: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours
          location: 'Conference Center',
          attendeeCount: 25,
        },
        hoursUntil: 20,
        reminderType: 'upcoming',
      }
    },
    {
      type: 'memory_created',
      title: 'Memory Created',
      description: 'Shows when someone creates a memory',
      data: {
        memory: {
          title: 'Beach Trip 2024',
          description: 'Amazing day at the beach',
          photoCount: 12,
        },
        event: {
          title: 'Beach Day',
          time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        creator: { username: 'memorycreator', fullName: 'Memory Creator', profilePicture: null },
      }
    },
    {
      type: 'memory_photo_upload',
      title: 'Memory Photo Upload',
      description: 'Shows when someone uploads a photo to a memory',
      data: {
        photo: {
          url: '/uploads/memory-photos/new.jpg',
          caption: 'New memory photo',
          likeCount: 8,
          commentCount: 2,
        },
        memory: {
          title: 'Summer 2024',
          creator: 'user_id',
        },
        uploader: { username: 'uploader', fullName: 'Photo Uploader', profilePicture: null },
      }
    },
  ];

  const renderPostTemplate = (template) => {
    const { type, title, description, data } = template;

    return (
      <View key={type} style={styles.postContainer}>
        <View style={styles.postHeader}>
          <View style={styles.postTypeBadge}>
            <Text style={styles.postTypeText}>{type}</Text>
          </View>
          <Text style={styles.postTitle}>{title}</Text>
        </View>
        
        <Text style={styles.postDescription}>{description}</Text>
        
        <View style={styles.postContent}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
            <View>
              <Text style={styles.username}>{data.user?.username || data.commenter?.username || data.uploader?.username || 'user'}</Text>
              <Text style={styles.timestamp}>2h ago</Text>
            </View>
          </View>

          {/* Content based on type */}
          {type === 'regular_post' && (
            <>
              {data.caption && (
                <Text style={styles.caption}>{data.caption}</Text>
              )}
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={48} color="#C7C7CC" />
                <Text style={styles.placeholderText}>Photo Image</Text>
              </View>
              {data.event && (
                <View style={styles.eventBadge}>
                  <Ionicons name="calendar" size={12} color="#3797EF" />
                  <Text style={styles.eventText}>{data.event.title}</Text>
                </View>
              )}
            </>
          )}

          {type === 'text_post' && (
            <Text style={styles.textContent}>{data.textContent || data.caption}</Text>
          )}

          {type === 'text_photo_post' && (
            <>
              <Text style={styles.caption}>{data.caption}</Text>
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={48} color="#C7C7CC" />
                <Text style={styles.placeholderText}>Photo Image</Text>
              </View>
            </>
          )}

          {type === 'review_post' && (
            <>
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewPoster}>
                    <Ionicons name="film" size={24} color="#8E8E93" />
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewTitle}>{data.review.title}</Text>
                    <Text style={styles.reviewSubtitle}>{data.review.artist} • {data.review.year}</Text>
                    <View style={styles.ratingContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= data.review.rating ? "star" : "star-outline"}
                          size={16}
                          color={star <= data.review.rating ? "#FFD700" : "#C7C7CC"}
                        />
                      ))}
                      <Text style={styles.ratingText}>{data.review.rating}/5</Text>
                    </View>
                  </View>
                </View>
              </View>
              {data.caption && (
                <Text style={styles.caption}>{data.caption}</Text>
              )}
            </>
          )}

          {type === 'photo_comment' && (
            <>
              <View style={styles.commentActivity}>
                <Text style={styles.activityText}>
                  <Text style={styles.boldText}>{data.commenter.username}</Text> commented on{' '}
                  <Text style={styles.boldText}>{data.photoOwner.username}</Text>'s photo
                </Text>
                <Text style={styles.commentText}>"{data.comment.text}"</Text>
              </View>
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={48} color="#C7C7CC" />
                <Text style={styles.placeholderText}>Photo: {data.photo.caption}</Text>
              </View>
            </>
          )}

          {type === 'memory_post' && (
            <>
              <View style={styles.memoryBadge}>
                <Ionicons name="heart" size={14} color="#FFFFFF" />
                <Text style={styles.memoryBadgeText}>Memory: {data.memoryInfo?.memoryTitle}</Text>
              </View>
              {data.caption && (
                <Text style={styles.caption}>{data.caption}</Text>
              )}
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={48} color="#C7C7CC" />
                <Text style={styles.placeholderText}>Memory Photo</Text>
              </View>
            </>
          )}

          {type === 'memory_photo_comment' && (
            <>
              <View style={styles.commentActivity}>
                <Text style={styles.activityText}>
                  <Text style={styles.boldText}>{data.commenter.username}</Text> commented on a photo in{' '}
                  <Text style={styles.boldText}>{data.memory.title}</Text>
                </Text>
                <Text style={styles.commentText}>"{data.comment.text}"</Text>
              </View>
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={48} color="#C7C7CC" />
                <Text style={styles.placeholderText}>Memory Photo</Text>
              </View>
            </>
          )}

          {type === 'event_invitation' && (
            <View style={styles.eventCard}>
              <View style={styles.eventImagePlaceholder}>
                <Ionicons name="calendar" size={48} color="#C7C7CC" />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{data.event.title}</Text>
                <Text style={styles.eventTime}>
                  {new Date(data.event.time).toLocaleDateString()}
                </Text>
                <Text style={styles.invitationText}>
                  <Text style={styles.boldText}>{data.invitedBy.username}</Text> invited you
                </Text>
              </View>
            </View>
          )}

          {type === 'friend_event_join' && (
            <View style={styles.eventCard}>
              <View style={styles.eventImagePlaceholder}>
                <Ionicons name="calendar" size={48} color="#C7C7CC" />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{data.event.title}</Text>
                <Text style={styles.activityText}>
                  {data.friends.map(f => f.username).join(', ')} {data.groupCount > 1 ? 'are' : 'is'} going
                </Text>
              </View>
            </View>
          )}

          {type === 'event_created' && (
            <View style={styles.eventCard}>
              <View style={styles.eventImagePlaceholder}>
                <Ionicons name="calendar" size={48} color="#C7C7CC" />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{data.event.title}</Text>
                <Text style={styles.eventDescription}>{data.event.description}</Text>
                <Text style={styles.activityText}>
                  <Text style={styles.boldText}>{data.user.username}</Text> created this event
                </Text>
              </View>
            </View>
          )}

          {type === 'event_reminder' && (
            <View style={styles.reminderCard}>
              <Ionicons name="time" size={24} color="#FF6B6B" />
              <View style={styles.reminderInfo}>
                <Text style={styles.reminderTitle}>{data.event.title}</Text>
                <Text style={styles.reminderTime}>
                  Starts in {data.hoursUntil} hours
                </Text>
              </View>
            </View>
          )}

          {type === 'memory_created' && (
            <View style={styles.memoryCard}>
              <Ionicons name="heart" size={24} color="#FF69B4" />
              <View style={styles.memoryInfo}>
                <Text style={styles.memoryTitle}>{data.memory.title}</Text>
                <Text style={styles.memoryDescription}>{data.memory.description}</Text>
                <Text style={styles.activityText}>
                  <Text style={styles.boldText}>{data.creator.username}</Text> created this memory
                </Text>
              </View>
            </View>
          )}

          {type === 'memory_photo_upload' && (
            <>
              <View style={styles.activityText}>
                <Text style={styles.boldText}>{data.uploader.username}</Text> added a photo to{' '}
                <Text style={styles.boldText}>{data.memory.title}</Text>
              </View>
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={48} color="#C7C7CC" />
                <Text style={styles.placeholderText}>Memory Photo</Text>
              </View>
            </>
          )}

          {/* Engagement metrics */}
          {(type === 'regular_post' || type === 'text_post' || type === 'text_photo_post' || 
            type === 'review_post' || type === 'memory_post') && (
            <View style={styles.engagementRow}>
              <View style={styles.engagementItem}>
                <Ionicons 
                  name={data.userLiked ? "heart" : "heart-outline"} 
                  size={20} 
                  color={data.userLiked ? "#FF6B6B" : "#8E8E93"} 
                />
                <Text style={styles.engagementText}>{data.likeCount}</Text>
              </View>
              <View style={styles.engagementItem}>
                <Ionicons name="chatbubble-outline" size={20} color="#8E8E93" />
                <Text style={styles.engagementText}>{data.commentCount}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed Post Types Template</Text>
        <Text style={styles.headerSubtitle}>
          This screen shows all post types that can appear in feeds
        </Text>
      </View>

      {templatePosts.map(renderPostTemplate)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postTypeBadge: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  postTypeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  postDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  postContent: {
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    paddingTop: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  caption: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1C1C1E',
    marginBottom: 12,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1C1C1E',
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: SCREEN_WIDTH - 64,
    height: 200,
    backgroundColor: '#F6F6F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  eventText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },
  reviewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
  },
  reviewPoster: {
    width: 60,
    height: 90,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 8,
    fontWeight: '600',
  },
  commentActivity: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  activityText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '600',
  },
  commentText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF69B4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  memoryBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  eventImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#E1E1E1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
  },
  invitationText: {
    fontSize: 14,
    color: '#3797EF',
    marginTop: 4,
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  reminderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  reminderTime: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  memoryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF0F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  memoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  memoryDescription: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  engagementText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 6,
    fontWeight: '500',
  },
});


