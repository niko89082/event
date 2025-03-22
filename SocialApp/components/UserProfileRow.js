// components/UserProfileRow.js
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { API_BASE_URL } from '@env';

// user => { _id, username, profilePicture?, ... }
// onPress => callback for tapping the row
export default function UserProfileRow({ user, onPress }) {
  if (!user) return null;

  // If we have a user.profilePicture like "/uploads/avatars/..." or similar
  let finalPath = user.profilePicture || '';
  if (finalPath && !finalPath.startsWith('/')) {
    finalPath = '/' + finalPath;
  }
  const photoUrl = finalPath ? `http://${API_BASE_URL}:3000${finalPath}` : null;

  return (
    <TouchableOpacity style={styles.rowContainer} onPress={() => onPress && onPress(user)}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar}>
          <Text style={styles.avatarInitial}>{user.username?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <Text style={styles.username}>{user.username}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 40, height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  placeholderAvatar: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
  },
});