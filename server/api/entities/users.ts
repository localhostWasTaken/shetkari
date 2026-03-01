import { UUID } from "node:crypto";
import { Schema, model, Document } from "mongoose";

interface Location {
    latitude: number;
    longitude: number;
}

export enum SupportedLanguages {
    ENGLISH = "en",
    HINDI = "hi",
    MARATHI = "mr",
}

export enum BotState {
    NEW = "NEW",
    AWAITING_LANGUAGE = "AWAITING_LANGUAGE",
    AWAITING_LOCATION = "AWAITING_LOCATION",
    IDLE = "IDLE",
    AWAITING_UPDATE_CHOICE = "AWAITING_UPDATE_CHOICE",
    AWAITING_NEW_LANGUAGE = "AWAITING_NEW_LANGUAGE",
    AWAITING_NEW_LOCATION = "AWAITING_NEW_LOCATION",
    // Crop plan creation states
    AWAITING_CROP_NAME = "AWAITING_CROP_NAME",
    AWAITING_SOWING_DATE = "AWAITING_SOWING_DATE",
    AWAITING_FARM_SIZE = "AWAITING_FARM_SIZE",
    AWAITING_IRRIGATION_METHOD = "AWAITING_IRRIGATION_METHOD",
    // Mandi states
    AWAITING_MANDI_SELECTION = "AWAITING_MANDI_SELECTION",
}

export interface User {
    id: UUID;
    name: string | null;
    phoneNumber: string;
    email: string | null;

    createdAt: Date;
    updatedAt: Date;

    location: Location | null;
    language: SupportedLanguages | null;
    botState: BotState;
}

export interface UserDocument extends Omit<User, 'id'>, Document {}

const LocationSchema = new Schema<Location>(
    {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
    },
    { _id: false }
);

const UserSchema = new Schema<UserDocument>(
    {
        phoneNumber: { type: String, required: true, unique: true },
        name: { type: String, required: false, default: null },
        email: { type: String, default: null },
        location: { type: LocationSchema, default: null },
        language: {
            type: String,
            enum: Object.values(SupportedLanguages),
            default: null,
        },
        botState: {
            type: String,
            enum: Object.values(BotState),
            default: BotState.NEW,
        },
    },
    { timestamps: true }
);

const UserModel = model<UserDocument>("User", UserSchema);

export default UserModel;