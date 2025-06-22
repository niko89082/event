const axios = require('axios');

const API_BASE = 'http://localhost:3000/api'; // Adjust to your server
const authToken = 'your_jwt_token_here'; // Get from login

async function testMemoryFlow() {
  try {
    console.log('Testing memory creation...');
    
    // Create memory
    const memory = await axios.post(`${API_BASE}/memories`, {
      title: 'Test Memory',
      description: 'Testing memory creation',
      participantIds: [], // Add some user IDs here
      isPrivate: false
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Memory created:', memory.data.memory.title);
    
    // Get user memories
    const userMemories = await axios.get(`${API_BASE}/memories/user`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ User memories fetched:', userMemories.data.memories.length);
    
    console.log('🎉 Memory flow test passed!');
    
  } catch (error) {
    console.error('❌ Memory flow test failed:', error.response?.data || error.message);
  }
}

testMemoryFlow();