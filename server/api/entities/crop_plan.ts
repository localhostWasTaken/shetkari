import { UUID } from "node:crypto";
import { Schema, model, Document } from "mongoose";

export enum IrrigationMethod {
    Rainfed = "Rainfed",
    Borewell = "Borewell",
    Canal = "Canal",
    Drip = "Drip",
    Sprinkler = "Sprinkler"
}

export interface CropPlan {
    id: UUID;
    userId: UUID;

    cropName: string | null;
    sowingDate: Date | null;
    farmSizeAcres: number | null;
    irrigationMethod: IrrigationMethod | null;
}

export function isCropPlanIncomplete(cropPlan: CropPlan): boolean {
    return (
        !cropPlan.cropName ||
        !cropPlan.sowingDate ||
        cropPlan.farmSizeAcres === null ||
        !cropPlan.irrigationMethod
    );
}

// Mongoose schema & model for persistence
export interface CropPlanDocument extends Omit<CropPlan, 'id'>, Document {}

const CropPlanSchema = new Schema<CropPlanDocument>(
    {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        cropName: { type: String, default: null },
        sowingDate: { type: Date, default: null },
        farmSizeAcres: { type: Number, default: null },
        irrigationMethod: { type: String, enum: Object.values(IrrigationMethod), default: null },
    },
    { timestamps: true }
);

export const CropPlanModel = model<CropPlanDocument>('CropPlan', CropPlanSchema);

export default CropPlanModel;

