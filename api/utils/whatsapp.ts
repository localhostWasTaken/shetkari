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
