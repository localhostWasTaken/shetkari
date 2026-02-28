# 🚀 Quick Start Guide - Mandi Rate Comparison API

## Get Started in 3 Steps

### Step 1: Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### Step 2: Test the API
Open your browser or use curl:

**Browser:**
```
http://localhost:3000/api/best-rates?commodity=Wheat&state=Punjab
```

**Or using curl:**
```bash
curl "http://localhost:3000/api/best-rates?commodity=Wheat&state=Punjab"
```

### Step 3: See the Results
You'll get a response showing:
- Best mandi with highest price
- Top 5 markets comparison
- Price statistics
- Recommendations

---

## 📱 Quick Examples

### Find Best Price for Your Crop
```bash
# Replace "Wheat" with your crop and "Punjab" with your state
curl "http://localhost:3000/api/best-rates?commodity=Wheat&state=Punjab"
```

### Find Nearby Mandis
```bash
# Replace coordinates with your location
curl "http://localhost:3000/api/nearby-mandis?latitude=30.9010&longitude=75.8573&radiusKm=50"
```

### See All Available Crops
```bash
curl "http://localhost:3000/api/commodities"
```

---

## 🧪 Run Test Suite
```bash
node test.js
```

This will test all API endpoints automatically.

---

## 🛑 Stop the Server
Press `Ctrl + C` in the terminal where server is running

---

## 📚 Full Documentation
See [README.md](README.md) for complete documentation

---

## 🆘 Quick Troubleshooting

**Port already in use?**
- Edit `.env` file and change `PORT=3000` to another port like `3001`

**No data found?**
- Try common commodity names: Wheat, Rice, Cotton, Gram, Potato
- Check available commodities: `/api/commodities`

**Server not starting?**
- Make sure you ran `npm install`
- Check if port 3000 is available

---

## 📊 Common Commodities to Try

✅ Grains: Wheat, Rice, Maize, Bajra
✅ Pulses: Gram, Tur, Moong, Urad
✅ Cotton: Cotton
✅ Vegetables: Potato, Onion, Tomato
✅ Oilseeds: Groundnut, Soyabean, Mustard

---

**Need help?** Check the full [README.md](README.md) or [EXAMPLES.md](EXAMPLES.md)
