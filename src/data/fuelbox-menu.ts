export interface FuelBoxFood {
  id: string;
  name: string;
  category: "breakfast" | "lunch" | "dinner" | "snack";
  group: "protein" | "grain" | "vegetable" | "fruit" | "legume" | "dairy" | "nuts";
  emoji: string; // small visual
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number; // mg
  serving: string;
  tags: string[];
}

// Values from Untitled spreadsheet (per 100 g unless noted).
// Category & emoji mapped per food group.
type RawRow = [string, number, number, number, number, number];

const RAW: RawRow[] = [
  ["Chicken Breast (cooked)", 165, 31, 0, 3.6, 0],
  ["Paneer", 275, 19, 2.4, 15, 0],
  ["Chickpeas (cooked)", 164, 8.9, 27.4, 2.6, 7.6],
  ["Sweet Potato (boiled)", 76, 1.4, 17.7, 0.1, 2.5],
  ["Banana", 89, 1.1, 22.8, 0.3, 2.6],
  ["White Rice (cooked)", 130, 2.7, 28, 0.3, 0.4],
  ["Chapati (whole wheat)", 299, 7.9, 46, 9.2, 9.7],
  ["Egg", 155, 13, 1.1, 11, 0],
  ["Carrot (raw)", 41, 0.9, 9.6, 0.2, 2.8],
  ["Cucumber (raw)", 16, 0.7, 3.6, 0.1, 0.5],
  ["Green Beans (cooked)", 35, 1.9, 7.9, 0.3, 3.2],
  ["Cabbage (raw)", 25, 1.3, 5.8, 0.1, 2.5],
  ["Purple Cabbage (raw)", 31, 1.4, 7.4, 0.2, 2.1],
  ["Lettuce (raw)", 15, 1.4, 2.9, 0.2, 1.3],
  ["Paneer Cheese Dressing", 240, 12, 5, 19.5, 0.2],
  ["Broccoli (cooked)", 35, 2.4, 7.2, 0.4, 3.3],
  ["Channa with Onions (cooked)", 140, 7.5, 22, 2.2, 6.4],
  ["Dragon Fruit", 60, 1.2, 13, 0, 2.9],
  ["Orange", 47, 0.9, 11.8, 0.1, 2.4],
  ["Mango", 60, 0.8, 15, 0.4, 1.6],
  ["Apple (with skin)", 52, 0.3, 13.8, 0.2, 2.4],
  ["Pomegranate", 75, 1.1, 18.7, 0.7, 4],
  ["Guava", 68, 2.6, 14.3, 1, 5.4],
  ["Papaya", 43, 0.5, 10.8, 0.3, 1.7],
  ["Watermelon", 30, 0.6, 7.6, 0.2, 0.4],
  ["Grapes", 69, 0.7, 18.1, 0.2, 0.9],
  ["Strawberry", 32, 0.7, 7.7, 0.3, 2],
  ["Cherry", 50, 1, 12.2, 0.3, 1.6],
  ["Regular Banana", 89, 1.1, 22.8, 0.3, 2.6],
  ["Nendran Banana", 95, 1.2, 24, 0.3, 2.6],
  ["Red Banana", 92, 1.3, 21, 0.3, 3],
  ["Rasthali Banana", 90, 1.1, 23.2, 0.3, 2.6],
  ["Poovan Banana", 104, 1.2, 26, 0.3, 2.6],
  ["Black Channa (cooked)", 130, 6, 21, 2, 5.5],
  ["White Channa (cooked)", 164, 8.9, 27.4, 2.6, 7.6],
  ["Onion (raw)", 40, 1.1, 9.3, 0.1, 1.7],
  ["Soya", 345, 52, 33, 0.5, 13],
  ["Beetroot", 43, 1.6, 9.6, 0.2, 2.8],
  ["Peanut", 567, 25.8, 16.1, 49.2, 8.5],
];

export const META: Record<string, { emoji: string; group: FuelBoxFood["group"]; category: FuelBoxFood["category"]; tags?: string[] }> = {
  "Chicken Breast (cooked)": { emoji: "🍗", group: "protein", category: "lunch", tags: ["high-protein", "lean"] },
  "Paneer": { emoji: "🧀", group: "dairy", category: "dinner", tags: ["high-protein"] },
  "Chickpeas (cooked)": { emoji: "🫘", group: "legume", category: "lunch", tags: ["fiber", "vegan"] },
  "Sweet Potato (boiled)": { emoji: "🍠", group: "vegetable", category: "lunch", tags: ["complex-carbs"] },
  "Banana": { emoji: "🍌", group: "fruit", category: "snack", tags: ["energy"] },
  "White Rice (cooked)": { emoji: "🍚", group: "grain", category: "lunch", tags: ["carbs"] },
  "Chapati (whole wheat)": { emoji: "🫓", group: "grain", category: "dinner", tags: ["fiber"] },
  "Egg": { emoji: "🥚", group: "protein", category: "breakfast", tags: ["high-protein"] },
  "Carrot (raw)": { emoji: "🥕", group: "vegetable", category: "snack", tags: ["low-cal"] },
  "Cucumber (raw)": { emoji: "🥒", group: "vegetable", category: "snack", tags: ["hydrating"] },
  "Green Beans (cooked)": { emoji: "🫛", group: "vegetable", category: "dinner", tags: ["fiber"] },
  "Cabbage (raw)": { emoji: "🥬", group: "vegetable", category: "lunch", tags: ["low-cal"] },
  "Purple Cabbage (raw)": { emoji: "🔴", group: "vegetable", category: "lunch", tags: ["antioxidant"] },
  "Lettuce (raw)": { emoji: "🥬", group: "vegetable", category: "lunch", tags: ["low-cal"] },
  "Paneer Cheese Dressing": { emoji: "🧀", group: "dairy", category: "snack", tags: ["high-fat"] },
  "Broccoli (cooked)": { emoji: "🥦", group: "vegetable", category: "dinner", tags: ["fiber"] },
  "Channa with Onions (cooked)": { emoji: "🫘", group: "legume", category: "lunch", tags: ["protein", "fiber"] },
  "Dragon Fruit": { emoji: "DF", group: "fruit", category: "snack", tags: ["antioxidant"] },
  "Orange": { emoji: "🍊", group: "fruit", category: "snack", tags: ["vitamin-c"] },
  "Mango": { emoji: "🥭", group: "fruit", category: "snack", tags: ["energy"] },
  "Apple (with skin)": { emoji: "🍎", group: "fruit", category: "snack", tags: ["fiber"] },
  "Pomegranate": { emoji: "🍷", group: "fruit", category: "snack", tags: ["antioxidant"] },
  "Guava": { emoji: "🍈", group: "fruit", category: "snack", tags: ["vitamin-c", "fiber"] },
  "Papaya": { emoji: "🏉", group: "fruit", category: "breakfast", tags: ["digestion"] },
  "Watermelon": { emoji: "🍉", group: "fruit", category: "snack", tags: ["hydrating"] },
  "Grapes": { emoji: "🍇", group: "fruit", category: "snack", tags: ["energy"] },
  "Strawberry": { emoji: "🍓", group: "fruit", category: "snack", tags: ["antioxidant"] },
  "Cherry": { emoji: "🍒", group: "fruit", category: "snack", tags: ["antioxidant"] },
  "Regular Banana": { emoji: "🍌", group: "fruit", category: "snack", tags: ["energy"] },
  "Nendran Banana": { emoji: "🍌", group: "fruit", category: "snack", tags: ["energy"] },
  "Red Banana": { emoji: "🍌", group: "fruit", category: "snack", tags: ["energy"] },
  "Rasthali Banana": { emoji: "🍌", group: "fruit", category: "snack", tags: ["energy"] },
  "Poovan Banana": { emoji: "🍌", group: "fruit", category: "snack", tags: ["energy"] },
  "Black Channa (cooked)": { emoji: "🫘", group: "legume", category: "lunch", tags: ["protein", "fiber"] },
  "White Channa (cooked)": { emoji: "⚪", group: "legume", category: "lunch", tags: ["protein", "fiber"] },
  "Onion (raw)": { emoji: "🧅", group: "vegetable", category: "lunch", tags: ["flavor"] },
  "Soya": { emoji: "S", group: "protein", category: "dinner", tags: ["high-protein", "vegan"] },
  "Beetroot": { emoji: "🫜", group: "vegetable", category: "lunch", tags: ["antioxidant"] },
  "Peanut": { emoji: "🥜", group: "nuts", category: "snack", tags: ["high-fat", "protein"] },
};

export const FUEL_BOX_MENU: FuelBoxFood[] = RAW.map(([name, cal, p, c, f, fib], i) => {
  const m = META[name] ?? { emoji: "🥗", group: "vegetable" as const, category: "lunch" as const, tags: [] };
  return {
    id: `fb-${String(i + 1).padStart(3, "0")}`,
    name,
    category: m.category,
    group: m.group,
    emoji: m.emoji,
    calories: cal,
    protein: p,
    carbs: c,
    fat: f,
    fiber: fib,
    sugar: 0,
    sodium: 0,
    serving: "per 100 g",
    tags: m.tags ?? [],
  };
});
