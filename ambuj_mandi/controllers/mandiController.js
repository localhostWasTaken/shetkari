const mandiService = require('../services/mandiService');
const comparisonService = require('../services/comparisonService');
const locationService = require('../services/locationService');

class MandiController {
  /**
   * Get best rates for a farmer's crop
   * Main endpoint for farmers to find best mandi rates
   */
  async getBestRates(req, res) {
    try {
      const {
        commodity,
        state,
        district,
        variety,
        latitude,
        longitude,
        radiusKm = 100
      } = req.query;

      // Validate required parameters
      if (!commodity) {
        return res.status(400).json({
          success: false,
          error: 'Commodity is required'
        });
      }

      // Build location filter
      const locationFilter = {};
      if (state) locationFilter.state = state;
      if (district) locationFilter.district = district;

      // Fetch prices for the commodity
      console.log(`Fetching prices for ${commodity} in ${state || 'all states'}...`);
      let prices = await mandiService.getCommodityPrices(commodity, locationFilter);

      if (variety) {
        prices = prices.filter(p => 
          p.variety && p.variety.toLowerCase().includes(variety.toLowerCase())
        );
      }

      // Get 7-day average prices instead of just latest
      console.log('Calculating 7-day average prices...');
      prices = mandiService.get7DayAveragePrices(prices);

      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No price data found for the specified commodity and location',
          suggestions: 'Try different commodity name or expand search area'
        });
      }

      // If location coordinates provided, filter by distance
      if (latitude && longitude) {
        const farmerLocation = {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          state,
          district
        };
        
        prices = locationService.findNearbyMarkets(
          farmerLocation,
          prices,
          parseInt(radiusKm)
        );
      }

      // Compare prices and get best rates
      const comparison = comparisonService.comparePrices(prices, {
        sortBy: 'modalPrice',
        order: 'desc'
      });

      // Get recommendations
      const recommendations = comparisonService.getRecommendations(prices);

      res.json({
        success: true,
        commodity,
        location: { state, district },
        searchRadius: `${radiusKm} km`,
        calculationMethod: '7-day average prices',
        bestMandi: comparison.bestMandi,
        topMarkets: comparison.topFiveMarkets,
        recommendations: recommendations.recommendations,
        statistics: comparison.statistics,
        totalMarketsAnalyzed: prices.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in getBestRates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch and compare rates',
        message: error.message
      });
    }
  }

  /**
   * Compare rates across multiple commodities
   */
  async compareMultipleCommodities(req, res) {
    try {
      const { commodities, state, district } = req.body;

      if (!commodities || !Array.isArray(commodities) || commodities.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Commodities array is required'
        });
      }

      const locationFilter = {};
      if (state) locationFilter.state = state;
      if (district) locationFilter.district = district;

      const results = {};

      // Fetch prices for each commodity
      for (const commodity of commodities) {
        const prices = await mandiService.getCommodityPrices(commodity, locationFilter);
        const averagePrices = mandiService.get7DayAveragePrices(prices);
        results[commodity] = comparisonService.comparePrices(averagePrices);
      }

      res.json({
        success: true,
        commodities,
        location: locationFilter,
        calculationMethod: '7-day average prices',
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in compareMultipleCommodities:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare commodities',
        message: error.message
      });
    }
  }

  /**
   * Get available commodities
   */
  async getCommodities(req, res) {
    try {
      const { state, district } = req.query;
      
      const filters = {};
      if (state) filters.state = state;
      if (district) filters.district = district;

      const commodities = await mandiService.getCommodities(filters);

      res.json({
        success: true,
        commodities,
        total: commodities.length,
        filters
      });

    } catch (error) {
      console.error('Error in getCommodities:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch commodities',
        message: error.message
      });
    }
  }

  /**
   * Get available states
   */
  async getStates(req, res) {
    try {
      const states = await mandiService.getStates();

      res.json({
        success: true,
        states,
        total: states.length
      });

    } catch (error) {
      console.error('Error in getStates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch states',
        message: error.message
      });
    }
  }

  /**
   * Get districts for a state
   */
  async getDistricts(req, res) {
    try {
      const { state } = req.query;

      if (!state) {
        return res.status(400).json({
          success: false,
          error: 'State parameter is required'
        });
      }

      const districts = await mandiService.getDistricts(state);

      res.json({
        success: true,
        state,
        districts,
        total: districts.length
      });

    } catch (error) {
      console.error('Error in getDistricts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch districts',
        message: error.message
      });
    }
  }

  /**
   * Get markets for a district
   */
  async getMarkets(req, res) {
    try {
      const { state, district } = req.query;

      if (!state || !district) {
        return res.status(400).json({
          success: false,
          error: 'Both state and district parameters are required'
        });
      }

      const markets = await mandiService.getMarkets(state, district);

      res.json({
        success: true,
        state,
        district,
        markets,
        total: markets.length
      });

    } catch (error) {
      console.error('Error in getMarkets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch markets',
        message: error.message
      });
    }
  }

  /**
   * Get nearby mandis
   */
  async getNearbyMandis(req, res) {
    try {
      const {
        latitude,
        longitude,
        state,
        district,
        radiusKm = 100
      } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required'
        });
      }

      const farmerLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        state,
        district
      };

      // Get all available locations from our database
      const locations = locationService.getAvailableLocations();

      // Calculate distances
      const nearbyLocations = locations
        .map(loc => ({
          ...loc,
          distance: locationService.calculateDistance(farmerLocation, loc)
        }))
        .filter(loc => loc.distance <= parseInt(radiusKm))
        .sort((a, b) => a.distance - b.distance);

      res.json({
        success: true,
        farmerLocation: { latitude: farmerLocation.latitude, longitude: farmerLocation.longitude },
        radiusKm: parseInt(radiusKm),
        nearbyLocations,
        total: nearbyLocations.length
      });

    } catch (error) {
      console.error('Error in getNearbyMandis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to find nearby mandis',
        message: error.message
      });
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req, res) {
    res.json({
      success: true,
      status: 'healthy',
      service: 'Mandi Rate Comparison API',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new MandiController();
