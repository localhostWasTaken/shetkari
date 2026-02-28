const { getDistance } = require('geolib');

// Sample coordinates for major Indian cities and districts (for demonstration)
// In production, you would use a proper geocoding service or database
const locationDatabase = {
  // Format: 'State:District': { latitude, longitude }
  'Maharashtra:Pune': { latitude: 18.5204, longitude: 73.8567 },
  'Maharashtra:Mumbai': { latitude: 19.0760, longitude: 72.8777 },
  'Maharashtra:Nagpur': { latitude: 21.1458, longitude: 79.0882 },
  'Karnataka:Bangalore': { latitude: 12.9716, longitude: 77.5946 },
  'Karnataka:Mysore': { latitude: 12.2958, longitude: 76.6394 },
  'Tamil Nadu:Chennai': { latitude: 13.0827, longitude: 80.2707 },
  'Tamil Nadu:Coimbatore': { latitude: 11.0168, longitude: 76.9558 },
  'Gujarat:Ahmedabad': { latitude: 23.0225, longitude: 72.5714 },
  'Gujarat:Surat': { latitude: 21.1702, longitude: 72.8311 },
  'Rajasthan:Jaipur': { latitude: 26.9124, longitude: 75.7873 },
  'Uttar Pradesh:Lucknow': { latitude: 26.8467, longitude: 80.9462 },
  'Uttar Pradesh:Kanpur': { latitude: 26.4499, longitude: 80.3319 },
  'Madhya Pradesh:Bhopal': { latitude: 23.2599, longitude: 77.4126 },
  'Madhya Pradesh:Indore': { latitude: 22.7196, longitude: 75.8577 },
  'Punjab:Ludhiana': { latitude: 30.9010, longitude: 75.8573 },
  'Punjab:Amritsar': { latitude: 31.6340, longitude: 74.8723 },
  'Haryana:Gurgaon': { latitude: 28.4595, longitude: 77.0266 },
  'Haryana:Faridabad': { latitude: 28.4089, longitude: 77.3178 },
  'West Bengal:Kolkata': { latitude: 22.5726, longitude: 88.3639 },
  'Telangana:Hyderabad': { latitude: 17.3850, longitude: 78.4867 },
  'Andhra Pradesh:Visakhapatnam': { latitude: 17.6868, longitude: 83.2185 }
};

class LocationService {
  /**
   * Get coordinates for a location
   * @param {string} state - State name
   * @param {string} district - District name
   * @returns {Object} Coordinates or null
   */
  getCoordinates(state, district) {
    const key = `${state}:${district}`;
    return locationDatabase[key] || null;
  }

  /**
   * Add location coordinates to price records
   * @param {Array} prices - Array of price records
   * @returns {Array} Prices with coordinates added
   */
  enrichWithCoordinates(prices) {
    return prices.map(price => {
      const coords = this.getCoordinates(price.state, price.district);
      return {
        ...price,
        latitude: coords?.latitude,
        longitude: coords?.longitude
      };
    });
  }

  /**
   * Calculate distance between two locations
   * @param {Object} location1 - First location {latitude, longitude}
   * @param {Object} location2 - Second location {latitude, longitude}
   * @returns {number} Distance in kilometers
   */
  calculateDistance(location1, location2) {
    if (!location1 || !location2 || 
        !location1.latitude || !location1.longitude ||
        !location2.latitude || !location2.longitude) {
      return null;
    }

    const distance = getDistance(
      { latitude: location1.latitude, longitude: location1.longitude },
      { latitude: location2.latitude, longitude: location2.longitude }
    );

    return Math.round((distance / 1000) * 10) / 10; // Convert to km and round
  }

  /**
   * Find nearby markets based on coordinates
   * @param {Object} farmerLocation - Farmer's location {state, district, latitude, longitude}
   * @param {Array} prices - Array of price records
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Array} Nearby markets with distances
   */
  findNearbyMarkets(farmerLocation, prices, radiusKm = 100) {
    // If farmer location doesn't have coordinates, try to get them
    let farmerCoords = {
      latitude: farmerLocation.latitude,
      longitude: farmerLocation.longitude
    };

    if (!farmerCoords.latitude && farmerLocation.state && farmerLocation.district) {
      const coords = this.getCoordinates(farmerLocation.state, farmerLocation.district);
      if (coords) {
        farmerCoords = coords;
      }
    }

    // If still no coordinates, return all prices (unable to filter by distance)
    if (!farmerCoords.latitude || !farmerCoords.longitude) {
      console.warn('Unable to determine farmer location coordinates');
      return prices.map(p => ({ ...p, distance: null }));
    }

    // Enrich prices with coordinates
    const enrichedPrices = this.enrichWithCoordinates(prices);

    // Calculate distances and filter
    const marketsWithDistance = enrichedPrices
      .map(price => {
        if (price.latitude && price.longitude) {
          const distance = this.calculateDistance(farmerCoords, {
            latitude: price.latitude,
            longitude: price.longitude
          });
          return { ...price, distanceKm: distance };
        }
        return { ...price, distanceKm: null };
      })
      .filter(price => price.distanceKm === null || price.distanceKm <= radiusKm)
      .sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });

    return marketsWithDistance;
  }

  /**
   * Group markets by proximity zones
   * @param {Array} prices - Array of price records with distances
   * @returns {Object} Markets grouped by distance zones
   */
  groupByProximity(prices) {
    const zones = {
      veryClose: [], // 0-25 km
      nearby: [],    // 25-50 km
      moderate: [],  // 50-100 km
      far: []        // 100+ km
    };

    prices.forEach(price => {
      if (price.distanceKm === null || price.distanceKm === undefined) {
        zones.far.push(price);
      } else if (price.distanceKm <= 25) {
        zones.veryClose.push(price);
      } else if (price.distanceKm <= 50) {
        zones.nearby.push(price);
      } else if (price.distanceKm <= 100) {
        zones.moderate.push(price);
      } else {
        zones.far.push(price);
      }
    });

    return zones;
  }

  /**
   * Get all available locations from database
   * @returns {Array} Array of locations with coordinates
   */
  getAvailableLocations() {
    return Object.keys(locationDatabase).map(key => {
      const [state, district] = key.split(':');
      return {
        state,
        district,
        ...locationDatabase[key]
      };
    });
  }

  /**
   * Add a new location to the database (for extending coverage)
   * @param {string} state - State name
   * @param {string} district - District name
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   */
  addLocation(state, district, latitude, longitude) {
    const key = `${state}:${district}`;
    locationDatabase[key] = { latitude, longitude };
  }
}

module.exports = new LocationService();
