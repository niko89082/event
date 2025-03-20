import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList } from 'react-native';

export default function ChatRoomScreen({ route }) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = { id: Date.now().toString(), text: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Chat Room: {conversationId}</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginVertical: 5 }}>
            <Text>{item.text}</Text>
          </View>
        )}
      />
      <TextInput
        style={{ borderWidth: 1, marginVertical: 5, padding: 8 }}
        value={input}
        onChangeText={setInput}
      />
      <Button title="Send" onPress={sendMessage} />
    </View>
  );
}