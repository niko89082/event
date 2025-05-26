// components/FollowRequestItem.js

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Button } from 'react-native';
import { API_BASE_URL } from '@env';

export default function FollowRequestItem({
  sender,
  onAccept,
  onDecline,
  onPressProfile,
}) {
  if (!sender) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No sender info</Text>
      </View>
    );
  }

  // Build the profilePic URL
  let finalProfilePicPath = sender.profilePicture || '';
  if (finalProfilePicPath && !finalProfilePicPath.startsWith('/')) {
    finalProfilePicPath = '/' + finalProfilePicPath;
  }
  const senderPicUrl = finalProfilePicPath
    ? `http://${API_BASE_URL}:3000${finalProfilePicPath}`
    : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPressProfile}>
        {senderPicUrl ? (
          <Image source={{ uri: senderPicUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Text>User</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <TouchableOpacity onPress={onPressProfile}>
          <Text style={styles.username}>{sender.username}</Text>
        </TouchableOpacity>

        <View style={styles.buttonsRow}>
          <Button title="Accept" onPress={onAccept} />
          <Button title="Decline" onPress={onDecline} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    marginVertical: 4,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    marginRight: 10,
  },
  placeholderAvatar: {
    width: 50, height: 50, borderRadius: 25,
    marginRight: 10, backgroundColor: '#ccc',
    justifyContent: 'center', alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontWeight: '600',
    fontSize: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: 6,
    justifyContent: 'flex-start',
  },
  errorText: {
    color: 'red',
  },
});