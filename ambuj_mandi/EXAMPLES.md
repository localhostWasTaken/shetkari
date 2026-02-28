# API Usage Examples

This file contains practical examples for using the Mandi Rate Comparison API.

## Example 1: Find Best Rate for Wheat in Punjab

### Request:
```bash
curl "http://localhost:3000/api/best-rates?commodity=Wheat&state=Punjab"
```

### Use Case:
A farmer in Punjab wants to know which mandi is offering the best price for wheat.

---

## Example 2: Find Best Rate with Location

### Request:
```bash
curl "http://localhost:3000/api/best-rates?commodity=Rice&state=Punjab&district=Ludhiana&latitude=30.9010&longitude=75.8573&radiusKm=50"
```

### Use Case:
A farmer in Ludhiana wants to find the best rice prices within 50km of their farm.

---

## Example 3: Compare Multiple Crops

### Request:
```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "commodities": ["Wheat", "Rice", "Maize"],
    "state": "Punjab",
    "district": "Ludhiana"
  }'
```

### Use Case:
A farmer wants to decide which crop to sell based on current market rates.

---

## Example 4: Get All Available Commodities

### Request:
```bash
curl "http://localhost:3000/api/commodities?state=Punjab"
```

### Use Case:
Check what commodities are being traded in Punjab mandis.

---

## Example 5: Find Nearby Mandis

### Request:
```bash
curl "http://localhost:3000/api/nearby-mandis?latitude=30.9010&longitude=75.8573&radiusKm=100"
```

### Use Case:
Find all mandis within 100km of a specific location.

---

## Example 6: Get Districts in a State

### Request:
```bash
curl "http://localhost:3000/api/districts?state=Maharashtra"
```

### Use Case:
Explore which districts in Maharashtra have active mandis.

---

## Example 7: Search for Specific Cotton Variety

### Request:
```bash
curl "http://localhost:3000/api/best-rates?commodity=Cotton&state=Gujarat&variety=Shankar"
```

### Use Case:
A cotton farmer wants to find the best price for a specific cotton variety.

---

## JavaScript/Node.js Example

```javascript
const axios = require('axios');

async function getBestRates(commodity, state) {
  try {
    const response = await axios.get('http://localhost:3000/api/best-rates', {
      params: {
        commodity,
        state
      }
    });
    
    console.log('Best Mandi:', response.data.bestMandi);
    console.log('Top 5 Markets:', response.data.topMarkets);
    console.log('Statistics:', response.data.statistics);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Usage
getBestRates('Wheat', 'Punjab');
```

---

## Python Example

```python
import requests

def get_best_rates(commodity, state):
    url = 'http://localhost:3000/api/best-rates'
    params = {
        'commodity': commodity,
        'state': state
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if data['success']:
        print('Best Mandi:', data['bestMandi'])
        print('Statistics:', data['statistics'])
    else:
        print('Error:', data.get('message'))

# Usage
get_best_rates('Rice', 'Punjab')
```

---

## Browser/Frontend Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Mandi Rate Finder</title>
</head>
<body>
    <h1>Find Best Mandi Rates</h1>
    
    <form id="searchForm">
        <input type="text" id="commodity" placeholder="Enter commodity (e.g., Wheat)" required>
        <input type="text" id="state" placeholder="Enter state (e.g., Punjab)">
        <button type="submit">Search</button>
    </form>
    
    <div id="results"></div>
    
    <script>
        document.getElementById('searchForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const commodity = document.getElementById('commodity').value;
            const state = document.getElementById('state').value;
            
            try {
                const response = await fetch(
                    `http://localhost:3000/api/best-rates?commodity=${commodity}&state=${state}`
                );
                const data = await response.json();
                
                if (data.success) {
                    const resultsDiv = document.getElementById('results');
                    resultsDiv.innerHTML = `
                        <h2>Best Mandi: ${data.bestMandi.market}</h2>
                        <p>Price: ₹${data.bestMandi.price} per quintal</p>
                        <p>Location: ${data.bestMandi.district}, ${data.bestMandi.state}</p>
                        <p>${data.bestMandi.advantage}</p>
                        
                        <h3>Top 5 Markets:</h3>
                        <ul>
                            ${data.topMarkets.map(m => 
                                `<li>${m.market} - ₹${m.price}</li>`
                            ).join('')}
                        </ul>
                    `;
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    </script>
</body>
</html>
```

---

## Common Commodity Names

Use these exact names for better results:

- **Grains**: Wheat, Rice, Maize, Bajra, Jowar, Ragi
- **Pulses**: Gram, Tur, Moong, Urad, Masoor, Arhar
- **Oilseeds**: Groundnut, Soyabean, Sunflower, Mustard, Sesame
- **Cotton**: Cotton, Cotton Seed
- **Fruits**: Apple, Banana, Mango, Orange, Grapes
- **Vegetables**: Potato, Onion, Tomato, Capsicum, Cabbage
- **Spices**: Turmeric, Chilli, Coriander, Jeera

---

## Response Interpretation

### Best Mandi Response:
```json
{
  "bestMandi": {
    "market": "Ludhiana",
    "price": 2050,
    "advantage": "₹150.00 above average"
  }
}
```

**Interpretation**: 
- Ludhiana mandi offers ₹2050 per quintal
- This is ₹150 more than the average price across all mandis
- The farmer should consider selling here for maximum profit

### Statistics:
```json
{
  "statistics": {
    "averagePrice": 1900,
    "highestPrice": 2050,
    "lowestPrice": 1750,
    "priceRange": 300
  }
}
```

**Interpretation**:
- Average price across all mandis: ₹1900
- Highest price available: ₹2050
- Lowest price: ₹1750
- Price variation: ₹300 (significant difference, worth shopping around!)

---

## Tips for Best Results

1. **Use Correct Commodity Names**: Check available commodities first using `/api/commodities`
2. **Specify Location**: Adding state/district filters gives more relevant results
3. **Use Coordinates**: For distance-based search, provide latitude and longitude
4. **Check Multiple Varieties**: Some crops have multiple varieties with different prices
5. **Consider Distance**: A slightly lower price nearby might be better than highest price far away
