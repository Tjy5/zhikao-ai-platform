// Simple test for backend connectivity
const testBackend = async () => {
  try {
    console.log('Testing backend connection...');
    const response = await fetch('http://localhost:8001/health');
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
  } catch (error) {
    console.error('Backend test failed:', error);
  }
};

testBackend();