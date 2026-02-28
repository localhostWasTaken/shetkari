# Shetkari 

A smart farming assistant WhatsApp chatbot that helps Indian farmers with mandi prices, crop planning, weather data, and soil health — in their own language.

## Features

- **Multilingual WhatsApp Bot** — supports English, Hindi, and Marathi
- **Voice Messages** — translates English text → regional language audio via ElevenLabs TTS
- **Location-aware** — collects farmer's GPS coordinates for localized data
- **Mandi Prices** — real-time market price information
- **Crop Planning** — AI-powered crop recommendations
- **Weather Data** — current conditions, forecasts, and historical data
- **Soil Health** — scrapes government soil health card data

## Tech Stack

| Component | Stack |
|-----------|-------|
| Chatbot API | Express, TypeScript, MongoDB, Mongoose |
| WhatsApp | Meta Cloud API (Graph API v25.0) |
| Text-to-Speech | ElevenLabs (eleven_multilingual_v2) |
| Translation | Google Translate API |
| AI Analyst | Python, Google Gemini |
| Weather | Python, Requests |
| Soil Health | Python, BeautifulSoup, Requests |

## Setup

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- MongoDB
- WhatsApp Business API access
- ElevenLabs API key

## Bot Flow

1. User messages the bot → language selection (English / Hindi / Marathi)
2. User shares farm location via WhatsApp pin
3. Main menu: Mandi Prices or Crop Planning
4. Responses are sent as text + translated audio messages
localhost/Humanity
