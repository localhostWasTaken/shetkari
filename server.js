require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config/api.config');
const mandiRoutes = require('./routes/mandi.routes');

const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mandi Rate Comparison API',
    version: '1.0.0',
    description: 'API to fetch and compare mandi rates from data.gov.in for farmers',
    documentation: '/api/health',
    endpoints: {
      bestRates: 'GET /api/best-rates?commodity=<name>&state=<state>&district=<district>',
      compare: 'POST /api/compare',
      commodities: 'GET /api/commodities',
      states: 'GET /api/states',
      districts: 'GET /api/districts?state=<state>',
      markets: 'GET /api/markets?state=<state>&district=<district>',
      nearbyMandis: 'GET /api/nearby-mandis?latitude=<lat>&longitude=<lng>&radiusKm=<radius>',
      health: 'GET /api/health'
    },
    examples: {
      getBestRates: '/api/best-rates?commodity=Wheat&state=Punjab',
      getBestRatesWithLocation: '/api/best-rates?commodity=Rice&state=Punjab&district=Ludhiana&latitude=30.9010&longitude=75.8573&radiusKm=50',
      getCommodities: '/api/commodities?state=Punjab',
      getStates: '/api/states',
      getDistricts: '/api/districts?state=Punjab',
      getMarkets: '/api/markets?state=Punjab&district=Ludhiana'
    }
  });
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
