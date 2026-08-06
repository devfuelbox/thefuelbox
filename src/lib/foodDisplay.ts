// Display metadata for meal-plan ingredients (human name + count unit), kept in
// sync with BASE_ING in src/views/Onboarding/Onboarding.tsx.
interface FoodDisplay {
  n: string;
  unit?: number;
  uname?: string;
}

const FOOD_DISPLAY: Record<string, FoodDisplay> = {
  chicken: { n: "Chicken Breast (cooked)" },
  egg: { n: "Egg", unit: 50, uname: "egg" },
  paneer: { n: "Paneer" },
  soya: { n: "Soya" },
  chickpeas: { n: "Chickpeas (cooked)" },
  sweetpotato: { n: "Sweet Potato (boiled)" },
  banana: { n: "Banana", unit: 120, uname: "pc" },
  rice: { n: "White Rice (cooked)" },
  chapati: { n: "Chapati (whole wheat)", unit: 50, uname: "pc" },
  carrot: { n: "Carrot (raw)" },
  cucumber: { n: "Cucumber (raw)" },
  greenbeans: { n: "Green Beans (cooked)" },
  cabbage: { n: "Cabbage (raw)" },
  cabbageP: { n: "Purple Cabbage (raw)" },
  lettuce: { n: "Lettuce (raw)" },
  paneerDressing: { n: "Paneer Cheese Dressing" },
  broccoli: { n: "Broccoli (cooked)" },
  channaW: { n: "White Channa (cooked)" },
  channaOnions: { n: "Channa with Onions (cooked)" },
  dragonfruit: { n: "Dragon Fruit" },
  orange: { n: "Orange" },
  mango: { n: "Mango" },
  apple: { n: "Apple (with skin)" },
  pomegranate: { n: "Pomegranate" },
  guava: { n: "Guava" },
  papaya: { n: "Papaya" },
  watermelon: { n: "Watermelon" },
  grapes: { n: "Grapes" },
  strawberry: { n: "Strawberry" },
  cherry: { n: "Cherry" },
  bananaReg: { n: "Regular Banana", unit: 120, uname: "pc" },
  bananaNendran: { n: "Nendran Banana", unit: 120, uname: "pc" },
  bananaRed: { n: "Red Banana", unit: 120, uname: "pc" },
  bananaRasthali: { n: "Rasthali Banana", unit: 120, uname: "pc" },
  bananaPoovan: { n: "Poovan Banana", unit: 120, uname: "pc" },
  blackchanna: { n: "Black Channa (cooked)" },
  onion: { n: "Onion (raw)" },
  peanut: { n: "Peanut" },
  beetroot: { n: "Beetroot" },
  weightLossCombo1: { n: "Weight Loss - Combo 1" },
  weightLossCombo2: { n: "Weight Loss - Combo 2" },
  weightLossCombo3: { n: "Weight Loss - Combo 3" },
  weightGainCombo1: { n: "Weight Gain - Combo 1" },
  weightGainCombo2: { n: "Weight Gain - Combo 2" },
  weightGainCombo3: { n: "Weight Gain - Combo 3" },
  muscleGainCombo1: { n: "Muscle Gain - Combo 1" },
  muscleGainCombo2: { n: "Muscle Gain - Combo 2" },
  muscleGainCombo3: { n: "Muscle Gain - Combo 3" },
};

export function foodDisplayName(item: { id?: string; name?: string }): string {
  const d = FOOD_DISPLAY[item.id || ""];
  return d?.n || item.name || item.id || "Unknown";
}

// Formats a meal-plan item with count + weight, e.g.:
//   banana 420g -> "4 pcs Banana (420g)"
//   egg 150g    -> "3 eggs (150g)"
//   chicken 250g -> "Chicken Breast (cooked) (250g)"
export function foodLabel(item: {
  id?: string;
  name?: string;
  g?: number;
  grams?: number;
}): string {
  const d = FOOD_DISPLAY[item.id || ""];
  const g = Number(item.g ?? item.grams ?? 0);
  const name = d?.n || item.name || item.id || "Unknown";
  if (d?.unit && g > 0) {
    const c = Math.round(g / d.unit);
    const qty = `${c} ${d.uname}${c > 1 ? "s" : ""}`;
    const redundant =
      d.uname && name.toLowerCase().includes((d.uname as string).toLowerCase());
    return redundant ? `${qty} (${g}g)` : `${qty} ${name} (${g}g)`;
  }
  return `${name} (${g}g)`;
}
