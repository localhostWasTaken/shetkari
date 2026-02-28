require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config/api.config');
const mandiRoutes = require('./routes/mandi.routes');

const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve webpage static files
app.use(express.static(path.join(__dirname, 'webpage')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root endpoint - serve the webpage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'webpage', 'index.html'));
});

// API routes
app.use('/api', mandiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: '/api/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Mandi Rate Comparison API Server Started`);
  console.log('='.repeat(50));
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🔑 API Key configured: ${config.apiKey ? 'Yes' : 'No'}`);
  console.log(`📊 Base URL: ${config.baseUrl}`);
  console.log('='.repeat(50));
  console.log('\n📚 Available Endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/best-rates`);
  console.log(`   POST http://localhost:${PORT}/api/compare`);
  console.log(`   GET  http://localhost:${PORT}/api/commodities`);
  console.log(`   GET  http://localhost:${PORT}/api/states`);
  console.log(`   GET  http://localhost:${PORT}/api/districts`);
  console.log(`   GET  http://localhost:${PORT}/api/markets`);
  console.log(`   GET  http://localhost:${PORT}/api/nearby-mandis`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log('\n💡 Example Request:');
  console.log(`   curl "http://localhost:${PORT}/api/best-rates?commodity=Wheat&state=Punjab"`);
  console.log('='.repeat(50));
});

module.exports = app;
