import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guards the "auto-save the onboarding result as a Customer Enquiry" feature.
// These are source-level checks (the same style as the portion-limit tests):
// they lock in the wiring that makes the save automatic + duplicate-safe, which
// a future refactor could silently drop.

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const ONBOARDING = read("src", "views", "Onboarding", "Onboarding.tsx");
const ENQUIRY_ROUTE = read("src", "app", "api", "onboarding", "enquiry", "route.ts");
const DB = read("src", "lib", "db", "index.ts");
const ENQUIRE_PAGE = read("src", "app", "admin", "enquire", "page.tsx");
const ADMIN_LAYOUT = read("src", "app", "admin", "layout.tsx");

test("onboarding auto-saves the enquiry without the WhatsApp click", () => {
  // The helper exists and posts to the public enquiry endpoint.
  assert.match(ONBOARDING, /async function saveEnquiryToDb/, "saveEnquiryToDb helper missing");
  assert.match(ONBOARDING, /\/api\/onboarding\/enquiry/, "onboarding should POST to /api/onboarding/enquiry");

  // The save is driven by an effect (not by the WhatsApp handler), so it fires
  // as soon as the result renders.
  assert.match(ONBOARDING, /AUTO-SAVE THE ENQUIRY/, "auto-save effect missing");
  assert.match(ONBOARDING, /void saveEnquiryToDb\(/, "auto-save effect should call saveEnquiryToDb");
});

test("the enquiry auto-save is duplicate-safe", () => {
  // Client-side: a fingerprint ref stops an identical re-render re-posting.
  assert.match(ONBOARDING, /savedEnquiryKey/, "missing savedEnquiryKey guard");
  assert.match(ONBOARDING, /if \(savedEnquiryKey\.current === key\) return;/,
    "auto-save should bail when the fingerprint is unchanged");

  // Server-side: a deterministic dedupe key + find-before-create upsert.
  assert.match(ENQUIRY_ROUTE, /dedupe_key/, "enquiry route should use a dedupe key");
  assert.match(ENQUIRY_ROUTE, /findOne\(\{ where: \{ dedupe_key: dedupeKey \} \}\)/,
    "enquiry route should look up an existing row by dedupe key before creating");
  assert.match(ENQUIRY_ROUTE, /existing\.update\(/, "enquiry route should update the existing row");
});

test("the dedupe column is on the model so the schema sync adds it", () => {
  assert.match(DB, /dedupe_key:\s*\{[^}]*allowNull:\s*true/,
    "customer_enquiries model should define a nullable dedupe_key");
  assert.match(DB, /source:\s*\{[^}]*allowNull:\s*true/,
    "customer_enquiries model should define a nullable source");
});

test("the enquiry stores the full set of calculated results", () => {
  // Every metric the onboarding calculates has its own column, so the admin
  // can read it directly instead of parsing the summary text.
  for (const col of [
    "bmi", "bmi_category", "bmr", "tdee", "water_liters",
    "daily_calories", "daily_protein", "daily_carbs", "daily_fat", "daily_fiber",
  ]) {
    assert.match(DB, new RegExp(`${col}:\\s*\\{[^}]*allowNull:\\s*true`),
      `customer_enquiries model should define a nullable ${col}`);
  }

  // ...and the public route writes them.
  for (const field of [
    "bmi:", "bmi_category:", "bmr:", "tdee:", "water_liters:",
    "daily_calories:", "daily_protein:", "daily_carbs:", "daily_fat:", "daily_fiber:",
  ]) {
    assert.ok(ENQUIRY_ROUTE.includes(field),
      `enquiry route should store ${field.replace(":", "")}`);
  }

  // ...and the onboarding actually sends them.
  for (const field of [
    "bmi:", "bmi_category:", "bmr:", "tdee:", "water_liters:",
    "daily_carbs:", "daily_fat:", "daily_fiber:",
  ]) {
    assert.ok(ONBOARDING.includes(field),
      `onboarding auto-save should send ${field.replace(":", "")}`);
  }
});

test("the public enquiry route validates before it persists", () => {
  assert.match(ENQUIRY_ROUTE, /validateSavedMealPlan/, "route must validate the meal plan");
  assert.match(ENQUIRY_ROUTE, /PHONE_RE/, "route must validate the phone shape");
});

test("the admin sidebar Enquiries item opens the Customer Enquiries page", () => {
  // The sidebar already points at /admin/enquire — the page must exist there.
  assert.match(ADMIN_LAYOUT, /href:\s*'\/admin\/enquire'/, "sidebar should link to /admin/enquire");
  assert.match(ADMIN_LAYOUT, /label:\s*'Enquiries'/, "sidebar item should be labelled Enquiries");
  assert.ok(
    fs.existsSync(path.join(ROOT, "src", "app", "admin", "enquire", "page.tsx")),
    "the /admin/enquire page must exist",
  );
});

test("the Enquiries page reads the real API and database", () => {
  assert.match(ENQUIRE_PAGE, /\/api\/roles\/sales\/enquiries/,
    "the page should load enquiries from the API");
  assert.match(ENQUIRE_PAGE, /Authorization:\s*`Bearer \$\{token\}`/,
    "the page should authenticate with the stored token");

  // No mock data: the rows come from the response.
  assert.ok(!/mock|sample|dummy|fake/i.test(ENQUIRE_PAGE),
    "the page must not use mock/hardcoded enquiries");

  // Loading, empty and error states.
  assert.match(ENQUIRE_PAGE, /Loading enquiries/, "the page should show a loading state");
  assert.match(ENQUIRE_PAGE, /No customer enquiries yet/, "the page should show an empty state");
  assert.match(ENQUIRE_PAGE, /Try again/, "the page should show an error state with a retry");
});

test("the enquiries list is a table with the required columns", () => {
  // A real <table>, not a stack of cards.
  assert.match(ENQUIRE_PAGE, /<table[\s>]/, "enquiries should render as a table");
  assert.match(ENQUIRE_PAGE, /<\/table>/, "enquiries table should be closed properly");

  // The columns the admin needs at a glance.
  for (const col of [
    "Customer", "Contact number", "Goal", "BMI", "Daily calories", "Protein",
    "Enquiry date", "Status",
  ]) {
    assert.ok(ENQUIRE_PAGE.includes(`${col}</th>`),
      `enquiries table should have a ${col} column`);
  }

  // ...and a way to open the complete enquiry.
  assert.match(ENQUIRE_PAGE, /toggle\(e\.id\)/, "enquiries table should open the full details");
  assert.match(ENQUIRE_PAGE, /Customer details/, "details should show the customer details");
  assert.match(ENQUIRE_PAGE, /Calculated nutrition plan/, "details should show the calculated plan");
  assert.match(ENQUIRE_PAGE, /calculation summary/i, "details should show the stored summary");
});

test("unassigned onboarding enquiries stay visible to sales users", () => {
  const ROUTE = read("src", "app", "api", "roles", "sales", "enquiries", "route.ts");
  assert.match(ROUTE, /assigned_sales_id: null/,
    "sales GET should include unassigned (auto-saved) enquiries");
});
