import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ApiResponse from './models/apiResponse';
import { sendListMenu, sendTextMessage, sendLongTextMessage, sendInteractiveList, uploadAudioToWhatsApp, sendAudioMessage } from './utils/whatsapp';
import UserModel, { BotState, SupportedLanguages } from './entities/users';
import CropPlanModel, { isCropPlanIncomplete } from './entities/crop_plan';
import ProcessedMessageModel from './entities/processed_messages';
import { cropPlanAnalysis } from './utils/crop_plan_analysis';
import { getMandiProductsForUser, getMandiAnalysisForProduct, GeoLocation } from './utils/mandi_analysis';
import { textToSpeech } from './utils/elevenlabs';
import { randomUUID } from 'node:crypto';

// ─── Static message tables ────────────────────────────────────────────────────

const locationRequestMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "To get started, share your farm's location.\nTap the attachment icon and select Location.",
  [SupportedLanguages.HINDI]: "शुरू करने के लिए, अपने खेत की लोकेशन शेयर करें।\nअटैचमेंट आइकन दबाएं और Location चुनें।",
  [SupportedLanguages.MARATHI]: "सुरू करण्यासाठी, तुमच्या शेताचे स्थान शेअर करा।\nअटॅचमेंट चिन्हावर टॅप करा आणि Location निवडा.",
};

const locationSavedMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Got it — your location has been saved.",
  [SupportedLanguages.HINDI]: "हो गया — आपकी लोकेशन सेव हो गई है।",
  [SupportedLanguages.MARATHI]: "झाले — तुमचे स्थान सेव्ह झाले आहे.",
};

const updateChoiceMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "What would you like to update?",
  [SupportedLanguages.HINDI]: "आप क्या अपडेट करना चाहते हैं?",
  [SupportedLanguages.MARATHI]: "तुम्हाला काय अपडेट करायचे आहे?",
};

const voicePreferenceMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "One last thing — would you like audio summaries along with your Mandi prices and crop plan results?\n\nSelect *Yes* to receive voice messages, or *No* for text only.",
  [SupportedLanguages.HINDI]: "एक आखिरी सवाल — क्या आप मंडी भाव और फसल योजना के साथ ऑडियो सारांश भी चाहते हैं?\n\nआवाज़ संदेश के लिए *हाँ* चुनें, या केवल टेक्स्ट के लिए *नहीं*।",
  [SupportedLanguages.MARATHI]: "एक शेवटची गोष्ट — मंडी भाव आणि पीक योजनेसोबत ऑडिओ सारांश हवा आहे का?\n\nआवाज संदेशासाठी *होय* निवडा, किंवा फक्त मजकुरासाठी *नाही*.",
};

const voiceEnabledMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Voice summaries are on. You'll hear audio for Mandi prices and crop plans. 🔊",
  [SupportedLanguages.HINDI]: "आवाज़ सारांश चालू है। मंडी भाव और फसल योजना के लिए ऑडियो मिलेगा। 🔊",
  [SupportedLanguages.MARATHI]: "आवाज सारांश सुरू आहे. मंडी भाव आणि पीक योजनेसाठी ऑडिओ मिळेल. 🔊",
};

const voiceDisabledMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Got it — text only from here on.",
  [SupportedLanguages.HINDI]: "ठीक है — अब केवल टेक्स्ट में जवाब मिलेगा।",
  [SupportedLanguages.MARATHI]: "ठीक आहे — आता फक्त मजकूर मिळेल.",
};

const voicePreferenceOptions: Record<SupportedLanguages, { id: string; title: string }[]> = {
  [SupportedLanguages.ENGLISH]: [
    { id: "voice_yes", title: "Yes, I want voice 🔊" },
    { id: "voice_no", title: "No, text only 📝" },
  ],
  [SupportedLanguages.HINDI]: [
    { id: "voice_yes", title: "हाँ, आवाज़ चाहिए 🔊" },
    { id: "voice_no", title: "नहीं, केवल टेक्स्ट 📝" },
  ],
  [SupportedLanguages.MARATHI]: [
    { id: "voice_yes", title: "होय, आवाज हवी 🔊" },
    { id: "voice_no", title: "नाही, फक्त मजकूर 📝" },
  ],
};

const updateChoiceOptions: Record<SupportedLanguages, { id: string; title: string }[]> = {
  [SupportedLanguages.ENGLISH]: [
    { id: "update_language", title: "Language" },
    { id: "update_location", title: "Location" },
    { id: "update_voice", title: "Voice Analysis" },
  ],
  [SupportedLanguages.HINDI]: [
    { id: "update_language", title: "भाषा" },
    { id: "update_location", title: "लोकेशन" },
    { id: "update_voice", title: "आवाज़ विश्लेषण" },
  ],
  [SupportedLanguages.MARATHI]: [
    { id: "update_language", title: "भाषा" },
    { id: "update_location", title: "स्थान" },
    { id: "update_voice", title: "आवाज विश्लेषण" },
  ],
};


const languageUpdatedMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Language updated successfully.",
  [SupportedLanguages.HINDI]: "भाषा सफलतापूर्वक अपडेट हो गई।",
  [SupportedLanguages.MARATHI]: "भाषा यशस्वीरित्या अपडेट झाली.",
};

const locationUpdatedMessage: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "Location updated successfully.",
  [SupportedLanguages.HINDI]: "लोकेशन सफलतापूर्वक अपडेट हो गई।",
  [SupportedLanguages.MARATHI]: "स्थान यशस्वीरित्या अपडेट झाले.",
};

const mainMenu: Record<SupportedLanguages, { body: string; options: { id: string; title: string }[] }> = {
  [SupportedLanguages.ENGLISH]: {
    body: "Welcome to Shetkari — your smart farming assistant.\n\nWhat would you like to do?",
    options: [
      { id: "menu_mandi", title: "Mandi Prices" },
      { id: "menu_crop_plan", title: "Crop Planning" },
      { id: "menu_update_details", title: "Update Details" },
    ],
  },
  [SupportedLanguages.HINDI]: {
    body: "शेतकरी में आपका स्वागत है — आपका स्मार्ट खेती सहायक।\n\nआप क्या करना चाहते हैं?",
    options: [
      { id: "menu_mandi", title: "मंडी भाव" },
      { id: "menu_crop_plan", title: "फसल योजना" },
      { id: "menu_update_details", title: "विवरण अपडेट करें" },
    ],
  },
  [SupportedLanguages.MARATHI]: {
    body: "शेतकरीमध्ये आपले स्वागत आहे — तुमचा स्मार्ट शेती सहाय्यक.\n\nतुम्हाला काय करायचे आहे?",
    options: [
      { id: "menu_mandi", title: "मंडी भाव" },
      { id: "menu_crop_plan", title: "पीक नियोजन" },
      { id: "menu_update_details", title: "तपशील अपडेट करा" },
    ],
  },
};

const messages: Record<SupportedLanguages, Record<string, string>> = {
  [SupportedLanguages.ENGLISH]: {
    cropCreationCancelled: "Crop plan cancelled. Back to the main menu.",
    welcomeMessage: "Welcome to Shetkari — your smart farming assistant.\n\nPlease choose your language to get started.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा.",
    selectLanguage: "Please select your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा.",
    selectNewLanguage: "Select your new language / नई भाषा चुनें / नवीन भाषा निवडा.",
    enterCropName: "What crop are you planning to grow? (e.g. Wheat, Rice, Cotton)\n\nType \"cancel\" at any time to go back.",
    errorTryAgain: "Something went wrong. Please try again from the main menu.",
    enterSowingDate: "When did you sow the crop?\n\nAccepted formats: \"March 15\", \"15/03/2026\", \"15-3-2026\"\n\nOr type \"cancel\" to go back.",
    enterSowingDatePrompt: "Please enter the sowing date (e.g. 15-3-2026), or type \"cancel\".",
    invalidDate: "That doesn't look like a valid date. Try something like \"15-3-2026\" or \"March 15th\", or type \"cancel\".",
    sowingDateSet: "Sowing date set to ${date}.\n\nHow large is your farm? Enter the size in acres (e.g. 2.5), or type \"cancel\".",
    enterFarmSize: "Enter your farm size in acres (e.g. 2.5), or type \"cancel\".",
    invalidNumber: "That doesn't look like a valid number. Enter the farm size in acres (e.g. 2.5), or type \"cancel\".",
    farmSizeSet: "Farm size set to ${num} acres.\n\nNow select the irrigation method you use.",
    selectIrrigation: "Select your irrigation method, or type \"cancel\".",
    invalidIrrigation: "Please choose from the list: Rainfed, Borewell, Canal, Drip, or Sprinkler — or type \"cancel\".",
    irrigationSelectButton: "Select Method",
    irrigationSectionTitle: "Irrigation Methods",
    analysingCropPlan: "Analysing your crop plan — this will just take a moment.",
    cropPlanAnalysis: "Crop Plan Analysis\n\n${analysis}",
    cropPlanIncomplete: "Your crop plan was saved but a few details are missing. Please create a new one from the main menu.",
    createCropPlan: "Let's build your crop plan.\n\nWhat crop are you planning to grow? (e.g. Wheat, Rice, Cotton)\n\nType \"cancel\" at any time to abort.",
    mandiSelectCommodity: "Select a commodity to check its mandi prices.\n\nType \"cancel\" to go back.",
    mandiSelectButton: "View Commodities",
    mandiSectionTitle: "Commodities",
    mandiMoreOption: "More →",
    mandiNoMore: "No more commodities to show.\nSelect from the list above, or type \"cancel\" to go back.",
    mandiCancelled: "Mandi price check cancelled. Back to the main menu.",
    mandiAnalysing: "Fetching mandi prices for ${product} — just a moment.",
    mandiAnalysisResult: "Mandi Price Analysis\n\n${analysis}",
  },
  [SupportedLanguages.HINDI]: {
    cropCreationCancelled: "फसल योजना रद्द कर दी गई। मुख्य मेनू पर वापस आ गए।",
    welcomeMessage: "Welcome to Shetkari — your smart farming assistant.\n\nPlease choose your language to get started.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा.",
    selectLanguage: "Please select your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा.",
    selectNewLanguage: "Select your new language / नई भाषा चुनें / नवीन भाषा निवडा.",
    enterCropName: "आप कौन सी फसल उगाने की योजना बना रहे हैं? (जैसे गेहूं, चावल, कपास)\n\nकभी भी \"cancel\" टाइप करके वापस जा सकते हैं।",
    errorTryAgain: "कुछ गलत हो गया। कृपया मुख्य मेनू से फिर से प्रयास करें।",
    enterSowingDate: "फसल की बोवनी कब की?\n\nस्वीकृत प्रारूप: \"March 15\", \"15/03/2026\", \"15-3-2026\"\n\nया \"cancel\" टाइप करके वापस जाएं।",
    enterSowingDatePrompt: "बोवनी की तारीख दर्ज करें (जैसे 15-3-2026), या \"cancel\" टाइप करें।",
    invalidDate: "यह एक वैध तारीख नहीं लगती। कुछ ऐसा लिखें: \"15-3-2026\" या \"March 15th\", या \"cancel\" टाइप करें।",
    sowingDateSet: "बोवनी की तारीख ${date} पर सेट हो गई।\n\nआपके खेत का आकार कितना है? एकड़ में दर्ज करें (जैसे 2.5), या \"cancel\" टाइप करें।",
    enterFarmSize: "खेत का आकार एकड़ में दर्ज करें (जैसे 2.5), या \"cancel\" टाइप करें।",
    invalidNumber: "यह एक वैध संख्या नहीं लगती। खेत का आकार एकड़ में दर्ज करें (जैसे 2.5), या \"cancel\" टाइप करें।",
    farmSizeSet: "खेत का आकार ${num} एकड़ पर सेट हो गया।\n\nअब अपनी सिंचाई विधि चुनें।",
    selectIrrigation: "अपनी सिंचाई विधि चुनें, या \"cancel\" टाइप करें।",
    invalidIrrigation: "कृपया सूची में से चुनें: वर्षाधारित, बोरवेल, नहर, ड्रिप, या छिड़काव — या \"cancel\" टाइप करें।",
    irrigationSelectButton: "विधि चुनें",
    irrigationSectionTitle: "सिंचाई विधियाँ",
    analysingCropPlan: "आपकी फसल योजना का विश्लेषण हो रहा है — बस एक पल।",
    cropPlanAnalysis: "फसल योजना विश्लेषण\n\n${analysis}",
    cropPlanIncomplete: "फसल योजना सेव हो गई, लेकिन कुछ जानकारी गायब है। कृपया मुख्य मेनू से नई योजना बनाएं।",
    createCropPlan: "आइए आपकी फसल योजना तैयार करते हैं।\n\nआप कौन सी फसल उगाना चाहते हैं? (जैसे गेहूं, चावल, कपास)\n\nकभी भी \"cancel\" टाइप करके रद्द कर सकते हैं।",
    mandiSelectCommodity: "मंडी भाव देखने के लिए एक वस्तु चुनें।\n\nवापस जाने के लिए \"cancel\" टाइप करें।",
    mandiSelectButton: "वस्तुएं देखें",
    mandiSectionTitle: "वस्तुएं",
    mandiMoreOption: "और देखें →",
    mandiNoMore: "कोई और वस्तु उपलब्ध नहीं।\nऊपर की सूची से चुनें, या \"cancel\" टाइप करके वापस जाएं।",
    mandiCancelled: "मंडी भाव जांच रद्द हो गई। मुख्य मेनू पर वापस आ गए।",
    mandiAnalysing: "${product} के लिए मंडी भाव लाए जा रहे हैं — एक पल रुकें।",
    mandiAnalysisResult: "मंडी भाव विश्लेषण\n\n${analysis}",
  },
  [SupportedLanguages.MARATHI]: {
    cropCreationCancelled: "पीक योजना रद्द केली. मुख्य मेनूवर परत आलो.",
    welcomeMessage: "Welcome to Shetkari — your smart farming assistant.\n\nPlease choose your language to get started.\nकृपया अपनी भाषा चुनें।\nकृपया तुमची भाषा निवडा.",
    selectLanguage: "Please select your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा.",
    selectNewLanguage: "Select your new language / नई भाषा चुनें / नवीन भाषा निवडा.",
    enterCropName: "तुम्ही कोणते पीक घेण्याचा विचार करत आहात? (उदा. गहू, तांदूळ, कापूस)\n\nकधीही \"cancel\" टाइप करून मागे जाऊ शकता.",
    errorTryAgain: "काहीतरी चुकले. कृपया मुख्य मेनूमधून पुन्हा प्रयत्न करा.",
    enterSowingDate: "पेरणी कधी केली?\n\nस्वीकृत स्वरूप: \"March 15\", \"15/03/2026\", \"15-3-2026\"\n\nकिंवा \"cancel\" टाइप करून मागे जा.",
    enterSowingDatePrompt: "पेरणीची तारीख प्रविष्ट करा (उदा. 15-3-2026), किंवा \"cancel\" टाइप करा.",
    invalidDate: "ही वैध तारीख वाटत नाही. असे लिहा: \"15-3-2026\" किंवा \"March 15th\", किंवा \"cancel\" टाइप करा.",
    sowingDateSet: "पेरणीची तारीख ${date} सेट झाली.\n\nतुमच्या शेताचा आकार किती आहे? एकरमध्ये प्रविष्ट करा (उदा. 2.5), किंवा \"cancel\" टाइप करा.",
    enterFarmSize: "शेताचा आकार एकरमध्ये प्रविष्ट करा (उदा. 2.5), किंवा \"cancel\" टाइप करा.",
    invalidNumber: "हा वैध आकडा वाटत नाही. शेताचा आकार एकरमध्ये प्रविष्ट करा (उदा. 2.5), किंवा \"cancel\" टाइप करा.",
    farmSizeSet: "शेताचा आकार ${num} एकर सेट झाला.\n\nआता तुमची सिंचन पद्धत निवडा.",
    selectIrrigation: "तुमची सिंचन पद्धत निवडा, किंवा \"cancel\" टाइप करा.",
    invalidIrrigation: "कृपया यादीतून निवडा: पावसावर अवलंबित, बोअरवेल, कालवा, ठिबक, किंवा तुषार — किंवा \"cancel\" टाइप करा.",
    irrigationSelectButton: "पद्धत निवडा",
    irrigationSectionTitle: "सिंचन पद्धती",
    analysingCropPlan: "तुमच्या पीक योजनेचे विश्लेषण होत आहे — एक क्षण.",
    cropPlanAnalysis: "पीक योजना विश्लेषण\n\n${analysis}",
    cropPlanIncomplete: "पीक योजना सेव्ह झाली, पण काही माहिती गहाळ आहे. कृपया मुख्य मेनूमधून नवीन योजना तयार करा.",
    createCropPlan: "चला तुमची पीक योजना तयार करूया.\n\nतुम्ही कोणते पीक घेणार आहात? (उदा. गहू, तांदूळ, कापूस)\n\nकधीही \"cancel\" टाइप करून रद्द करू शकता.",
    mandiSelectCommodity: "मंडी भाव पाहण्यासाठी एक वस्तू निवडा.\n\nमागे जाण्यासाठी \"cancel\" टाइप करा.",
    mandiSelectButton: "वस्तू पहा",
    mandiSectionTitle: "वस्तू",
    mandiMoreOption: "आणखी पहा →",
    mandiNoMore: "आणखी वस्तू नाहीत.\nवरील यादीतून निवडा, किंवा \"cancel\" टाइप करून मागे जा.",
    mandiCancelled: "मंडी भाव तपासणी रद्द केली. मुख्य मेनूवर परत आलो.",
    mandiAnalysing: "${product} साठी मंडी भाव मिळवले जात आहेत — एक क्षण.",
    mandiAnalysisResult: "मंडी भाव विश्लेषण\n\n${analysis}",
  },
};

// ─── Irrigation options (multilingual) ───────────────────────────────────────

const irrigationOptions: Record<SupportedLanguages, { id: string; title: string }[]> = {
  [SupportedLanguages.ENGLISH]: [
    { id: 'irrigation_rainfed', title: 'Rainfed' },
    { id: 'irrigation_borewell', title: 'Borewell' },
    { id: 'irrigation_canal', title: 'Canal' },
    { id: 'irrigation_drip', title: 'Drip' },
    { id: 'irrigation_sprinkler', title: 'Sprinkler' },
  ],
  [SupportedLanguages.HINDI]: [
    { id: 'irrigation_rainfed', title: 'वर्षाधारित (Rainfed)' },
    { id: 'irrigation_borewell', title: 'बोरवेल (Borewell)' },
    { id: 'irrigation_canal', title: 'नहर (Canal)' },
    { id: 'irrigation_drip', title: 'ड्रिप (Drip)' },
    { id: 'irrigation_sprinkler', title: 'छिड़काव (Sprinkler)' },
  ],
  [SupportedLanguages.MARATHI]: [
    { id: 'irrigation_rainfed', title: 'पावसावर अवलंबित' },
    { id: 'irrigation_borewell', title: 'बोअरवेल' },
    { id: 'irrigation_canal', title: 'कालवा' },
    { id: 'irrigation_drip', title: 'ठिबक सिंचन' },
    { id: 'irrigation_sprinkler', title: 'तुषार सिंचन' },
  ],
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

/**
 * If the user has voice analysis enabled, convert `text` to speech via
 * ElevenLabs and send the resulting audio as a WhatsApp audio message.
 * Errors are caught and logged so they never block the text response.
 */
async function sendVoiceIfEnabled(
  phone: string,
  text: string,
  lang: SupportedLanguages,
  user: any
): Promise<void> {
  if (!user.voiceEnabled) return;
  try {
    console.log(`[Voice] Generating TTS for ${phone}, lang=${lang}`);
    const audioBuffer = await textToSpeech(text, lang);
    const mediaId = await uploadAudioToWhatsApp(audioBuffer, 'audio/mpeg');
    await sendAudioMessage(phone, mediaId);
    console.log(`[Voice] Audio message sent to ${phone}`);
  } catch (err) {
    console.error('[Voice] Failed to send voice message:', err);
  }
}

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

    // ── Idempotency check ─────────────────────────────────────────────────────
    const messageId: string = value.messages[0].id;
    
    // Check if we've already processed this message
    const alreadyProcessed = await ProcessedMessageModel.findOne({ messageId });
    if (alreadyProcessed) {
      console.log(`[Idempotency] Message ${messageId} already processed at ${alreadyProcessed.processedAt}, skipping.`);
      res.sendStatus(200);
      return;
    }

    // Mark this message as processed (optimistic locking - do this early)
    try {
      await ProcessedMessageModel.create({ messageId, processedAt: new Date() });
      console.log(`[Idempotency] Message ${messageId} marked as processed.`);
    } catch (err: any) {
      // If we get a duplicate key error, another process already handled this
      if (err.code === 11000) {
        console.log(`[Idempotency] Message ${messageId} was processed by another instance, skipping.`);
        res.sendStatus(200);
        return;
      }
      throw err; // Re-throw other errors
    }

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
        user.botState = BotState.AWAITING_VOICE_PREFERENCE;
        await user.save();
        await sendListMenu(
          farmerPhoneNumber,
          voicePreferenceOptions[lang],
          voicePreferenceMessage[lang]
        );
      } else {
        await sendTextMessage(farmerPhoneNumber, locationRequestMessage[lang]);
      }
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_VOICE_PREFERENCE (onboarding) ────────────────────────
    if (user.botState === BotState.AWAITING_VOICE_PREFERENCE) {
      if (buttonId === 'voice_yes' || buttonId === 'voice_no') {
        user.voiceEnabled = buttonId === 'voice_yes';
        user.botState = BotState.IDLE;
        await user.save();
        const confirmMsg = user.voiceEnabled ? voiceEnabledMessage[lang] : voiceDisabledMessage[lang];
        await sendTextMessage(farmerPhoneNumber, locationSavedMessage[lang]);
        await sendTextMessage(farmerPhoneNumber, confirmMsg);
        await sendMainMenu(farmerPhoneNumber, lang);
      } else {
        // Re-prompt if unexpected input
        await sendListMenu(farmerPhoneNumber, voicePreferenceOptions[lang], voicePreferenceMessage[lang]);
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
      } else if (buttonId === 'update_voice') {
        user.botState = BotState.AWAITING_NEW_VOICE_PREFERENCE;
        await user.save();
        await sendListMenu(farmerPhoneNumber, voicePreferenceOptions[lang], voicePreferenceMessage[lang]);
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

    // ── State: AWAITING_NEW_VOICE_PREFERENCE ──────────────────────────────────
    if (user.botState === BotState.AWAITING_NEW_VOICE_PREFERENCE) {
      if (buttonId === 'voice_yes' || buttonId === 'voice_no') {
        user.voiceEnabled = buttonId === 'voice_yes';
        user.botState = BotState.IDLE;
        await user.save();
        const confirmMsg = user.voiceEnabled ? voiceEnabledMessage[lang] : voiceDisabledMessage[lang];
        await sendTextMessage(farmerPhoneNumber, confirmMsg);
        await sendMainMenu(farmerPhoneNumber, lang);
      } else {
        await sendListMenu(farmerPhoneNumber, voicePreferenceOptions[lang], voicePreferenceMessage[lang]);
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
      // Use interactive list to show all 5 irrigation options at once
      await sendInteractiveList(
        farmerPhoneNumber,
        messages[lang].farmSizeSet.replace('${num}', num.toString()),
        messages[lang].irrigationSelectButton,
        messages[lang].irrigationSectionTitle,
        irrigationOptions[lang]
      );
      res.sendStatus(200);
      return;
    }

    // ── State: AWAITING_IRRIGATION_METHOD ─────────────────────────────────────
    if (user.botState === BotState.AWAITING_IRRIGATION_METHOD) {
      // list_reply comes from the interactive list; also accept plain text fallback
      const rawInput: string | null = listReplyId ?? textBody;

      if (!rawInput) {
        // Re-send the interactive list
        await sendInteractiveList(
          farmerPhoneNumber,
          messages[lang].selectIrrigation,
          messages[lang].irrigationSelectButton,
          messages[lang].irrigationSectionTitle,
          irrigationOptions[lang]
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
        const cropPlanText = messages[lang].cropPlanAnalysis.replace('${analysis}', analysis);
        await sendTextMessage(farmerPhoneNumber, cropPlanText);
        await sendVoiceIfEnabled(farmerPhoneNumber, cropPlanText, lang, user);
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
        // Send the AI-generated advisory directly (it already contains its own header).
        // Use sendLongTextMessage to chunk at paragraph boundaries if > 4000 chars.
        await sendLongTextMessage(farmerPhoneNumber, analysis);
        await sendVoiceIfEnabled(farmerPhoneNumber, analysis, lang, user);
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
