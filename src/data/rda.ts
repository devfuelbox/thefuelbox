// RDA data from uploaded spreadsheet (Sheet2)
// Age bands: 13-17, 18-40, 41-65

export type AgeBand = "13-17" | "18-40" | "41-65";
export type RdaGender = "male" | "female";

export interface RDA {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  calcium: number;
  iron: number;
  vitaminC: number;
  vitaminD: number;
}

const TABLE: Record<RdaGender, Record<AgeBand, RDA>> = {
  male: {
    "13-17": { calories: 2860, protein: 45.4, carbs: 380, fat: 50, fiber: 30, sugar: 25, sodium: 2000, calcium: 1050, iron: 26, vitaminC: 70, vitaminD: 15 },
    "18-40": { calories: 2110, protein: 54, carbs: 280, fat: 33, fiber: 30, sugar: 30, sodium: 2000, calcium: 1000, iron: 19, vitaminC: 80, vitaminD: 15 },
    "41-65": { calories: 2110, protein: 54, carbs: 270, fat: 30, fiber: 30, sugar: 30, sodium: 2000, calcium: 1000, iron: 19, vitaminC: 80, vitaminD: 15 },
  },
  female: {
    "13-17": { calories: 2400, protein: 40, carbs: 330, fat: 45, fiber: 30, sugar: 22, sodium: 2000, calcium: 1050, iron: 25, vitaminC: 65, vitaminD: 15 },
    "18-40": { calories: 1660, protein: 45.7, carbs: 235, fat: 28, fiber: 25, sugar: 25, sodium: 2000, calcium: 1000, iron: 29, vitaminC: 65, vitaminD: 15 },
    "41-65": { calories: 1660, protein: 45.7, carbs: 220, fat: 23, fiber: 25, sugar: 25, sodium: 2000, calcium: 1000, iron: 19, vitaminC: 65, vitaminD: 15 },
  },
};

export function ageBand(age: number): AgeBand {
  if (age <= 17) return "13-17";
  if (age <= 40) return "18-40";
  return "41-65";
}

export function rdaFor(age: number, gender: "male" | "female" | "other"): RDA {
  const g: RdaGender = gender === "female" ? "female" : "male";
  return TABLE[g][ageBand(age)];
}
