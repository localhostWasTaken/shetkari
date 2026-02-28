import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ApiResponse from './models/apiResponse';
import { buildListMenuMessage } from './utils/whatsapp';
import UserModel, { BotState, SupportedLanguages } from './entities/users';
import { randomUUID } from 'node:crypto';

const app = express();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shetkari';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

app.get("/api/webhook/whatsapp", (req: Request, res: Response) => {
  const VERIFY_TOKEN = "123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified by Meta!");
    res.status(200).send(challenge);
  } else {
    console.error("Verification failed. Tokens do not match.");
    res.sendStatus(403);
  }
});

app.post("/api/webhook/whatsapp", async (req: Request, res: Response) => {
  
  try {
    const { body } = req;
    
    const value = body.entry?.[0]?.changes?.[0]?.value;
    
    if (value?.statuses?.[0]) {
      const status = value.statuses[0].status;
      console.log(`Message status update received: ${status}`);
      res.sendStatus(200);
      return;
    }
    
    if (!value?.messages?.[0]) {
      console.log("Webhook received with no messages or statuses, ignoring.");
      res.sendStatus(200);
      return;
    }
    
    console.log("Received WhatsApp webhook:", JSON.stringify(req.body, null, 2));
    const farmerPhoneNumber = value.messages[0].from;

    let user = await UserModel.findOne({ phoneNumber: farmerPhoneNumber });

    if (!user) {
      user = await UserModel.create({
        id: randomUUID(),
        phoneNumber: farmerPhoneNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
        botState: BotState.AWAITING_LANGUAGE,
      });
      console.log("New user created:", user._id);
      await sendWelcomeAndLanguageSelection(farmerPhoneNumber);
      res.sendStatus(200);
      return;
    }

    const msgType = value.messages[0].type;

    // --- State: AWAITING_LANGUAGE ---
    if (user.botState === BotState.AWAITING_LANGUAGE || user.botState === BotState.NEW) {
      if (msgType === "interactive" && value.messages[0].interactive?.type === "button_reply") {
        const buttonId: string = value.messages[0].interactive.button_reply.id;

        const langMap: Record<string, SupportedLanguages> = {
          lang_en: SupportedLanguages.ENGLISH,
          lang_hi: SupportedLanguages.HINDI,
          lang_mr: SupportedLanguages.MARATHI,
        };

        const selectedLang = langMap[buttonId];
        if (selectedLang) {
          user.language = selectedLang;
          user.botState = BotState.AWAITING_LOCATION;
          await user.save();
          await sendLocationRequest(farmerPhoneNumber);
        } else {
          await sendWelcomeAndLanguageSelection(farmerPhoneNumber);
        }
      } else {
        // They sent something other than a language button — re-prompt
        await sendTextMessage(farmerPhoneNumber, "loduuuuuu, sangitlaye te kar na");
        await sendWelcomeAndLanguageSelection(farmerPhoneNumber);
      }
      res.sendStatus(200);
      return;
    }

    // --- State: AWAITING_LOCATION ---
    if (user.botState === BotState.AWAITING_LOCATION) {
      if (msgType === "location") {
        const { latitude, longitude } = value.messages[0].location;
        user.location = { latitude, longitude };
        user.botState = BotState.IDLE;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, "✅ Location saved! We're all set.");
      } else {
        // They sent something other than a location pin — re-prompt
        await sendTextMessage(farmerPhoneNumber, "jhattuboi location patav na green muli la tujhe chale sangen");
      }
      res.sendStatus(200);
      return;
    }

    // --- State: IDLE (future handlers go here) ---
    await sendTextMessage(farmerPhoneNumber, "Sorry, I didn't understand that. Please wait for further instructions.");
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.sendStatus(500);
  }
});

async function sendWelcomeAndLanguageSelection(recipientNumber: string) {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const payload = buildListMenuMessage(
    recipientNumber,
    [
      { id: "lang_en", title: "English" },
      { id: "lang_hi", title: "हिन्दी" },
      { id: "lang_mr", title: "मराठी" }
    ],
    "Welcome to Shetkari!\nYour smart farming assistant.\n\nPlease select your preferred language:\nkrupaya apni bhasha chunein:\nkrupaya tumchi bhasha nivda:"
  );

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to send Language Menu:", JSON.stringify(data, null, 2));
    } else {
      console.log(`Language Menu sent to ${recipientNumber}!`);
    }
  } catch (err) {
    console.error("Network error:", err);
  }
}

async function sendLocationRequest(recipientNumber: string) {
  await sendTextMessage(
    recipientNumber,
    "📍 Please share your farm's location.\nTap the 📎 (attachment) icon and select *Location*."
  );
}

async function sendTextMessage(recipientNumber: string, text: string) {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    type: "text",
    text: { body: text },
  };

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to send text message:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Network error sending text message:", err);
  }
}

app.get('/', (req: Request, res: Response) => {
  console.log('Received GET request at /api/hello');
  const response: ApiResponse = {
    statusCode: 200,
    data: 'Hello World',
    message: 'Success',
    error: null
  };
  res.json(response);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});