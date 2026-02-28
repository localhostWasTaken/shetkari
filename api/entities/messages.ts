import { UUID } from "node:crypto";

type MessageType = "text" | "question" | "media" | "location";

interface Option {
  id: string;          // "en", "ar", "fr"
  label: string;       // "English", "Arabic", "French"
  nextStepId: string;  // what step to go to after they pick this
}

interface BaseMessage {
  id: UUID;
  senderId: UUID;
  timestamp: Date;
  type: MessageType; // discriminant
}

interface TextMessage extends BaseMessage {
  type: "text";
  content: string;
}

interface QuestionMessage extends BaseMessage {
  type: "question";
  content: string;         // "Please select your language"
  options: Option[];
}

interface MediaMessage extends BaseMessage {
  type: "media";
  mediaUrl: string;
  mimeType: string;        // "image/jpeg", "application/pdf"
  caption?: string;
}

interface LocationMessage extends BaseMessage {
  type: "location";
  latitude: number;
  longitude: number;
  label?: string;
}

type Message = TextMessage | QuestionMessage | MediaMessage | LocationMessage;