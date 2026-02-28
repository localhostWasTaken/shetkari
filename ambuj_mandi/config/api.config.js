require('dotenv').config();

module.exports = {
  apiKey: process.env.API_KEY,
  baseUrl: process.env.API_BASE_URL,
  mandiResourceId: process.env.MANDI_RESOURCE_ID,
  port: process.env.PORT || 3000,
  
  // API endpoints
  endpoints: {
    mandiPrices: '/9ef84268-d588-465a-a308-a864a43d0070'
  },
  
  // Request configuration
  requestConfig: {
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  },
  
  // Default search radius in kilometers
  searchRadiusKm: 100,
  
  // Common states and their codes (for reference)
  states: {
    'Andhra Pradesh': 'AP',
    'Telangana': 'TG',
    'Karnataka': 'KA',
    'Tamil Nadu': 'TN',
    'Maharashtra': 'MH',
    'Gujarat': 'GJ',
    'Rajasthan': 'RJ',
    'Madhya Pradesh': 'MP',
    'Uttar Pradesh': 'UP',
    'Punjab': 'PB',
    'Haryana': 'HR',
    'Bihar': 'BR',
    'West Bengal': 'WB',
    'Odisha': 'OD'
  }
};
