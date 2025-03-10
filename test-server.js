// A simplified test server to debug routing issues
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create Express app
const app = express();
const PORT = 3001; // Different port to avoid conflicts

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Basic route to confirm the server is running
app.get('/', (req, res) => {
  res.send('Test server is running!');
});

// Import one API handler directly to test
try {
  const fetchNamespacesHandler = require('./api/fetch-namespaces');
  console.log('Successfully imported fetch-namespaces.js');
  
  // Add a simple test endpoint that uses the handler
  app.post('/api/test-namespaces', fetchNamespacesHandler);
  console.log('Registered /api/test-namespaces endpoint');
  
  // Add a simple test endpoint
  app.get('/api/simple-test', (req, res) => {
    res.json({ message: 'Simple test endpoint is working' });
  });
  
} catch (error) {
  console.error('Error importing API handler:', error);
}

// Start the server
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
