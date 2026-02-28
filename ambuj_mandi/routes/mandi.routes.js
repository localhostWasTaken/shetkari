const express = require('express');
const router = express.Router();
const mandiController = require('../controllers/mandiController');

/**
 * @route GET /api/best-rates
 * @desc Get best rates for a commodity - Main endpoint for farmers
 * @query commodity (required) - Name of the crop
 * @query state (optional) - State name
 * @query district (optional) - District name
 * @query variety (optional) - Variety of the crop
 * @query latitude (optional) - Farmer's latitude
 * @query longitude (optional) - Farmer's longitude
 * @query radiusKm (optional) - Search radius in km (default: 100)
 */
router.get('/best-rates', mandiController.getBestRates);

/**
 * @route POST /api/compare
 * @desc Compare rates across multiple commodities
 * @body commodities (required) - Array of commodity names
 * @body state (optional) - State name
 * @body district (optional) - District name
 */
router.post('/compare', mandiController.compareMultipleCommodities);

/**
 * @route GET /api/commodities
 * @desc Get list of available commodities
 * @query state (optional) - Filter by state
 * @query district (optional) - Filter by district
 */
router.get('/commodities', mandiController.getCommodities);

/**
 * @route GET /api/states
 * @desc Get list of available states
 */
router.get('/states', mandiController.getStates);

/**
 * @route GET /api/districts
 * @desc Get districts for a state
 * @query state (required) - State name
 */
router.get('/districts', mandiController.getDistricts);

/**
 * @route GET /api/markets
 * @desc Get markets for a district
 * @query state (required) - State name
 * @query district (required) - District name
 */
router.get('/markets', mandiController.getMarkets);

/**
 * @route GET /api/nearby-mandis
 * @desc Get nearby mandis based on coordinates
 * @query latitude (required) - Latitude
 * @query longitude (required) - Longitude
 * @query radiusKm (optional) - Search radius (default: 100)
 */
router.get('/nearby-mandis', mandiController.getNearbyMandis);

/**
 * @route GET /api/health
 * @desc Health check endpoint
 */
router.get('/health', mandiController.healthCheck);

module.exports = router;
