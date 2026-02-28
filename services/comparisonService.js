const { getDistance } = require('geolib');

class ComparisonService {
  /**
   * Compare mandi prices and find the best rates
   * @param {Array} prices - Array of price records
   * @param {Object} options - Comparison options
   * @returns {Object} Comparison results with best rates
   */
  comparePrices(prices, options = {}) {
    if (!prices || prices.length === 0) {
      return {
        success: false,
        message: 'No price data available for comparison',
        results: []
      };
    }

    const sortBy = options.sortBy || 'modalPrice'; // modalPrice, maxPrice, minPrice
    const order = options.order || 'desc'; // desc for highest price, asc for lowest
    const isAverageData = prices.length > 0 && prices[0].isAverage;

    // Sort prices
    const sortedPrices = [...prices].sort((a, b) => {
      const priceA = a[sortBy] || a.modalPrice;
      const priceB = b[sortBy] || b.modalPrice;
      return order === 'desc' ? priceB - priceA : priceA - priceB;
    });

    // Calculate statistics
    const modalPrices = prices.map(p => p.modalPrice).filter(p => p > 0);
    const stats = {
      averagePrice: this.calculateAverage(modalPrices),
      highestPrice: Math.max(...modalPrices),
      lowestPrice: Math.min(...modalPrices),
      totalMarkets: prices.length,
      priceRange: Math.max(...modalPrices) - Math.min(...modalPrices),
      calculationMethod: isAverageData ? '7-day average' : 'Latest price'
    };

    // Identify best options
    const bestRate = sortedPrices[0];
    const topFive = sortedPrices.slice(0, 5);

    return {
      success: true,
      bestMandi: {
        market: bestRate.market,
        district: bestRate.district,
        state: bestRate.state,
        price: bestRate.modalPrice,
        minPrice: bestRate.minPrice,
        maxPrice: bestRate.maxPrice,
        variety: bestRate.variety,
        grade: bestRate.grade,
        arrivalDate: bestRate.arrivalDate,
        advantage: `₹${(bestRate.modalPrice - stats.averagePrice).toFixed(2)} above average`,
        daysOfData: bestRate.daysOfData || 1,
        dateRange: bestRate.dateRange || bestRate.arrivalDate,
        priceType: bestRate.isAverage ? '7-day average' : 'Latest price'
      },
      topFiveMarkets: topFive.map((price, index) => ({
        rank: index + 1,
        market: price.market,
        district: price.district,
        state: price.state,
        price: price.modalPrice,
        priceRange: `₹${price.minPrice} - ₹${price.maxPrice}`,
        variety: price.variety,
        arrivalDate: price.arrivalDate
      })),
      statistics: stats,
      allResults: sortedPrices.map(price => ({
        market: price.market,
        district: price.district,
        state: price.state,
        price: price.modalPrice,
        variety: price.variety,
        arrivalDate: price.arrivalDate
      }))
    };
  }

  /**
   * Filter mandis by distance from farmer's location
   * @param {Array} prices - Array of price records with location data
   * @param {Object} farmerLocation - Farmer's coordinates {latitude, longitude}
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Array} Filtered prices within radius
   */
  filterByDistance(prices, farmerLocation, radiusKm = 100) {
    if (!farmerLocation || !farmerLocation.latitude || !farmerLocation.longitude) {
      console.warn('Farmer location not provided, skipping distance filter');
      return prices;
    }

    return prices.filter(price => {
      // If price doesn't have location data, include it by default
      if (!price.latitude || !price.longitude) {
        return true;
      }

      const distance = getDistance(
        { latitude: farmerLocation.latitude, longitude: farmerLocation.longitude },
        { latitude: price.latitude, longitude: price.longitude }
      );

      const distanceKm = distance / 1000;
      price.distanceKm = Math.round(distanceKm * 10) / 10;
      
      return distanceKm <= radiusKm;
    });
  }

  /**
   * Get recommendations based on various factors
   * @param {Array} prices - Array of price records
   * @param {Object} preferences - Farmer's preferences
   * @returns {Object} Recommendations
   */
  getRecommendations(prices, preferences = {}) {
    if (!prices || prices.length === 0) {
      return {
        success: false,
        message: 'No data available for recommendations'
      };
    }

    const recommendations = [];

    // Highest price recommendation
    const highestPrice = [...prices].sort((a, b) => b.modalPrice - a.modalPrice)[0];
    recommendations.push({
      type: 'BEST_PRICE',
      priority: 'HIGH',
      market: highestPrice.market,
      district: highestPrice.district,
      state: highestPrice.state,
      price: highestPrice.modalPrice,
      reason: `Offers the highest price of ₹${highestPrice.modalPrice} per quintal`,
      variety: highestPrice.variety,
      arrivalDate: highestPrice.arrivalDate
    });

    // Most consistent pricing (smallest range between min and max)
    const mostConsistent = [...prices]
      .filter(p => p.minPrice > 0 && p.maxPrice > 0)
      .sort((a, b) => {
        const rangeA = a.maxPrice - a.minPrice;
        const rangeB = b.maxPrice - b.minPrice;
        return rangeA - rangeB;
      })[0];

    if (mostConsistent) {
      recommendations.push({
        type: 'MOST_STABLE',
        priority: 'MEDIUM',
        market: mostConsistent.market,
        district: mostConsistent.district,
        state: mostConsistent.state,
        price: mostConsistent.modalPrice,
        priceRange: `₹${mostConsistent.minPrice} - ₹${mostConsistent.maxPrice}`,
        reason: `Most stable pricing with narrow range of ₹${(mostConsistent.maxPrice - mostConsistent.minPrice).toFixed(2)}`,
        variety: mostConsistent.variety
      });
    }

    // If distance data is available, recommend nearest with good price
    const pricesWithDistance = prices.filter(p => p.distanceKm !== undefined);
    if (pricesWithDistance.length > 0) {
      const nearestGoodPrice = pricesWithDistance
        .filter(p => p.modalPrice >= this.calculateAverage(prices.map(x => x.modalPrice)))
        .sort((a, b) => a.distanceKm - b.distanceKm)[0];

      if (nearestGoodPrice) {
        recommendations.push({
          type: 'NEAREST_GOOD_PRICE',
          priority: 'MEDIUM',
          market: nearestGoodPrice.market,
          district: nearestGoodPrice.district,
          state: nearestGoodPrice.state,
          price: nearestGoodPrice.modalPrice,
          distance: `${nearestGoodPrice.distanceKm} km`,
          reason: `Nearest market with above-average price (${nearestGoodPrice.distanceKm} km away)`,
          variety: nearestGoodPrice.variety
        });
      }
    }

    return {
      success: true,
      recommendations,
      summary: `Found ${recommendations.length} recommendations from ${prices.length} markets`
    };
  }

  /**
   * Compare multiple commodities across mandis
   * @param {Object} pricesByComm - Object with commodity names as keys and price arrays as values
   * @returns {Object} Multi-commodity comparison
   */
  compareMultipleCommodities(pricesByCommodity) {
    const results = {};

    Object.keys(pricesByCommodity).forEach(commodity => {
      const prices = pricesByCommodity[commodity];
      results[commodity] = this.comparePrices(prices);
    });

    return {
      success: true,
      commodities: Object.keys(results),
      results
    };
  }

  /**
   * Calculate average of an array of numbers
   * @param {Array} numbers - Array of numbers
   * @returns {number} Average value
   */
  calculateAverage(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / numbers.length) * 100) / 100;
  }

  /**
   * Calculate price trend (if historical data available)
   * @param {Array} prices - Array of price records with dates
   * @returns {Object} Trend analysis
   */
  analyzeTrend(prices) {
    if (!prices || prices.length < 2) {
      return { trend: 'INSUFFICIENT_DATA' };
    }

    // Sort by date
    const sorted = [...prices].sort((a, b) => 
      new Date(a.arrivalDate) - new Date(b.arrivalDate)
    );

    const firstPrice = sorted[0].modalPrice;
    const lastPrice = sorted[sorted.length - 1].modalPrice;
    const change = lastPrice - firstPrice;
    const percentChange = (change / firstPrice) * 100;

    return {
      trend: change > 0 ? 'INCREASING' : change < 0 ? 'DECREASING' : 'STABLE',
      change: Math.round(change * 100) / 100,
      percentChange: Math.round(percentChange * 100) / 100,
      firstDate: sorted[0].arrivalDate,
      lastDate: sorted[sorted.length - 1].arrivalDate,
      firstPrice,
      lastPrice
    };
  }
}

module.exports = new ComparisonService();
