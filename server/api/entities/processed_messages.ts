import { Schema, model, Document } from "mongoose";

/**
 * Track processed WhatsApp message IDs to prevent duplicate processing.
 * WhatsApp may send the same webhook multiple times, so we use the message ID
 * for idempotency.
 */
export interface ProcessedMessage {
    messageId: string;  // The WhatsApp message ID (e.g., wamid.HBg...)
    processedAt: Date;  // When we first processed this message
}

export interface ProcessedMessageDocument extends ProcessedMessage, Document {}

const ProcessedMessageSchema = new Schema<ProcessedMessageDocument>(
    {
        messageId: { 
            type: String, 
            required: true, 
            unique: true,
            index: true  // Index for fast lookups
        },
        processedAt: { 
            type: Date, 
            required: true, 
            default: Date.now,
            // TTL index: automatically delete documents after 7 days
            expires: 604800  // 7 days in seconds
        },
    },
    { timestamps: false }
);

const ProcessedMessageModel = model<ProcessedMessageDocument>("ProcessedMessage", ProcessedMessageSchema);

export default ProcessedMessageModel;
