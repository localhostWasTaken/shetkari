// form-data kept for legacy reference; audio upload uses native FormData + Blob

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

export async function uploadAudioToWhatsApp(
  audioBuffer: Buffer,
  mimeType: string = "audio/mpeg"
): Promise<string> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/media`;

  // Copy the Buffer into a plain ArrayBuffer so it satisfies the Blob constructor's
  // BlobPart type (Buffer.buffer can be a SharedArrayBuffer which Blob rejects).
  const arrayBuf = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuf], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, "audio.mp3");
  formData.append("type", mimeType);
  formData.append("messaging_product", "whatsapp");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      // Do NOT set Content-Type manually — fetch sets it with the boundary automatically
    },
    body: formData,
  });

  const data = (await response.json()) as { id?: string };

  if (!response.ok) {
    console.error("Failed to upload media:", JSON.stringify(data, null, 2));
    throw new Error("Failed to upload audio to WhatsApp");
  }

  console.log(`[WhatsApp] Media uploaded, id: ${data.id}`);
  return data.id!;
}

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

export async function sendListMenu(
  recipientNumber: string,
  options: ListOption[],
  body: string
): Promise<void> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const payload = buildListMenuMessage(recipientNumber, options, body);
  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

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
    console.error("Failed to send list menu:", JSON.stringify(data, null, 2));
    throw new Error("Failed to send list menu");
  }

  console.log(`[WhatsApp] List menu sent to ${recipientNumber}`);
}

/**
 * Sends a WhatsApp interactive list message (supports up to 10 rows per section).
 * Use this instead of sendListMenu when you need more than 3 options.
 */
export async function sendInteractiveList(
  recipientNumber: string,
  body: string,
  buttonLabel: string,
  sectionTitle: string,
  rows: { id: string; title: string; description?: string }[]
): Promise<void> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientNumber,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel,
        sections: [
          {
            title: sectionTitle,
            rows: rows.map((r) => ({
              id: r.id,
              title: r.title,
              ...(r.description ? { description: r.description } : {}),
            })),
          },
        ],
      },
    },
  };

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

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
    console.error("Failed to send interactive list:", JSON.stringify(data, null, 2));
    throw new Error("Failed to send interactive list");
  }

  console.log(`[WhatsApp] Interactive list sent to ${recipientNumber}`);
}

/**
 * Sends a plain text message to a WhatsApp user.
 */
export async function sendTextMessage(
  recipientNumber: string,
  text: string
): Promise<void> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    type: "text",
    text: { body: text },
  };

  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

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
    console.error("Failed to send text message:", JSON.stringify(data, null, 2));
    throw new Error("Failed to send text message");
  }

  console.log(`[WhatsApp] Text message sent to ${recipientNumber}`);
}