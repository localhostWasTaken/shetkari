import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ApiResponse from './models/apiResponse';
import { sendListMenu, sendTextMessage, uploadAudioToWhatsApp, sendAudioMessage } from './utils/whatsapp';
import { translateAndSpeak } from './utils/elevenlabs';
import UserModel, { BotState, SupportedLanguages } from './entities/users';

import { randomUUID } from 'node:crypto';

const locationRequestMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Please share your farm's location.\nTap the attachment icon and select Location.",
  [SupportedLanguages.HINDI]: "कृपया अपने खेत की लोकेशन शेयर करें।\nअटैचमेंट आइकन दबाएं और Location चुनें।",
  [SupportedLanguages.MARATHI]: "कृपया तुमच्या शेताचे स्थान शेअर करा।\nअटॅचमेंट चिन्हावर टॅप करा आणि Location निवडा.",
};

const locationSavedMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Your location has been saved successfully. You are all set.",
  [SupportedLanguages.HINDI]: "आपकी लोकेशन सफलतापूर्वक सेव हो गई है। सब कुछ तैयार है।",
  [SupportedLanguages.MARATHI]: "तुमचे स्थान यशस्वीरित्या सेव्ह झाले आहे. सर्व काही तयार आहे.",
};

const updateChoiceMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Please select what you would like to update.",
  [SupportedLanguages.HINDI]: "कृपया चुनें कि आप क्या अपडेट करना चाहते हैं।",
  [SupportedLanguages.MARATHI]: "कृपया तुम्हाला काय अपडेट करायचे आहे ते निवडा.",
};

const updateChoiceOptions: Record<SupportedLanguages, { id: string; title: string }[]> = {
  [SupportedLanguages.ENGLISH]: [
    { id: "update_language", title: "Language" },
    { id: "update_location", title: "Location" },
  ],
  [SupportedLanguages.HINDI]: [
    { id: "update_language", title: "भाषा" },
    { id: "update_location", title: "लोकेशन" },
  ],
  [SupportedLanguages.MARATHI]: [
    { id: "update_language", title: "भाषा" },
    { id: "update_location", title: "स्थान" },
  ],
};

const languageUpdatedMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Your language preference has been updated successfully.",
  [SupportedLanguages.HINDI]: "आपकी भाषा सफलतापूर्वक अपडेट हो गई है।",
  [SupportedLanguages.MARATHI]: "तुमची भाषा निवड यशस्वीरित्या अपडेट झाली आहे.",
};

const locationUpdatedMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Your location has been updated successfully.",
  [SupportedLanguages.HINDI]: "आपकी लोकेशन सफलतापूर्वक अपडेट हो गई है।",
  [SupportedLanguages.MARATHI]: "तुमचे स्थान यशस्वीरित्या अपडेट झाले आहे.",
};

const mainMenu: Record<SupportedLanguages, { body: string; options: { id: string; title: string }[] }> = {
  [SupportedLanguages.ENGLISH]: {
    body: "Welcome to Shetkari.\nYour smart farming assistant.\n\nPlease select an option from the menu below to get started.",
    options: [
      { id: "menu_mandi", title: "Mandi Prices" },
      { id: "menu_crop_plan", title: "Crop Planning" },
      { id: "menu_update_details", title: "Update Details" },
    ],
  },
  [SupportedLanguages.HINDI]: {
    body: "शेतकरी में आपका स्वागत है।\nआपका स्मार्ट खेती सहायक।\n\nकृपया शुरू करने के लिए नीचे दिए गए मेनू से एक विकल्प चुनें।",
    options: [
      { id: "menu_mandi", title: "मंडी भाव" },
      { id: "menu_crop_plan", title: "फसल योजना" },
      { id: "menu_update_details", title: "विवरण अपडेट करें" },
    ],
  },
  [SupportedLanguages.MARATHI]: {
    body: "शेतकरीमध्ये आपले स्वागत आहे.\nतुमचा स्मार्ट शेती सहाय्यक.\n\nकृपया सुरू करण्यासाठी खालील मेनूमधून एक पर्याय निवडा.",
    options: [
      { id: "menu_mandi", title: "मंडी भाव" },
      { id: "menu_crop_plan", title: "पीक नियोजन" },
      { id: "menu_update_details", title: "तपशील अपडेट करा" },
    ],
  },
};

const app = express();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shetkari';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

app.get("/api/webhook/whatsapp", (req: Request, res: Response) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

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
          await sendTextMessage(farmerPhoneNumber, locationRequestMessage[selectedLang]);
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
        await sendTextMessage(farmerPhoneNumber, locationSavedMessage[user.language ?? SupportedLanguages.ENGLISH]);
      } else {
        // They sent something other than a location pin — re-prompt
        await sendTextMessage(farmerPhoneNumber, "jhattuboi location patav na green muli la tujhe chale sangen");
      }
      res.sendStatus(200);
      return;
    }

    // --- State: AWAITING_UPDATE_CHOICE ---
    if (user.botState === BotState.AWAITING_UPDATE_CHOICE) {
      const lang = user.language ?? SupportedLanguages.ENGLISH;
      if (msgType === "interactive" && value.messages[0].interactive?.type === "button_reply") {
        const buttonId: string = value.messages[0].interactive.button_reply.id;
        if (buttonId === "update_language") {
          user.botState = BotState.AWAITING_NEW_LANGUAGE;
          await user.save();
          await sendWelcomeAndLanguageSelection(farmerPhoneNumber);
        } else if (buttonId === "update_location") {
          user.botState = BotState.AWAITING_NEW_LOCATION;
          await user.save();
          await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
        } else {
          await sendListMenu(farmerPhoneNumber, updateChoiceOptions[lang], updateChoiceMessage[lang]);
        }
      } else {
        await sendListMenu(farmerPhoneNumber, updateChoiceOptions[lang], updateChoiceMessage[lang]);
      }
      res.sendStatus(200);
      return;
    }

    // --- State: AWAITING_NEW_LANGUAGE ---
    if (user.botState === BotState.AWAITING_NEW_LANGUAGE) {
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
          user.botState = BotState.IDLE;
          await user.save();
          await sendTextMessage(farmerPhoneNumber, languageUpdatedMessage[selectedLang]);
          await sendListMenu(farmerPhoneNumber, mainMenu[selectedLang].options, mainMenu[selectedLang].body);
        } else {
          await sendWelcomeAndLanguageSelection(farmerPhoneNumber);
        }
      } else {
        await sendWelcomeAndLanguageSelection(farmerPhoneNumber);
      }
      res.sendStatus(200);
      return;
    }

    // --- State: AWAITING_NEW_LOCATION ---
    if (user.botState === BotState.AWAITING_NEW_LOCATION) {
      const lang = user.language ?? SupportedLanguages.ENGLISH;
      if (msgType === "location") {
        const { latitude, longitude } = value.messages[0].location;
        user.location = { latitude, longitude };
        user.botState = BotState.IDLE;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, locationUpdatedMessage[lang]);
        await sendListMenu(farmerPhoneNumber, mainMenu[lang].options, mainMenu[lang].body);
      } else {
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
      }
      res.sendStatus(200);
      return;
    }

    // --- State: IDLE — show main menu ---
    if (msgType === "interactive" && value.messages[0].interactive?.type === "button_reply") {
      const buttonId: string = value.messages[0].interactive.button_reply.id;
      const lang = user.language ?? SupportedLanguages.ENGLISH;
      if (buttonId === "menu_update_details") {
        user.botState = BotState.AWAITING_UPDATE_CHOICE;
        await user.save();
        await sendListMenu(farmerPhoneNumber, updateChoiceOptions[lang], updateChoiceMessage[lang]);
        res.sendStatus(200);
        return;
      }
      // TODO: handle menu_mandi, menu_crop_plan
    }

    await sendListMenu(farmerPhoneNumber, mainMenu[user.language ?? SupportedLanguages.ENGLISH].options, mainMenu[user.language ?? SupportedLanguages.ENGLISH].body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.sendStatus(500);
  }
});

async function sendWelcomeAndLanguageSelection(recipientNumber: string) {
  await sendListMenu(
    recipientNumber,
    [
      { id: "lang_en", title: "English" },
      { id: "lang_hi", title: "हिन्दी" },
      { id: "lang_mr", title: "मराठी" }
    ],
    "Welcome to Shetkari.\nYour smart farming assistant.\n\nPlease select your preferred language.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा."
  );
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

app.post("/api/translate-audio", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, text, language } = req.body;

    if (!phoneNumber || !text) {
      res.status(400).json({ error: "phoneNumber and text are required" });
      return;
    }

    // Determine target language: from body, from user profile, or default to English
    let targetLang: SupportedLanguages = language as SupportedLanguages;
    if (!targetLang) {
      const user = await UserModel.findOne({ phoneNumber });
      targetLang = user?.language ?? SupportedLanguages.ENGLISH;
    }

    const { translatedText, audioBuffer } = await translateAndSpeak(text, targetLang);

    // Upload audio to WhatsApp and send it
    const mediaId = await uploadAudioToWhatsApp(audioBuffer);
    await sendAudioMessage(phoneNumber, mediaId);

    res.json({
      success: true,
      translatedText,
      language: targetLang,
      audioSizeBytes: audioBuffer.length,
    });
  } catch (error) {
    console.error("Error in /api/translate-audio:", error);
    res.status(500).json({ error: "Failed to translate and send audio" });
  }
});

async function sendTranslatedAudio(
  recipientNumber: string,
  englishText: string,
  targetLanguage: SupportedLanguages
): Promise<void> {
  try {
    const { translatedText, audioBuffer } = await translateAndSpeak(
      englishText,
      targetLanguage
    );

    console.log(`[Bot] Translated: "${translatedText.substring(0, 60)}..."`);

    // Upload to WhatsApp and send
    const mediaId = await uploadAudioToWhatsApp(audioBuffer);
    await sendAudioMessage(recipientNumber, mediaId);

    console.log(`[Bot] Translated audio sent to ${recipientNumber} in ${targetLanguage}`);
  } catch (error) {
    console.error("Error sending translated audio:", error);
    // Fallback: send as text
    await sendTextMessage(recipientNumber, englishText);
  }
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});