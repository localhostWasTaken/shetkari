const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Helper function to make requests
async function makeRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

// Test 1: Health Check
async function testHealthCheck() {
  console.log('\n=== Test 1: Health Check ===');
  const result = await makeRequest('/health');
  console.log(result);
}

// Test 2: Get States
async function testGetStates() {
  console.log('\n=== Test 2: Get States ===');
  const result = await makeRequest('/states');
  console.log(`Found ${result?.total || 0} states`);
  console.log('Sample states:', result?.states?.slice(0, 5));
}

// Test 3: Get Districts
async function testGetDistricts() {
  console.log('\n=== Test 3: Get Districts (Punjab) ===');
  const result = await makeRequest('/districts', { state: 'Punjab' });
  console.log(`Found ${result?.total || 0} districts in Punjab`);
  console.log('Districts:', result?.districts?.slice(0, 5));
}

// Test 4: Get Commodities
async function testGetCommodities() {
  console.log('\n=== Test 4: Get Commodities ===');
  const result = await makeRequest('/commodities');
  console.log(`Found ${result?.total || 0} commodities`);
  console.log('Sample commodities:', result?.commodities?.slice(0, 10));
}

// Test 5: Get Best Rates for Wheat
async function testGetBestRates() {
  console.log('\n=== Test 5: Get Best Rates (Wheat) ===');
  const result = await makeRequest('/best-rates', {
    commodity: 'Wheat',
    state: 'Punjab'
  });
  
  if (result?.success) {
    console.log('Best Mandi:', result.bestMandi);
    console.log('\nTop 3 Markets:');
    result.topMarkets?.slice(0, 3).forEach(market => {
      console.log(`  ${market.rank}. ${market.market} - ₹${market.price}`);
    });
    console.log('\nStatistics:', result.statistics);
  }
}

// Test 6: Get Nearby Mandis
async function testNearbyMandis() {
  console.log('\n=== Test 6: Get Nearby Mandis (Ludhiana) ===');
  const result = await makeRequest('/nearby-mandis', {
    latitude: 30.9010,
    longitude: 75.8573,
    radiusKm: 100
  });
  
  if (result?.success) {
    console.log(`Found ${result.total} locations within 100km`);
    console.log('Nearest 5 locations:');
    result.nearbyLocations?.slice(0, 5).forEach(loc => {
      console.log(`  ${loc.district}, ${loc.state} - ${loc.distance}km away`);
    });
  }
}

// Test 7: Compare Multiple Commodities
async function testCompareMultiple() {
  console.log('\n=== Test 7: Compare Multiple Commodities ===');
  try {
    const response = await axios.post(`${BASE_URL}/compare`, {
      commodities: ['Wheat', 'Rice'],
      state: 'Punjab'
    });
    
    console.log('Comparison Results:');
    Object.keys(response.data.results || {}).forEach(commodity => {
      const data = response.data.results[commodity];
      if (data.success) {
        console.log(`\n${commodity}:`);
        console.log(`  Best price: ₹${data.bestMandi?.price}`);
        console.log(`  Market: ${data.bestMandi?.market}`);
        console.log(`  Average: ₹${data.statistics?.averagePrice}`);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('=======================================');
  console.log('   Mandi API Test Suite');
  console.log('=======================================');
  console.log('Make sure the server is running on http://localhost:3000');
  console.log('');

  await testHealthCheck();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

  await testGetStates();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testGetDistricts();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testGetCommodities();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testGetBestRates();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testNearbyMandis();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testCompareMultiple();

  console.log('\n=======================================');
  console.log('   All Tests Completed!');
  console.log('=======================================');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHealthCheck,
  testGetStates,
  testGetDistricts,
  testGetCommodities,
  testGetBestRates,
  testNearbyMandis,
  testCompareMultiple,
  runAllTests
};
