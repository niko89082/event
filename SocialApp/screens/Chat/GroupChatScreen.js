import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';

export default function GroupChatScreen() {
  const [groupName, setGroupName] = useState('');
  const [userIds, setUserIds] = useState('');

  const createGroupChat = () => {
    const members = userIds.split(',').map(id => id.trim());
    console.log('Create group chat:', groupName, members);
    alert('Group Chat created! ' + groupName);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Create a Group Chat</Text>
      <TextInput
        placeholder="Group Name"
        value={groupName}
        onChangeText={setGroupName}
        style={{ borderWidth: 1, marginVertical: 10, padding: 8 }}
      />
      <TextInput
        placeholder="Comma-separated User IDs"
        value={userIds}
        onChangeText={setUserIds}
        style={{ borderWidth: 1, marginVertical: 10, padding: 8 }}
      />
      <Button title="Create Group" onPress={createGroupChat} />
    </View>
  );
}