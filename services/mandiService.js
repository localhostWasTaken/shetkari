const axios = require('axios');
const config = require('../config/api.config');

class MandiService {
  constructor() {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.resourceId = config.mandiResourceId;
  }

  /**
   * Fetch mandi prices from data.gov.in API
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array>} Array of mandi price records
   */
  async getMandiPrices(filters = {}) {
    try {
      const params = {
        'api-key': this.apiKey,
        format: 'json',
        limit: filters.limit || 1000,
        offset: filters.offset || 0
      };

      // Add optional filters
      if (filters.state) params['filters[state]'] = filters.state;
      if (filters.district) params['filters[district]'] = filters.district;
      if (filters.market) params['filters[market]'] = filters.market;
      if (filters.commodity) params['filters[commodity]'] = filters.commodity;
      if (filters.variety) params['filters[variety]'] = filters.variety;
      if (filters.arrival_date) params['filters[arrival_date]'] = filters.arrival_date;

      const url = `${this.baseUrl}/${this.resourceId}`;
      
      console.log(`Fetching data from: ${url}`);
      
      const response = await axios.get(url, {
        params,
        timeout: config.requestConfig.timeout,
        headers: config.requestConfig.headers
      });

      if (response.data && response.data.records) {
        return response.data.records;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }

      return [];
    } catch (error) {
      console.error('Error fetching mandi prices:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to fetch mandi prices: ${error.message}`);
    }
  }

  /**
   * Get unique states from the API
   * @returns {Promise<Array>} Array of unique states
   */
  async getStates() {
    try {
      const records = await this.getMandiPrices({ limit: 10000 });
      const states = [...new Set(records.map(r => r.state))].filter(Boolean).sort();
      return states;
    } catch (error) {
      console.error('Error fetching states:', error.message);
      throw error;
    }
  }

  /**
   * Get districts for a specific state
   * @param {string} state - State name
   * @returns {Promise<Array>} Array of districts
   */
  async getDistricts(state) {
    try {
      const records = await this.getMandiPrices({ state, limit: 5000 });
      const districts = [...new Set(records.map(r => r.district))].filter(Boolean).sort();
      return districts;
    } catch (error) {
      console.error('Error fetching districts:', error.message);
      throw error;
    }
  }

  /**
   * Get markets for a specific district
   * @param {string} state - State name
   * @param {string} district - District name
   * @returns {Promise<Array>} Array of markets
   */
  async getMarkets(state, district) {
    try {
      const records = await this.getMandiPrices({ state, district, limit: 5000 });
      const markets = [...new Set(records.map(r => r.market))].filter(Boolean).sort();
      return markets;
    } catch (error) {
      console.error('Error fetching markets:', error.message);
      throw error;
    }
  }

  /**
   * Get available commodities
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of commodities
   */
  async getCommodities(filters = {}) {
    try {
      const records = await this.getMandiPrices({ ...filters, limit: 10000 });
      const commodities = [...new Set(records.map(r => r.commodity))].filter(Boolean).sort();
      return commodities;
    } catch (error) {
      console.error('Error fetching commodities:', error.message);
      throw error;
    }
  }

  /**
   * Get prices for a specific commodity in a region
   * @param {string} commodity - Commodity name
   * @param {Object} location - Location filters (state, district, market)
   * @returns {Promise<Array>} Array of price records
   */
  async getCommodityPrices(commodity, location = {}) {
    try {
      const filters = {
        commodity,
        ...location,
        limit: 1000
      };
      
      const records = await this.getMandiPrices(filters);
      
      // Parse and normalize price data
      return records.map(record => ({
        state: record.state,
        district: record.district,
        market: record.market,
        commodity: record.commodity,
        variety: record.variety,
        grade: record.grade,
        minPrice: this.parsePrice(record.min_price),
        maxPrice: this.parsePrice(record.max_price),
        modalPrice: this.parsePrice(record.modal_price),
        arrivalDate: record.arrival_date,
        rawRecord: record
      })).filter(record => record.modalPrice > 0);
    } catch (error) {
      console.error('Error fetching commodity prices:', error.message);
      throw error;
    }
  }

  /**
   * Parse price string to number
   * @param {string|number} priceStr - Price as string or number
   * @returns {number} Parsed price
   */
  parsePrice(priceStr) {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;
    
    const cleaned = String(priceStr).replace(/[^\d.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  /**
   * Get latest prices (most recent arrival_date)
   * @param {Array} prices - Array of price records
   * @returns {Array} Filtered latest prices
   */
  getLatestPrices(prices) {
    if (!prices || prices.length === 0) return [];

    // Group by market
    const marketGroups = {};
    prices.forEach(price => {
      const key = `${price.market}_${price.commodity}_${price.variety || 'NA'}`;
      if (!marketGroups[key] || new Date(price.arrivalDate) > new Date(marketGroups[key].arrivalDate)) {
        marketGroups[key] = price;
      }
    });

    return Object.values(marketGroups);
  }

  /**
   * Calculate 7-day average prices for each mandi
   * @param {Array} prices - Array of price records
   * @returns {Array} Array with 7-day average prices per mandi
   */
  get7DayAveragePrices(prices) {
    if (!prices || prices.length === 0) return [];

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Filter prices from last 7 days
    const recentPrices = prices.filter(price => {
      const arrivalDate = new Date(price.arrivalDate);
      return arrivalDate >= sevenDaysAgo && arrivalDate <= today;
    });

    if (recentPrices.length === 0) {
      console.log('No data found in last 7 days, using all available data');
      return this.getLatestPrices(prices);
    }

    // Group by market
    const marketGroups = {};
    recentPrices.forEach(price => {
      const key = `${price.market}_${price.district}_${price.state}_${price.commodity}_${price.variety || 'NA'}`;
      if (!marketGroups[key]) {
        marketGroups[key] = {
          market: price.market,
          district: price.district,
          state: price.state,
          commodity: price.commodity,
          variety: price.variety,
          grade: price.grade,
          prices: [],
          dates: []
        };
      }
      marketGroups[key].prices.push({
        modal: price.modalPrice,
        min: price.minPrice,
        max: price.maxPrice,
        date: price.arrivalDate
      });
      marketGroups[key].dates.push(price.arrivalDate);
    });

    // Calculate averages for each market
    const averagedPrices = Object.values(marketGroups).map(group => {
      const modalPrices = group.prices.map(p => p.modal).filter(p => p > 0);
      const minPrices = group.prices.map(p => p.min).filter(p => p > 0);
      const maxPrices = group.prices.map(p => p.max).filter(p => p > 0);

      const avgModal = modalPrices.length > 0 
        ? Math.round((modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length) * 100) / 100
        : 0;
      const avgMin = minPrices.length > 0
        ? Math.round((minPrices.reduce((a, b) => a + b, 0) / minPrices.length) * 100) / 100
        : 0;
      const avgMax = maxPrices.length > 0
        ? Math.round((maxPrices.reduce((a, b) => a + b, 0) / maxPrices.length) * 100) / 100
        : 0;

      // Sort dates to get most recent
      const sortedDates = group.dates.sort((a, b) => new Date(b) - new Date(a));

      return {
        market: group.market,
        district: group.district,
        state: group.state,
        commodity: group.commodity,
        variety: group.variety,
        grade: group.grade,
        modalPrice: avgModal,
        minPrice: avgMin,
        maxPrice: avgMax,
        arrivalDate: sortedDates[0], // Most recent date
        daysOfData: group.prices.length,
        dateRange: `${sortedDates[sortedDates.length - 1]} to ${sortedDates[0]}`,
        isAverage: true,
        averagePeriod: '7 days'
      };
    }).filter(record => record.modalPrice > 0);

    console.log(`Calculated 7-day averages for ${averagedPrices.length} markets (from ${recentPrices.length} price records)`);

    return averagedPrices;
  }
}

module.exports = new MandiService();
