import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ApiResponse from './models/apiResponse';
import { sendListMenu, sendTextMessage, sendInteractiveList } from './utils/whatsapp';
import UserModel, { BotState, SupportedLanguages } from './entities/users';
import CropPlanModel, { isCropPlanIncomplete } from './entities/crop_plan';
import { cropPlanAnalysis } from './utils/crop_plan_analysis';
import { getMandiProductsForUser, getMandiAnalysisForProduct, GeoLocation } from './utils/mandi_analysis';
import { randomUUID } from 'node:crypto';

// ─── Static message tables ────────────────────────────────────────────────────

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

const messages: Record<SupportedLanguages, Record<string, string>> = {
  [SupportedLanguages.ENGLISH]: {
    cropCreationCancelled: 'Crop creation has been cancelled.',
    welcomeMessage: 'Welcome to Shetkari.\nYour smart farming assistant.\n\nPlease select your preferred language.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा.',
    selectLanguage: 'Please select your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा.',
    selectNewLanguage: 'Please select your new language / नई भाषा चुनें / नवीन भाषा निवडा.',
    enterCropName: 'Please enter the crop name (e.g., Wheat, Rice) or type "cancel" to abort.',
    errorTryAgain: 'An error occurred. Please try again from the main menu.',
    enterSowingDate: 'Please enter the sowing date.\nExamples: "March 15", "15/03/2026", "15-3-2026"\n\nOr type "cancel" to abort.',
    enterSowingDatePrompt: 'Please enter the sowing date (e.g., 15-3-2026) or type "cancel".',
    invalidDate: 'The input could not be understood as a date. Please enter a valid date (e.g., 15-3-2026 or March 15th) or type "cancel".',
    sowingDateSet: 'Sowing date set to ${date}.\n\nPlease enter your farm size in acres (e.g., 2.5) or type "cancel".',
    enterFarmSize: 'Please enter your farm size in acres (e.g., 2.5) or type "cancel".',
    invalidNumber: 'The input does not appear to be a valid number. Please enter farm size in acres (e.g., 2.5) or type "cancel".',
    farmSizeSet: 'Farm size set to ${num} acres.\n\nPlease select your irrigation method.\nYou can also type: Rainfed, Borewell, Canal, Drip, or Sprinkler.\n\nOr type "cancel" to abort.',
    selectIrrigation: 'Please select irrigation method (Rainfed, Borewell, Canal, Drip, Sprinkler) or type "cancel".',
    invalidIrrigation: 'Please choose one of: Rainfed, Borewell, Canal, Drip, Sprinkler — or type "cancel".',
    analysingCropPlan: 'Analysing your crop plan, please wait.',
    cropPlanAnalysis: 'Crop Plan Analysis\n\n${analysis}',
    cropPlanIncomplete: 'Crop plan saved but some details are missing. Please create a new one from the main menu.',
    createCropPlan: 'Let us create your crop plan.\n\nPlease enter the crop name (e.g., Wheat, Rice, Cotton).\n\nOr type "cancel" at any time to abort.',
    mandiSelectCommodity: 'Please select a commodity to get mandi prices.\nType "cancel" to go back to the main menu.',
    mandiSelectButton: 'View Commodities',
    mandiSectionTitle: 'Commodities',
    mandiMoreOption: 'More →',
    mandiNoMore: 'No more commodities available.\nPlease select from the list above, or type "cancel" to go back.',
    mandiCancelled: 'Mandi prices check has been cancelled.',
    mandiAnalysing: 'Fetching mandi prices for ${product}, please wait...',
    mandiAnalysisResult: 'Mandi Price Analysis\n\n${analysis}',
  },
  [SupportedLanguages.HINDI]: {
    cropCreationCancelled: 'फसल निर्माण रद्द कर दिया गया है।',
    welcomeMessage: 'Welcome to Shetkari.\nYour smart farming assistant.\n\nPlease select your preferred language.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा.',
    selectLanguage: 'Please select your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा.',
    selectNewLanguage: 'Please select your new language / नई भाषा चुनें / नवीन भाषा निवडा.',
    enterCropName: 'कृपया फसल का नाम दर्ज करें (उदाहरण के लिए, गेहूं, चावल) या "cancel" टाइप करके निरस्त करें।',
    errorTryAgain: 'एक त्रुटि हुई। कृपया मुख्य मेनू से फिर से प्रयास करें।',
    enterSowingDate: 'कृपया बोवनी की तारीख दर्ज करें।\nउदाहरण: "March 15", "15/03/2026", "15-3-2026"\n\nया "cancel" टाइप करके निरस्त करें।',
    enterSowingDatePrompt: 'कृपया बोवनी की तारीख दर्ज करें (उदाहरण, 15-3-2026) या "cancel" टाइप करें।',
    invalidDate: 'इनपुट को तारीख के रूप में समझा नहीं जा सका। कृपया एक वैध तारीख दर्ज करें (उदाहरण, 15-3-2026 या March 15th) या "cancel" टाइप करें।',
    sowingDateSet: 'बोवनी की तारीख ${date} पर सेट की गई।\n\nकृपया अपने खेत का आकार एकड़ में दर्ज करें (उदाहरण, 2.5) या "cancel" टाइप करें।',
    enterFarmSize: 'कृपया अपने खेत का आकार एकड़ में दर्ज करें (उदाहरण, 2.5) या "cancel" टाइप करें।',
    invalidNumber: 'इनपुट एक वैध संख्या नहीं प्रतीत होता। कृपया खेत का आकार एकड़ में दर्ज करें (उदाहरण, 2.5) या "cancel" टाइप करें।',
    farmSizeSet: 'खेत का आकार ${num} एकड़ पर सेट किया गया।\n\nकृपया अपनी सिंचाई विधि चुनें।\nआप टाइप भी कर सकते हैं: Rainfed, Borewell, Canal, Drip, or Sprinkler.\n\nया "cancel" टाइप करके निरस्त करें।',
    selectIrrigation: 'कृपया सिंचाई विधि चुनें (Rainfed, Borewell, Canal, Drip, Sprinkler) या "cancel" टाइप करें।',
    invalidIrrigation: 'कृपया इनमें से एक चुनें: Rainfed, Borewell, Canal, Drip, Sprinkler — या "cancel" टाइप करें।',
    analysingCropPlan: 'आपकी फसल योजना का विश्लेषण किया जा रहा है, कृपया प्रतीक्षा करें।',
    cropPlanAnalysis: 'फसल योजना विश्लेषण\n\n${analysis}',
    cropPlanIncomplete: 'फसल योजना सहेजी गई लेकिन कुछ विवरण गायब हैं। कृपया मुख्य मेनू से एक नई बनाएं।',
    createCropPlan: 'आइए आपकी फसल योजना बनाएं।\n\nकृपया फसल का नाम दर्ज करें (उदाहरण, गेहूं, चावल, कपास)।\n\nया किसी भी समय "cancel" टाइप करके निरस्त करें।',
    mandiSelectCommodity: 'मंडी भाव देखने के लिए कृपया एक वस्तु चुनें।\nमुख्य मेनू पर वापस जाने के लिए "cancel" टाइप करें।',
    mandiSelectButton: 'वस्तुएं देखें',
    mandiSectionTitle: 'वस्तुएं',
    mandiMoreOption: 'और देखें →',
    mandiNoMore: 'कोई और वस्तु उपलब्ध नहीं है।\nऊपर दी गई सूची से चुनें, या "cancel" टाइप करके वापस जाएं।',
    mandiCancelled: 'मंडी भाव जांच रद्द कर दी गई है।',
    mandiAnalysing: '${product} के लिए मंडी भाव प्राप्त किए जा रहे हैं, कृपया प्रतीक्षा करें...',
    mandiAnalysisResult: 'मंडी भाव विश्लेषण\n\n${analysis}',
  },
  [SupportedLanguages.MARATHI]: {
    cropCreationCancelled: 'पीक निर्मिती रद्द करण्यात आली आहे.',
    welcomeMessage: 'Welcome to Shetkari.\nYour smart farming assistant.\n\nPlease select your preferred language.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा.',
    selectLanguage: 'Please select your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा.',
    selectNewLanguage: 'Please select your new language / नई भाषा चुनें / नवीन भाषा निवडा.',
    enterCropName: 'कृपया पीकाचे नाव प्रविष्ट करा (उदाहरणार्थ, गहू, तांदूळ) किंवा "cancel" टाइप करून रद्द करा.',
    errorTryAgain: 'एक त्रुटी आली. कृपया मुख्य मेनूमधून पुन्हा प्रयत्न करा.',
    enterSowingDate: 'कृपया पेरणीची तारीख प्रविष्ट करा.\nउदाहरणे: "March 15", "15/03/2026", "15-3-2026"\n\nकिंवा "cancel" टाइप करून रद्द करा.',
    enterSowingDatePrompt: 'कृपया पेरणीची तारीख प्रविष्ट करा (उदाहरण, 15-3-2026) किंवा "cancel" टाइप करा.',
    invalidDate: 'इनपुटला तारीख म्हणून समजले नाही. कृपया वैध तारीख प्रविष्ट करा (उदाहरण, 15-3-2026 किंवा March 15th) किंवा "cancel" टाइप करा.',
    sowingDateSet: 'पेरणीची तारीख ${date} वर सेट केली.\n\nकृपया तुमच्या शेताचा आकार एकरमध्ये प्रविष्ट करा (उदाहरण, 2.5) किंवा "cancel" टाइप करा.',
    enterFarmSize: 'कृपया तुमच्या शेताचा आकार एकरमध्ये प्रविष्ट करा (उदाहरण, 2.5) किंवा "cancel" टाइप करा.',
    invalidNumber: 'इनपुट वैध संख्या दिसत नाही. कृपया शेताचा आकार एकरमध्ये प्रविष्ट करा (उदाहरण, 2.5) किंवा "cancel" टाइप करा.',
    farmSizeSet: 'शेताचा आकार ${num} एकरवर सेट केला.\n\nकृपया तुमची सिंचन पद्धत निवडा.\nतुम्ही टाइप करू शकता: Rainfed, Borewell, Canal, Drip, किंवा Sprinkler.\n\nकिंवा "cancel" टाइप करून रद्द करा.',
    selectIrrigation: 'कृपया सिंचन पद्धत निवडा (Rainfed, Borewell, Canal, Drip, Sprinkler) किंवा "cancel" टाइप करा.',
    invalidIrrigation: 'कृपया यापैकी एक निवडा: Rainfed, Borewell, Canal, Drip, Sprinkler — किंवा "cancel" टाइप करा.',
    analysingCropPlan: 'तुमच्या पीक योजनेचे विश्लेषण केले जात आहे, कृपया थांबा.',
    cropPlanAnalysis: 'पीक योजना विश्लेषण\n\n${analysis}',
    cropPlanIncomplete: 'पीक योजना जतन झाली परंतु काही तपशील गहाळ आहेत. कृपया मुख्य मेनूमधून एक नवीन तयार करा.',
    createCropPlan: 'चला तुमची पीक योजना तयार करूया.\n\nकृपया पीकाचे नाव प्रविष्ट करा (उदाहरणार्थ, गहू, तांदूळ, कापूस).\n\nकिंवा कोणत्याही वेळी "cancel" टाइप करून रद्द करा.',
    mandiSelectCommodity: 'मंडी भाव पाहण्यासाठी कृपया एक वस्तू निवडा.\nमुख्य मेनूवर परत जाण्यासाठी "cancel" टाइप करा.',
    mandiSelectButton: 'वस्तू पहा',
    mandiSectionTitle: 'वस्तू',
    mandiMoreOption: 'आणखी पहा →',
    mandiNoMore: 'आणखी वस्तू उपलब्ध नाहीत.\nवरील यादीतून निवडा, किंवा "cancel" टाइप करून परत जा.',
    mandiCancelled: 'मंडी भाव तपासणी रद्द करण्यात आली आहे.',
    mandiAnalysing: '${product} साठी मंडी भाव मिळवले जात आहेत, कृपया थांबा...',
    mandiAnalysisResult: 'मंडी भाव विश्लेषण\n\n${analysis}',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendMainMenu(phone: string, lang: SupportedLanguages) {
  await sendListMenu(phone, mainMenu[lang].options, mainMenu[lang].body);
}

/**
 * Use Gemini 1.5 Flash to decide whether a user's text represents a valid
 * calendar date, and return that date as a JS Date — or null if it cannot.
 */
async function parseDateWithGemini(userText: string): Promise<Date | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!geminiKey) {
    const d = new Date(userText);
    return isNaN(d.getTime()) ? null : d;
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
  const todaysDate = new Date().toISOString().split('T')[0];

  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              `You are a date parser. 
              todays date is ${todaysDate}
              The user sent this text: "${userText}"\n` +
              `The date should be more than 5 months in the past.\n` +
              `shouldnt be more than 5 months in the future\n` +
              `If it contains a valid date, reply with ONLY the ISO-8601 date string (YYYY-MM-DD) and nothing else.\n` +
              `If it does NOT contain a valid date (e.g. random words, nonsense), reply with only the single word: null`,
          },
        ],
      },
    ],
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json() as any;
    console.log('Gemini raw response:', JSON.stringify(data, null, 2));
    const reply: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'null').trim();
    console.log('Gemini date parse response:', reply);
    if (!reply || reply.toLowerCase() === 'null') return null;
    const d = new Date(reply);
    return isNaN(d.getTime()) ? null : d;
  } catch (err) {
    console.error('[Gemini date parse] error:', err);
    return null;
  }
}

/** Delete the latest in-progress crop plan for a user and return to IDLE */
async function cancelCropPlan(user: any, phone: string) {
  const latest = await CropPlanModel.findOne({ userId: user.id }).sort({ createdAt: -1 });
  if (latest) await CropPlanModel.deleteOne({ _id: latest._id });
  user.botState = BotState.IDLE;
  await user.save();
  const lang: SupportedLanguages = user.language ?? SupportedLanguages.ENGLISH;
  await sendTextMessage(phone, messages[lang].cropCreationCancelled);
  await sendMainMenu(phone, lang);
}

/** Cancel an in-progress mandi selection and return to IDLE */
async function cancelMandi(user: any, phone: string) {
  user.botState = BotState.IDLE;
  await user.save();
  const lang: SupportedLanguages = user.language ?? SupportedLanguages.ENGLISH;
  await sendTextMessage(phone, messages[lang].mandiCancelled);
  await sendMainMenu(phone, lang);
}

/**
 * Fetch mandi products for the given page and send them as a WhatsApp interactive
 * list. Each row id is encoded as:  <productName>;<page>;<productId>
 * The 10th slot (when the list is full, i.e. 9 items) is a "More →" option with
 * id:  more;<nextPage>
 * When the API returns fewer than 9 items there is nothing more to paginate, so
 * no "More" row is appended and a note is shown in the body text.
 */
async function sendMandiProductList(
  phone: string,
  user: any,
  page: number
) {
  const lang: SupportedLanguages = user.language ?? SupportedLanguages.ENGLISH;
  const location: GeoLocation = user.location ?? { latitude: 0, longitude: 0 };

  const products = await getMandiProductsForUser(location, lang, page);
  const isLastPage = products.length < 9;

  const rows: { id: string; title: string }[] = products.map((p) => ({
    // encode: <name>;<page>;<apiId>
    id: `${p.name};${page};${p.id}`,
    title: p.name.charAt(0).toUpperCase() + p.name.slice(1),
  }));

  if (!isLastPage) {
    rows.push({
      id: `more;${page + 1}`,
      title: messages[lang].mandiMoreOption,
    });
  }

  const bodyText = isLastPage && products.length === 0
    ? messages[lang].mandiNoMore
    : messages[lang].mandiSelectCommodity + (isLastPage ? `\n\n${messages[lang].mandiNoMore}` : '');

  await sendInteractiveList(
    phone,
    bodyText,
    messages[lang].mandiSelectButton,
    messages[lang].mandiSectionTitle,
    rows
  );
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shetkari';
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

// Webhook verification
app.get('/api/webhook/whatsapp', (req: Request, res: Response) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified by Meta!');
    res.status(200).send(challenge);
  } else {
    console.error('Verification failed. Tokens do not match.');
    res.sendStatus(403);
  }
});

// ─── Main webhook handler ─────────────────────────────────────────────────────
app.post('/api/webhook/whatsapp', async (req: Request, res: Response) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;

    if (value?.statuses?.[0]) {
      res.sendStatus(200);
      return;
    }

    if (!value?.messages?.[0]) {
      res.sendStatus(200);
      return;
    }

    console.log('Received WhatsApp webhook:', JSON.stringify(req.body, null, 2));

    const farmerPhoneNumber: string = value.messages[0].from;
    const msgType: string = value.messages[0].type;

    // ── New user ──────────────────────────────────────────────────────────────
    let user = await UserModel.findOne({ phoneNumber: farmerPhoneNumber });
    if (!user) {
      user = await UserModel.create({
        id: randomUUID(),
        phoneNumber: farmerPhoneNumber,
        botState: BotState.AWAITING_LANGUAGE,
      });
      await sendListMenu(
        farmerPhoneNumber,
        [
          { id: 'lang_en', title: 'English' },
          { id: 'lang_hi', title: 'हिन्दी' },
          { id: 'lang_mr', title: 'मराठी' },
        ],
        messages[SupportedLanguages.ENGLISH].welcomeMessage
      );
      res.sendStatus(200);
      return;
    }

    const lang: SupportedLanguages = user.language ?? SupportedLanguages.ENGLISH;

    // Convenience: extract button id and plain text body once
    const buttonId: string | null =
      msgType === 'interactive' && value.messages[0].interactive?.type === 'button_reply'
        ? value.messages[0].interactive.button_reply.id
        : null;

    // list_reply comes from WhatsApp interactive list messages
    const listReplyId: string | null =
      msgType === 'interactive' && value.messages[0].interactive?.type === 'list_reply'
        ? value.messages[0].interactive.list_reply.id
        : null;

    const textBody: string | null =
      msgType === 'text' ? (value.messages[0].text?.body?.trim() ?? null) : null;

    // ── State: AWAITING_LANGUAGE / NEW ────────────────────────────────────────
    if (user.botState === BotState.AWAITING_LANGUAGE || user.botState === BotState.NEW) {
      const langMap: Record<string, SupportedLanguages> = {
        lang_en: SupportedLanguages.ENGLISH,
        lang_hi: SupportedLanguages.HINDI,
        lang_mr: SupportedLanguages.MARATHI,
      };
      const selectedLang = buttonId ? langMap[buttonId] : undefined;
      if (selectedLang) {
        user.language = selectedLang;
        user.botState = BotState.AWAITING_LOCATION;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[selectedLang]);
      } else {
        await sendListMenu(
          farmerPhoneNumber,
          [
            { id: 'lang_en', title: 'English' },
            { id: 'lang_hi', title: 'हिन्दी' },
            { id: 'lang_mr', title: 'मराठी' },
          ],
          messages[lang].selectLanguage
        );
      }
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_LOCATION ──────────────────────────────────────────────
    if (user.botState === BotState.AWAITING_LOCATION) {
      if (msgType === 'location') {
        const { latitude, longitude } = value.messages[0].location;
        user.location = { latitude, longitude };
        user.botState = BotState.IDLE;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, locationSavedMessage[lang]);
        await sendMainMenu(farmerPhoneNumber, lang);
      } else {
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
      }
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_UPDATE_CHOICE ─────────────────────────────────────────
    if (user.botState === BotState.AWAITING_UPDATE_CHOICE) {
      if (buttonId === 'update_language') {
        user.botState = BotState.AWAITING_NEW_LANGUAGE;
        await user.save();
        await sendListMenu(
          farmerPhoneNumber,
          [
            { id: 'lang_en', title: 'English' },
            { id: 'lang_hi', title: 'हिन्दी' },
            { id: 'lang_mr', title: 'मराठी' },
          ],
          messages[lang].selectNewLanguage
        );
      } else if (buttonId === 'update_location') {
        user.botState = BotState.AWAITING_NEW_LOCATION;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
      } else {
        await sendListMenu(farmerPhoneNumber, updateChoiceOptions[lang], updateChoiceMessage[lang]);
      }
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_NEW_LANGUAGE ──────────────────────────────────────────
    if (user.botState === BotState.AWAITING_NEW_LANGUAGE) {
      const langMap: Record<string, SupportedLanguages> = {
        lang_en: SupportedLanguages.ENGLISH,
        lang_hi: SupportedLanguages.HINDI,
        lang_mr: SupportedLanguages.MARATHI,
      };
      const selectedLang = buttonId ? langMap[buttonId] : undefined;
      if (selectedLang) {
        user.language = selectedLang;
        user.botState = BotState.IDLE;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, languageUpdatedMessage[selectedLang]);
        await sendMainMenu(farmerPhoneNumber, selectedLang);
      } else {
        await sendListMenu(
          farmerPhoneNumber,
          [
            { id: 'lang_en', title: 'English' },
            { id: 'lang_hi', title: 'हिन्दी' },
            { id: 'lang_mr', title: 'मराठी' },
          ],
          messages[lang].selectNewLanguage
        );
      }
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_NEW_LOCATION ──────────────────────────────────────────
    if (user.botState === BotState.AWAITING_NEW_LOCATION) {
      if (msgType === 'location') {
        const { latitude, longitude } = value.messages[0].location;
        user.location = { latitude, longitude };
        user.botState = BotState.IDLE;
        await user.save();
        await sendTextMessage(farmerPhoneNumber, locationUpdatedMessage[lang]);
        await sendMainMenu(farmerPhoneNumber, lang);
      } else {
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
      }
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_CROP_NAME ─────────────────────────────────────────────
    if (user.botState === BotState.AWAITING_CROP_NAME) {
      if (!textBody) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].enterCropName);
        res.sendStatus(200);
        return;
      }
      if (textBody.toLowerCase() === 'cancel') {
        await cancelCropPlan(user, farmerPhoneNumber);
        res.sendStatus(200);
        return;
      }
      const crop = await CropPlanModel.findOne({ userId: user.id, cropName: null }).sort({ createdAt: -1 });
      if (!crop) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].errorTryAgain);
        user.botState = BotState.IDLE;
        await user.save();
        res.sendStatus(200);
        return;
      }
      crop.cropName = textBody;
      await crop.save();
      user.botState = BotState.AWAITING_SOWING_DATE;
      await user.save();
      await sendTextMessage(
        farmerPhoneNumber,
        messages[lang].enterSowingDate
      );
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_SOWING_DATE ───────────────────────────────────────────
    if (user.botState === BotState.AWAITING_SOWING_DATE) {
      if (!textBody) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].enterSowingDatePrompt);
        res.sendStatus(200);
        return;
      }
      if (textBody.toLowerCase() === 'cancel') {
        await cancelCropPlan(user, farmerPhoneNumber);
        res.sendStatus(200);
        return;
      }

      const parsedDate = await parseDateWithGemini(textBody);
      if (!parsedDate) {
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].invalidDate
        );
        res.sendStatus(200);
        return;
      }

      const crop = await CropPlanModel.findOne({ userId: user.id }).sort({ createdAt: -1 });
      if (!crop) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].errorTryAgain);
        user.botState = BotState.IDLE;
        await user.save();
        res.sendStatus(200);
        return;
      }
      crop.sowingDate = parsedDate;
      await crop.save();
      user.botState = BotState.AWAITING_FARM_SIZE;
      await user.save();
      await sendTextMessage(
        farmerPhoneNumber,
        messages[lang].sowingDateSet.replace('${date}', parsedDate.toDateString())
      );
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_FARM_SIZE ─────────────────────────────────────────────
    if (user.botState === BotState.AWAITING_FARM_SIZE) {
      if (!textBody) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].enterFarmSize);
        res.sendStatus(200);
        return;
      }
      if (textBody.toLowerCase() === 'cancel') {
        await cancelCropPlan(user, farmerPhoneNumber);
        res.sendStatus(200);
        return;
      }
      const num = parseFloat(textBody.replace(/[^0-9.]/g, ''));
      if (isNaN(num) || num <= 0) {
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].invalidNumber
        );
        res.sendStatus(200);
        return;
      }
      const crop = await CropPlanModel.findOne({ userId: user.id }).sort({ createdAt: -1 });
      if (!crop) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].errorTryAgain);
        user.botState = BotState.IDLE;
        await user.save();
        res.sendStatus(200);
        return;
      }
      crop.farmSizeAcres = num;
      await crop.save();
      user.botState = BotState.AWAITING_IRRIGATION_METHOD;
      await user.save();
      // WhatsApp buttons: max 3 per message — send first 3, user can type others
      await sendListMenu(
        farmerPhoneNumber,
        [
          { id: 'irrigation_rainfed', title: 'Rainfed' },
          { id: 'irrigation_borewell', title: 'Borewell' },
          { id: 'irrigation_canal', title: 'Canal' },
        ],
        messages[lang].farmSizeSet.replace('${num}', num.toString())
      );
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_IRRIGATION_METHOD ─────────────────────────────────────
    if (user.botState === BotState.AWAITING_IRRIGATION_METHOD) {
      const rawInput: string | null = buttonId ?? textBody;

      if (!rawInput) {
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].selectIrrigation
        );
        res.sendStatus(200);
        return;
      }
      if (rawInput.toLowerCase() === 'cancel') {
        await cancelCropPlan(user, farmerPhoneNumber);
        res.sendStatus(200);
        return;
      }

      const irrigationMap: Record<string, string> = {
        irrigation_rainfed: 'Rainfed',
        irrigation_borewell: 'Borewell',
        irrigation_canal: 'Canal',
        irrigation_drip: 'Drip',
        irrigation_sprinkler: 'Sprinkler',
        rainfed: 'Rainfed',
        borewell: 'Borewell',
        canal: 'Canal',
        drip: 'Drip',
        sprinkler: 'Sprinkler',
      };
      const irrigation = irrigationMap[rawInput.toLowerCase()];
      if (!irrigation) {
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].invalidIrrigation
        );
        res.sendStatus(200);
        return;
      }

      const crop = await CropPlanModel.findOne({ userId: user.id }).sort({ createdAt: -1 });
      if (!crop) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].errorTryAgain);
        user.botState = BotState.IDLE;
        await user.save();
        res.sendStatus(200);
        return;
      }
      crop.irrigationMethod = irrigation as any;
      await crop.save();

      // Check completeness, then run analysis
      if (!isCropPlanIncomplete(crop as any)) {
        await sendTextMessage(farmerPhoneNumber, messages[lang].analysingCropPlan);
        const analysis = await cropPlanAnalysis(crop as any, user.id, lang);
        await sendTextMessage(farmerPhoneNumber, messages[lang].cropPlanAnalysis.replace('${analysis}', analysis));
      } else {
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].cropPlanIncomplete
        );
      }
      user.botState = BotState.IDLE;
      await user.save();
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_MANDI_SELECTION ──────────────────────────────────────
    if (user.botState === BotState.AWAITING_MANDI_SELECTION) {
      // Cancel via text
      if (textBody?.toLowerCase() === 'cancel') {
        await cancelMandi(user, farmerPhoneNumber);
        res.sendStatus(200);
        return;
      }

      // The only valid input here is a list_reply
      if (!listReplyId) {
        // Re-send the current page (page 1 as fallback)
        await sendMandiProductList(farmerPhoneNumber, user, 1);
        res.sendStatus(200);
        return;
      }

      // ── "More" pagination: id = "more;<nextPage>" ──────────────────────────
      if (listReplyId.startsWith('more;')) {
        const nextPage = parseInt(listReplyId.split(';')[1], 10);
        await sendMandiProductList(farmerPhoneNumber, user, nextPage);
        res.sendStatus(200);
        return;
      }

      // ── Commodity selected: id = "<name>;<page>;<apiId>" ──────────────────
      const parts = listReplyId.split(';');
      if (parts.length === 3) {
        const [productName, , productId] = parts;
        const capitalised = productName.charAt(0).toUpperCase() + productName.slice(1);
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].mandiAnalysing.replace('${product}', capitalised)
        );
        const location: GeoLocation =
          user.location ?? { latitude: 0, longitude: 0 };
        const analysis = await getMandiAnalysisForProduct(location, lang, productId);
        await sendTextMessage(
          farmerPhoneNumber,
          messages[lang].mandiAnalysisResult.replace('${analysis}', analysis)
        );
        user.botState = BotState.IDLE;
        await user.save();
        await sendMainMenu(farmerPhoneNumber, lang);
        res.sendStatus(200);
        return;
      }

      // Unexpected format — re-send list
      await sendMandiProductList(farmerPhoneNumber, user, 1);
      res.sendStatus(200);
      return;
    }

    // ── State: IDLE (and fallback) ─────────────────────────────────────────────
    if (buttonId === 'menu_mandi') {
      if (!user.location) {
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
        user.botState = BotState.AWAITING_LOCATION;
        await user.save();
        res.sendStatus(200);
        return;
      }
      user.botState = BotState.AWAITING_MANDI_SELECTION;
      await user.save();
      await sendMandiProductList(farmerPhoneNumber, user, 1);
      res.sendStatus(200);
      return;
    }

    if (buttonId === 'menu_update_details') {
      user.botState = BotState.AWAITING_UPDATE_CHOICE;
      await user.save();
      await sendListMenu(farmerPhoneNumber, updateChoiceOptions[lang], updateChoiceMessage[lang]);
      res.sendStatus(200);
      return;
    }

    if (buttonId === 'menu_crop_plan') {
      await CropPlanModel.create({
        id: randomUUID(),
        userId: user.id,
        cropName: null,
        sowingDate: null,
        farmSizeAcres: null,
        irrigationMethod: null,
      });
      user.botState = BotState.AWAITING_CROP_NAME;
      await user.save();
      await sendTextMessage(
        farmerPhoneNumber,
        messages[lang].createCropPlan
      );
      res.sendStatus(200);
      return;
    }

    // Default: show main menu
    await sendMainMenu(farmerPhoneNumber, lang);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.sendStatus(500);
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse = {
    statusCode: 200,
    data: 'Hello World',
    message: 'Success',
    error: null,
  };
  res.json(response);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
