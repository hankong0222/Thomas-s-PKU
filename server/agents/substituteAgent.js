import { createStructuredResponse } from "../openaiClient.js";

const substituteSchema = {
  name: "ingredient_substitute_result",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      rationale: { type: "string" },
      expectedPheReductionPercent: { type: "number", minimum: 0, maximum: 100 },
      servingNote: { type: "string" },
    },
    required: ["name", "rationale", "expectedPheReductionPercent", "servingNote"],
  },
};

export async function recommendSubstitute({ ingredients = [], calculation = null }) {
  if (!ingredients.length) {
    return null;
  }

  const target = [...ingredients].sort((a, b) => b.phe - a.phe)[0];
  const result = await createStructuredResponse({
    instructions:
      "You are a food substitution agent for a PKU meal tracker. Recommend a lower-phenylalanine substitute for the highest-PHE ingredient. Keep the recommendation practical and food-like. Do not provide medical advice.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              targetIngredient: target,
              mealIngredients: ingredients,
              calculation,
              desiredOutput:
                "Recommend one lower-PHE substitute ingredient for the target ingredient.",
            }),
          },
        ],
      },
    ],
    schema: substituteSchema,
  });

  const reduction = Math.min(95, Math.max(0, Number(result.data.expectedPheReductionPercent || 65)));
  const phe = Math.max(1, Math.round(target.phe * (1 - reduction / 100)));
  const grams = Number(target.grams || 100);

  return {
    originalIngredientId: target.id,
    originalName: target.name,
    name: result.data.name,
    grams,
    phePer100g: Math.round((phe / grams) * 100),
    phe,
    expectedPheReductionPercent: reduction,
    rationale: result.data.rationale,
    servingNote: result.data.servingNote,
    agentNote: `Real OpenAI substitute result from ${result.model}. Response: ${result.responseId}`,
  };
}
