import { CropPlan } from "../entities/crop_plan";
import { SupportedLanguages } from "../entities/users";

// Simple placeholder analysis — in future call LLM with cropPlan
export async function cropPlanAnalysis(cropPlan: CropPlan, language: SupportedLanguages): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate async operation
    return `try to water the plant daily instead of not watering at all, makadchod`
}