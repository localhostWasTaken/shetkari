import FormData from "form-data";

interface ListOption {
  id: string;
  title: string;
}

interface WhatsAppListMenuPayload {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  interactive: {
    type: string;
    body: {
      text: string;
    };
    action: {
      buttons: {
        type: string;
        reply: {
          id: string;
          title: string;
        };
      }[];
    };
  };
}

export function buildListMenuMessage(
  phoneNumber: string,
  options: ListOption[],
  body: string
): WhatsAppListMenuPayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: body
      },
      action: {
        buttons: options.map((option) => ({
          type: "reply",
          reply: {
            id: option.id,
            title: option.title
          }
        }))
      }
    }
  };
}

/**
 * Uploads an audio buffer to WhatsApp Media API and returns the media ID.
 */
export async function uploadAudioToWhatsApp(
  audioBuffer: Buffer,
  mimeType: string = "audio/mpeg"
): Promise<string> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/media`;

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: "audio.mp3",
    contentType: mimeType,
  });
  formData.append("type", mimeType);
  formData.append("messaging_product", "whatsapp");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  const data = (await response.json()) as { id?: string };

  if (!response.ok) {
    console.error("Failed to upload media:", JSON.stringify(data, null, 2));
    throw new Error("Failed to upload audio to WhatsApp");
  }

  console.log(`[WhatsApp] Media uploaded, id: ${data.id}`);
  return data.id!;
}

/**
 * Sends an audio message to a WhatsApp user using a media ID.
 */
export async function sendAudioMessage(
  recipientNumber: string,
  mediaId: string
): Promise<void> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    type: "audio",
    audio: {
      id: mediaId,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Failed to send audio message:", JSON.stringify(data, null, 2));
    throw new Error("Failed to send audio message");
  }

  console.log(`[WhatsApp] Audio message sent to ${recipientNumber}`);
}
