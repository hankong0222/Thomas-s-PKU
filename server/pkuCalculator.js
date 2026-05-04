const DEFAULT_LIMITS = {
  mealPheLimit: 250,
  dailyPheLimit: 500,
  previousDayPhe: 220,
};

const PHE_PER_100G = [
  { pattern: /chicken|beef|pork|fish|turkey|meat/i, value: 930 },
  { pattern: /egg/i, value: 690 },
  { pattern: /cheese/i, value: 720 },
  { pattern: /milk|yogurt/i, value: 160 },
  { pattern: /rice/i, value: 90 },
  { pattern: /pasta/i, value: 120 },
  { pattern: /bread/i, value: 220 },
  { pattern: /potato/i, value: 73 },
  { pattern: /broccoli/i, value: 38 },
  { pattern: /apple|fruit/i, value: 8 },
  { pattern: /mushroom/i, value: 48 },
  { pattern: /cauliflower/i, value: 32 },
  { pattern: /low protein/i, value: 22 },
];

function estimatePhe(ingredient) {
  if (Number.isFinite(Number(ingredient.phe))) {
    return Number(ingredient.phe);
  }

  const grams = Number(ingredient.grams || 100);
  const match = PHE_PER_100G.find((entry) => entry.pattern.test(ingredient.name || ""));
  const phePer100g = ingredient.phePer100g || match?.value || 100;
  return Math.round((phePer100g * grams) / 100);
}

export function calculatePkuMeal({ ingredients = [], limits = DEFAULT_LIMITS }) {
  const calculatedIngredients = ingredients.map((ingredient) => ({
    ...ingredient,
    phe: estimatePhe(ingredient),
  }));
  const mealPhe = calculatedIngredients.reduce((sum, ingredient) => sum + ingredient.phe, 0);
  const dayPhe = Number(limits.previousDayPhe || 0) + mealPhe;
  const overMealLimit = mealPhe > limits.mealPheLimit;
  const overDailyLimit = dayPhe > limits.dailyPheLimit;

  return {
    mealPhe,
    dayPhe,
    previousDayPhe: limits.previousDayPhe,
    mealPheLimit: limits.mealPheLimit,
    dailyPheLimit: limits.dailyPheLimit,
    overMealLimit,
    overDailyLimit,
    alert: overMealLimit || overDailyLimit,
    status: overMealLimit || overDailyLimit ? "Over limit" : "Within assumed PKU limit",
    note: "Fake calculator for a typical PKU patient assumption. Do not use clinically.",
    ingredients: calculatedIngredients,
  };
}
