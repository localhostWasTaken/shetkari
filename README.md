# Shetkari

Built by Team Localhost for the ACM Aftermath Hackathon.

Shetkari is a WhatsApp bot designed for farmer development. It helps out in two main ways:
1. **Soil Health Analysis:** Reads and analyzes government-issued Soil Health Cards.
2. **Market Prices:** Gets the latest and best crop prices for the nearest APMC market using data from `data.gov.in`.

### Tech Stack
- **Backend:** TypeScript/Express (for handling webhooks/APIs) & Python for the analysis service
- **Database:** MongoDB for persistence
- **Messaging:** Meta Business API for WhatsApp conversations

### Directory Structure

- `server/` - The main server. Handles WhatsApp webhooks and APIs. **(Note: This is where your `.env` file goes)**
- `data_sources/` - Handles the price analysis and fetching market data.
- `ai_analyst/` - Handles extracting HTML from the Soil Health Cards and running the AI analysis.
- `AfterMath_localhost_Humanity.pptx` - Hackathon presentation deck.

### Setup

1. Navigate to the `server` directory.
2. Create a `.env` file.
3. Paste the following into your `.env` file and fill in your actual credentials:
4. Export the variables into your shell session

```env
MONGODB_URI=

WHATSAPP_APP_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

ELEVENLABS_API_KEY=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

DATA_SOURCES_BASE_URL=
AI_ANALYST_BASE_URL=
