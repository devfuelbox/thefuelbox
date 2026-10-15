import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));

const captions = {
  1: "Valid · Male, 26, 172 cm, 70 kg · Mostly sitting · 3–4 workouts · Weight loss · 3 meals → 1910 / 140 / 218 / 53 / 27",
  2: "Valid · Female, 24, 160 cm, 58 kg · On my feet a lot · 1–2 workouts · Weight loss · 3 meals → 1530 / 116 / 170 / 43 / 21",
  3: "Valid · Male, 22, 178 cm, 65 kg · Mostly sitting · 5+ workouts · Muscle gain · 3 meals → 2870 / 130 / 408 / 80 / 40",
  4: "Valid · Female, 35, 155 cm, 52 kg · Mostly sitting · 0 workouts · Maintenance · 3 meals → 1380 / 83 / 177 / 38 / 19",
  5: "Valid · Male, 30, 170 cm, 110 kg · Mostly sitting · 0 workouts · Weight loss · 3 meals → 1940 / 145 / 219 / 54 / 27",
  6: "Valid · Female, 70, 150 cm, 40 kg · Mostly sitting · 0 workouts · Weight loss · 3 meals → 1200 / 80 / 146 / 33 / 17",
  7: "Valid · Male, 80, 150 cm, 45 kg · Mostly sitting · 0 workouts · Weight loss · 3 meals → 1500 / 90 / 191 / 42 / 21",
  8: "Valid · Male, 28, 175.5 cm, 60.5 kg · Physical work · 1–2 workouts · Weight gain · 3 meals → 2930 / 109 / 441 / 81 / 41",
  9: "Error · Age 16 → “FuelBox plans are for adults 18+.” (no numbers)",
  10: "Error · Age 85 → “Please enter your age in whole years (18–80).”",
  11: "Error · Height 250 cm → “Please enter a height between 120 and 220 cm.”",
  12: "Error · Age 26.5 → “Please enter your age in whole years (18–80).”",
  13: "Error · Goal not selected → “Please select your goal.”",
  14: "Error · Everything blank → all 9 errors at once, each next to its field (plus 9 toasts)",
  15: "Error · Weight “abc” → “Please enter a weight between 30 and 200 kg.”",
  16: "Error · Workouts not selected → “Please select your workouts per week.”",
};

let sections = "";
for (let i = 1; i <= 16; i++) {
  const n = String(i).padStart(2, "0");
  const b64 = readFileSync(join(dir, `test-${n}.jpeg`)).toString("base64");
  sections += `
  <section>
    <h2>Test ${i}</h2>
    <p class="cap">${captions[i]}</p>
    <img alt="Test ${i}" src="data:image/jpeg;base64,${b64}">
  </section>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FuelBox calculator — 16 tests</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #F3EDDF; color: #1A231D;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { padding: 28px 24px 8px; }
  header h1 { font-size: 22px; margin: 0 0 6px; }
  header p { margin: 0 0 8px; color: #5E6A61; font-size: 14px; max-width: 820px; line-height: 1.5; }
  header code { background: #FBF8F1; border: 1px solid #D9D0BC; border-radius: 6px; padding: 1px 5px; }
  main { padding: 16px 24px 48px; display: grid; gap: 28px;
         grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); align-items: start; }
  section { background: #FBF8F1; border: 1px solid #D9D0BC; border-radius: 14px;
            padding: 16px; overflow: hidden; }
  h2 { font-size: 16px; margin: 0 0 4px; color: #1F3D2B; }
  .cap { font-size: 12.5px; color: #5E6A61; margin: 0 0 12px; line-height: 1.45; }
  img { width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid #E6EEDF; }
</style>
</head>
<body>
<header>
  <h1>FuelBox nutrition calculator — test screenshots (1–16)</h1>
  <p>Tests 1–8 are the eight calculation cases taken through to the result screen (kcal /
  protein / carbs / fat / fiber shown in each caption); tests 9–16 are the error cases.
  Each image shows the inputs and the outcome together. On the error tests, every message
  also pops up as a toast at the top of the screen, in addition to the red text under each field.</p>
  <p>Formula as specified: BMR (Mifflin–St Jeor) × (day base + workout add), then the goal
  factor, floored at 1500 kcal (male) / 1200 kcal (female) and rounded to 10. Height and
  weight each carry a small <code>cm / ft</code> and <code>kg / lb</code> switch; the
  “Workouts per week” question is back, and blank submits now surface 9 errors.</p>
</header>
<main>${sections}
</main>
</body>
</html>
`;

writeFileSync(join(dir, "contact-sheet.html"), html);
console.log("wrote contact-sheet.html", html.length, "bytes");
