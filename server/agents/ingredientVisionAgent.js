import { createStructuredResponse } from "../openaiClient.js";

const visionSchema = {
  name: "ingredient_vision_result",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      category: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      visualEvidence: { type: "string" },
      possibleAlternatives: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["name", "category", "confidence", "visualEvidence", "possibleAlternatives"],
  },
};

export async function analyzeIngredientImage({
  fileName = "meal-image",
  imageDataUrl,
  weightGrams = 100,
}) {
  if (!imageDataUrl) {
    throw new Error("imageDataUrl is required for real ingredient vision analysis.");
  }

  const grams = Number(weightGrams) > 0 ? Number(weightGrams) : 100;
  const result = await createStructuredResponse({
    instructions:
      "You are an ingredient vision agent for a PKU meal tracker. Identify the main visible ingredient in the image. Return one ingredient name suitable for nutrition lookup. Do not provide medical advice.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this ingredient image. File name: ${fileName}. Total provided weight: ${grams} g.`,
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "auto",
          },
        ],
      },
    ],
    schema: visionSchema,
  });

  return {
    id: `ing-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    name: result.data.name,
    category: result.data.category,
    sourceFile: fileName,
    grams,
    confidence: result.data.confidence,
    visualEvidence: result.data.visualEvidence,
    possibleAlternatives: result.data.possibleAlternatives,
    agentNote: `Real OpenAI vision result from ${result.model}. Response: ${result.responseId}`,
  };
}
