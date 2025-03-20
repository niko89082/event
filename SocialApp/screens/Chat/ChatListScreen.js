import React from 'react';
import { View, Text, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function ChatListScreen() {
  const navigation = useNavigation();

  const goToGroupChat = () => {
    navigation.navigate('GroupChat');
  };

  const goToChatRoom = () => {
    navigation.navigate('ChatRoom', { conversationId: 'example' });
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Chat List</Text>
      <Button title="Go to Chat Room" onPress={goToChatRoom} />
      <Button title="Start Group Chat" onPress={goToGroupChat} />
    </View>
  );
}