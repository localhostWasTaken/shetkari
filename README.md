# Mandi Rate Comparison API

A comprehensive API system to help farmers find the best mandi (agricultural market) rates for their crops using data from data.gov.in.

## 🌾 Features

- **Best Rate Finder**: Get the best mandi rates for any commodity near your location
- **Multi-Mandi Comparison**: Compare prices across multiple mandis
- **Location-Based Search**: Find nearby mandis within a specified radius
- **Price Analytics**: Get statistics, trends, and recommendations
- **Multi-Commodity Support**: Compare rates for multiple crops at once
- **Real-Time Data**: Fetches latest data from data.gov.in API

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- API key from data.gov.in (already configured)

## 🚀 Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   The `.env` file is already configured with your data.gov.in API key.

3. **Start the Server**
   ```bash
   # Production mode
   npm start

   # Development mode with auto-reload
   npm run dev
   ```

4. **Verify Installation**
   Open your browser and visit: `http://localhost:3000`

## 📚 API Endpoints

### 1. Get Best Rates (Main Endpoint for Farmers)

Find the best mandi rates for a specific crop.

**Endpoint:** `GET /api/best-rates`

**Query Parameters:**
- `commodity` (required): Name of the crop (e.g., Wheat, Rice, Cotton)
- `state` (optional): State name
- `district` (optional): District name
- `variety` (optional): Variety of the crop
- `latitude` (optional): Farmer's latitude for distance calculation
- `longitude` (optional): Farmer's longitude for distance calculation
- `radiusKm` (optional): Search radius in kilometers (default: 100)

**Example Requests:**
```bash
# Basic search for wheat in Punjab
curl "http://localhost:3000/api/best-rates?commodity=Wheat&state=Punjab"

# Search with location and radius
curl "http://localhost:3000/api/best-rates?commodity=Rice&state=Punjab&district=Ludhiana&latitude=30.9010&longitude=75.8573&radiusKm=50"

# Search for specific variety
curl "http://localhost:3000/api/best-rates?commodity=Cotton&state=Gujarat&variety=Shankar"
```

**Response:**
```json
{
  "success": true,
  "commodity": "Wheat",
  "location": {
    "state": "Punjab",
    "district": "Ludhiana"
  },
  "bestMandi": {
    "market": "Ludhiana",
    "district": "Ludhiana",
    "state": "Punjab",
    "price": 2050,
    "minPrice": 2000,
    "maxPrice": 2100,
    "variety": "PBW 343",
    "arrivalDate": "2026-02-25",
    "advantage": "₹150.00 above average"
  },
  "topMarkets": [
    {
      "rank": 1,
      "market": "Ludhiana",
      "price": 2050,
      "priceRange": "₹2000 - ₹2100"
    }
  ],
  "recommendations": [
    {
      "type": "BEST_PRICE",
      "priority": "HIGH",
      "market": "Ludhiana",
      "price": 2050,
      "reason": "Offers the highest price of ₹2050 per quintal"
    }
  ],
  "statistics": {
    "averagePrice": 1900,
    "highestPrice": 2050,
    "lowestPrice": 1750,
    "totalMarkets": 15,
    "priceRange": 300
  }
}
```

### 2. Compare Multiple Commodities

Compare rates for multiple crops at once.

**Endpoint:** `POST /api/compare`

**Request Body:**
```json
{
  "commodities": ["Wheat", "Rice", "Maize"],
  "state": "Punjab",
  "district": "Ludhiana"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{"commodities": ["Wheat", "Rice"], "state": "Punjab"}'
```

### 3. Get Available Commodities

Get list of all available commodities.

**Endpoint:** `GET /api/commodities`

**Query Parameters:**
- `state` (optional): Filter by state
- `district` (optional): Filter by district

**Example:**
```bash
curl "http://localhost:3000/api/commodities?state=Punjab"
```

### 4. Get States

Get list of all available states.

**Endpoint:** `GET /api/states`

**Example:**
```bash
curl "http://localhost:3000/api/states"
```

### 5. Get Districts

Get districts for a specific state.

**Endpoint:** `GET /api/districts`

**Query Parameters:**
- `state` (required): State name

**Example:**
```bash
curl "http://localhost:3000/api/districts?state=Punjab"
```

### 6. Get Markets

Get markets for a specific district.

**Endpoint:** `GET /api/markets`

**Query Parameters:**
- `state` (required): State name
- `district` (required): District name

**Example:**
```bash
curl "http://localhost:3000/api/markets?state=Punjab&district=Ludhiana"
```

### 7. Get Nearby Mandis

Find mandis near a specific location.

**Endpoint:** `GET /api/nearby-mandis`

**Query Parameters:**
- `latitude` (required): Latitude
- `longitude` (required): Longitude
- `radiusKm` (optional): Search radius (default: 100)

**Example:**
```bash
curl "http://localhost:3000/api/nearby-mandis?latitude=30.9010&longitude=75.8573&radiusKm=50"
```

### 8. Health Check

Check if the API is running.

**Endpoint:** `GET /api/health`

**Example:**
```bash
curl "http://localhost:3000/api/health"
```

## 🔧 Configuration

Edit the `.env` file to configure:

```env
# Your data.gov.in API key
API_KEY=579b464db66ec23bdd000001df925d6d02884dc04c5279cba29e8659

# Server port
PORT=3000

# Search radius (km)
SEARCH_RADIUS_KM=100
```

## 📱 Usage Examples

### For Farmers

1. **Find Best Price for Your Crop:**
   ```
   Visit: http://localhost:3000/api/best-rates?commodity=Wheat&state=Punjab&district=YourDistrict
   ```

2. **Find Nearby Mandis:**
   ```
   Visit: http://localhost:3000/api/nearby-mandis?latitude=YOUR_LAT&longitude=YOUR_LNG&radiusKm=50
   ```

3. **Compare Prices for Multiple Crops:**
   ```
   POST to /api/compare with your commodities list
   ```

## 🏗️ Project Structure

```
mandi_api/
├── config/
│   └── api.config.js          # API configuration
├── controllers/
│   └── mandiController.js     # Request handlers
├── routes/
│   └── mandi.routes.js        # API routes
├── services/
│   ├── mandiService.js        # Data.gov.in API integration
│   ├── comparisonService.js   # Price comparison logic
│   └── locationService.js     # Location-based operations
├── .env                        # Environment variables
├── .gitignore                  # Git ignore file
├── package.json                # Dependencies
├── server.js                   # Main server file
└── README.md                   # Documentation
```

## 🔑 API Key Information

Your data.gov.in API key is already configured in the `.env` file:
- API Key: `579b464db66ec23bdd000001df925d6d02884dc04c5279cba29e8659`
- Resource ID: `9ef84268-d588-465a-a308-a864a43d0070` (Mandi Prices)

## 🌐 Data Source

This API uses data from:
- **Source**: data.gov.in (Government of India Open Data Portal)
- **Dataset**: Mandi Prices & Arrivals
- **Update Frequency**: Daily (by data.gov.in)

## 📊 Response Format

All responses follow this structure:

```json
{
  "success": true/false,
  "data": { /* your data */ },
  "error": "error message (if any)",
  "timestamp": "ISO timestamp"
}
```

## 🐛 Troubleshooting

### Common Issues:

1. **"Failed to fetch mandi prices"**
   - Check your internet connection
   - Verify the API key is correct
   - Check if data.gov.in API is accessible

2. **"No price data found"**
   - Try different commodity name (e.g., "Wheat" instead of "wheat")
   - Expand search area (increase radiusKm)
   - Try without district filter

3. **Port already in use**
   - Change PORT in `.env` file
   - Or kill the process using the port

## 📈 Performance Tips

- Use specific filters (state, district) to reduce API response time
- Cache frequently accessed data
- Use the `/api/commodities` endpoint to get correct commodity names

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Check data.gov.in API status

## 📝 License

ISC

## 🙏 Acknowledgments

- Data provided by data.gov.in (Government of India)
- Built for helping farmers get better prices for their crops

---

**Note**: This system helps farmers make informed decisions by comparing rates across different mandis. Always verify rates before making final decisions.
