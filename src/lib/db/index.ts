import { Sequelize, DataTypes } from 'sequelize';
import pg from 'pg';
// Neon PostgreSQL is the primary DB (DATABASE_URL).
// Fallback to legacy MySQL env (DB_HOST etc.) for local dev without DATABASE_URL.
const DATABASE_URL = process.env.DATABASE_URL?.trim();

let sequelizeInstance: Sequelize | null = null;

export function getSequelize(): Sequelize {
  if (sequelizeInstance) return sequelizeInstance;

  if (DATABASE_URL) {
    // Neon PostgreSQL — requires SSL
    sequelizeInstance = new Sequelize(DATABASE_URL, {
      dialect: 'postgres',
      dialectModule: pg,
      logging: false,
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
      },
      // Neon/pg works best without dialectModule override; pg is auto-required
    });
    return sequelizeInstance;
  }

  // Fallback: legacy MySQL (local dev)
  // Keep mysql2 only when DATABASE_URL is not set
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mysql2 = require('mysql2');
  const DB_HOST = process.env.DB_HOST || 'localhost';
  const DB_PORT = Number(process.env.DB_PORT) || 3306;
  const DB_USER = process.env.DB_USER || 'root';
  const DB_PASSWORD = process.env.DB_PASSWORD || '';
  const DB_NAME = process.env.DB_NAME || 'fuelbox_db';

  sequelizeInstance = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    dialectModule: mysql2,
    logging: false,
  });
  return sequelizeInstance;
}

export function defineModels(sequelize: Sequelize) {
  const MenuItem = sequelize.define('menu_items', {
    // BIGINT autoIncrement → BIGSERIAL on Postgres, AUTO_INCREMENT on MySQL — compatible
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: '' },
    price: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
    // Whether `price` is priced per kilogram or per piece. Stored values are a
    // plain unit ('kg' | 'piece'); the admin UI always renders weights in grams.
    // The column already exists (default 'piece'); listing it here makes it part
    // of the model so reads/writes include it instead of silently dropping it.
    price_unit: { type: DataTypes.STRING, defaultValue: 'piece' },
    calories: { type: DataTypes.DECIMAL(7, 1), defaultValue: 0 },
    protein_g: { type: DataTypes.DECIMAL(6, 1), defaultValue: 0 },
    carbs_g: { type: DataTypes.DECIMAL(6, 1), defaultValue: 0 },
    fat_g: { type: DataTypes.DECIMAL(6, 1), defaultValue: 0 },
    fiber_g: { type: DataTypes.DECIMAL(6, 1), defaultValue: 0 },
    score: { type: DataTypes.DECIMAL(5, 1), defaultValue: 0 },
    diet: { type: DataTypes.STRING, defaultValue: 'veg' },
    category: { type: DataTypes.STRING, defaultValue: 'main' },
    is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
    cookable: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Serving size limits in grams, set from the admin panel. Nullable on
    // purpose: NULL means "no limit", which is what every item has until an
    // admin sets one. syncSchema() adds these columns to existing databases.
    min_grams: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    max_grams: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    // Fitness goals this food is assigned to (Weight Loss / Weight Gain /
    // Muscle Gain / Weight Maintenance) as a JSON array of goal keys. NULL or
    // [] means uncategorized, which the onboarding shows under every goal —
    // so an unassigned item behaves exactly as it did before this column.
    // syncSchema() adds it to existing databases.
    goal_categories: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    // Per-goal serving windows, e.g. { "gain": { "min": 100, "max": 150 } }.
    // A goal with an entry overrides the default min_grams/max_grams for that
    // goal only; every other goal (and NULL) falls back to them, so existing
    // items are unchanged. syncSchema() adds it to existing databases.
    goal_portions: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    image_url: { type: DataTypes.STRING, defaultValue: '' },
  }, { underscored: true });

  const User = sequelize.define('users', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'user' },
    full_name: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { underscored: true });

  const Profile = sequelize.define('profiles', {
    id: { type: DataTypes.UUID, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: true },
    full_name: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    referral_id: { type: DataTypes.STRING, allowNull: true },
  }, { underscored: true });

  const Order = sequelize.define('orders', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    pincode: { type: DataTypes.STRING, allowNull: true },
    cost: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
    selected_meals: { type: DataTypes.JSON, defaultValue: [] },
    delivery_times: { type: DataTypes.JSON, defaultValue: {} },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    type: { type: DataTypes.STRING, defaultValue: 'meal' },
    plan_id: { type: DataTypes.STRING, allowNull: true },
    menu_selected: { type: DataTypes.JSON, defaultValue: [] },
  }, { underscored: true });

  const Customer = sequelize.define('customers', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    goal: { type: DataTypes.STRING, allowNull: true },
    age: { type: DataTypes.INTEGER, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true },
    height: { type: DataTypes.INTEGER, allowNull: true },
    weight: { type: DataTypes.INTEGER, allowNull: true },
    food: { type: DataTypes.STRING, allowNull: true },
    activity: { type: DataTypes.STRING, allowNull: true },
    freq: { type: DataTypes.INTEGER, allowNull: true },
    loc_status: { type: DataTypes.STRING, allowNull: true },
    loc_km: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    loc_fee: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    loc_lat: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    loc_lng: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    meal_plan: { type: DataTypes.JSON, allowNull: true },
    meal_plan_price: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
    meal_plan_packages: { type: DataTypes.JSON, allowNull: true },
  }, { underscored: true });

  const Payment = sequelize.define('payments', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customer_name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    enquiry_date: { type: DataTypes.DATEONLY, allowNull: true },
    service: { type: DataTypes.STRING, allowNull: false, defaultValue: 'meal_plan' },
    total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    outstanding_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    payment_method: { type: DataTypes.STRING, allowNull: true },
    payment_date: { type: DataTypes.DATEONLY, allowNull: true },
    payment_status: { type: DataTypes.STRING, defaultValue: 'pending' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    payment_history: { type: DataTypes.JSON, defaultValue: [] },
  }, { underscored: true });

  const CustomerEnquiry = sequelize.define('customer_enquiries', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customer_name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    age: { type: DataTypes.INTEGER, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true },
    height: { type: DataTypes.DECIMAL(6, 1), allowNull: true },
    weight: { type: DataTypes.DECIMAL(6, 1), allowNull: true },
    food_preference: { type: DataTypes.STRING, allowNull: true },
    activity_level: { type: DataTypes.STRING, allowNull: true },
    goal: { type: DataTypes.STRING, allowNull: true },
    meals_per_day: { type: DataTypes.INTEGER, allowNull: true },
    selected_food_items: { type: DataTypes.JSON, defaultValue: [] },
    meal_plan: { type: DataTypes.JSON, defaultValue: [] },
    daily_calories: { type: DataTypes.DECIMAL(8, 1), allowNull: true },
    daily_protein: { type: DataTypes.DECIMAL(7, 1), allowNull: true },
    // The rest of the macro targets the onboarding calculates. Calories and
    // protein predate the Customer Enquiries feature; these were added with it
    // so the admin reads the full macro picture from columns instead of
    // parsing it back out of the summary text. Nullable — the additive schema
    // sync adds them to existing rows without touching their data.
    daily_carbs: { type: DataTypes.DECIMAL(7, 1), allowNull: true },
    daily_fat: { type: DataTypes.DECIMAL(7, 1), allowNull: true },
    daily_fiber: { type: DataTypes.DECIMAL(7, 1), allowNull: true },
    // Body metrics + energy expenditure from the onboarding result screen
    // (Mifflin-St Jeor). Stored so the admin never has to recompute them.
    bmi: { type: DataTypes.DECIMAL(4, 1), allowNull: true },
    bmi_category: { type: DataTypes.STRING, allowNull: true },
    bmr: { type: DataTypes.DECIMAL(8, 1), allowNull: true },
    tdee: { type: DataTypes.DECIMAL(8, 1), allowNull: true },
    water_liters: { type: DataTypes.DECIMAL(4, 1), allowNull: true },
    // Delivery feasibility captured during onboarding: distance from the
    // kitchen and whether that zone is free, paid or a waitlist.
    delivery_km: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    delivery_status: { type: DataTypes.STRING, allowNull: true },
    enquiry_date: { type: DataTypes.DATEONLY, allowNull: true },
    service: { type: DataTypes.STRING, defaultValue: 'meal_plan' },
    total_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    outstanding_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    payment_method: { type: DataTypes.STRING, allowNull: true },
    payment_date: { type: DataTypes.DATEONLY, allowNull: true },
    payment_status: { type: DataTypes.STRING, defaultValue: 'pending' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    payment_history: { type: DataTypes.JSON, defaultValue: [] },
    order_status: { type: DataTypes.STRING, defaultValue: 'new_enquiry' },
    sales_status: { type: DataTypes.STRING, allowNull: true },
    assigned_sales_id: { type: DataTypes.UUID, allowNull: true },
    assigned_chef_id: { type: DataTypes.UUID, allowNull: true },
    assigned_delivery_id: { type: DataTypes.UUID, allowNull: true },
    assigned_by_verifier_id: { type: DataTypes.UUID, allowNull: true },
    delivery_notes: { type: DataTypes.TEXT, allowNull: true },
    sales_notes: { type: DataTypes.TEXT, allowNull: true },
    verifier_notes: { type: DataTypes.TEXT, allowNull: true },
    chef_notes: { type: DataTypes.TEXT, allowNull: true },
    delivery_date: { type: DataTypes.DATEONLY, allowNull: true },
    delivery_time_slot: { type: DataTypes.STRING, allowNull: true },
    special_instructions: { type: DataTypes.TEXT, allowNull: true },
    meal_statuses: { type: DataTypes.JSON, allowNull: true },
    next_payment_date: { type: DataTypes.DATEONLY, allowNull: true },
    follow_up_note: { type: DataTypes.TEXT, allowNull: true },
    follow_up_status: { type: DataTypes.STRING, defaultValue: 'pending' },
    // Stable fingerprint of a public onboarding submission (phone + goal +
    // plan targets). The onboarding result auto-saves an enquiry and retries on
    // refresh/revisit; this key lets the write upsert the same row instead of
    // stacking duplicates. Null for admin-created enquiries, which are always
    // distinct records. Added via the additive schema sync — nullable, so
    // existing rows are unaffected.
    dedupe_key: { type: DataTypes.STRING, allowNull: true },
    // Where the enquiry came from: 'onboarding' for the public page's automatic
    // save, null/other for staff-created rows. Lets the admin UI label them.
    source: { type: DataTypes.STRING, allowNull: true },
  }, { underscored: true });

  const MealPlanSubscription = sequelize.define('meal_plan_subscriptions', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customer_enquiry_id: { type: DataTypes.UUID, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    duration_days: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    paused_days: { type: DataTypes.INTEGER, defaultValue: 0 },
    pause_history: { type: DataTypes.JSON, defaultValue: [] },
    skipped_meals: { type: DataTypes.JSON, defaultValue: [] },
    actual_end_date: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    auto_renew: { type: DataTypes.BOOLEAN, defaultValue: false },
    auto_renew_days: { type: DataTypes.INTEGER, allowNull: true },
    renewal_history: { type: DataTypes.JSON, defaultValue: [] },
    last_renewed_at: { type: DataTypes.DATE, allowNull: true },
  }, { underscored: true });

  const MealDelivery = sequelize.define('meal_deliveries', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subscription_id: { type: DataTypes.UUID, allowNull: false },
    day_number: { type: DataTypes.INTEGER, allowNull: false },
    meal_slot: { type: DataTypes.STRING, allowNull: false },
    scheduled_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'scheduled' },
    original_day_number: { type: DataTypes.INTEGER, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, { underscored: true });

  const ChefDeliveryMapping = sequelize.define('chef_delivery_mappings', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    chef_id: { type: DataTypes.UUID, allowNull: false },
    delivery_partner_id: { type: DataTypes.UUID, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { underscored: true });

  // Single source of truth for the TFBC client-management flow. A client is
  // identified by their mobile number; `client_no` only drives the TFBCnnn
  // display label. The row keeps the whole plan snapshot (goal, meals, schedule,
  // dates, payment) so the Clients page and its actions never have to join the
  // older customer_enquiry/subscription tables to render a client.
  const Client = sequelize.define('clients', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Sequential display number — TFBC001, TFBC002, … Assigned on create and
    // never reused, so a client's label stays stable across edits/renewals.
    client_no: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    goal: { type: DataTypes.STRING, allowNull: true },
    plan_type: { type: DataTypes.STRING, defaultValue: 'trial' },
    duration_days: { type: DataTypes.INTEGER, defaultValue: 1 },
    boxes_per_day: { type: DataTypes.INTEGER, defaultValue: 1 },
    meals: { type: DataTypes.JSON, defaultValue: [] },
    schedule: { type: DataTypes.STRING, defaultValue: 'mon_fri' },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    skip_dates: { type: DataTypes.JSON, defaultValue: [] },
    total_boxes: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    balance_due_date: { type: DataTypes.DATEONLY, allowNull: true },
    payment_history: { type: DataTypes.JSON, defaultValue: [] },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    assigned_sales_id: { type: DataTypes.UUID, allowNull: true },
  }, { underscored: true });

  // One row per plan a client has held. A client's *current* plan is mirrored on
  // the `clients` row (so the list page and its actions stay simple), while this
  // table is the source of truth for the View Client page: it keeps every past
  // plan — including the trial that was later converted, and each renewal — with
  // its own dates, meals, amounts, skip list and payment ledger. Plans are
  // appended (never rewritten), which is what makes per-plan history possible.
  const ClientPlan = sequelize.define('client_plans', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    client_id: { type: DataTypes.UUID, allowNull: false },
    plan_type: { type: DataTypes.STRING, defaultValue: 'trial' },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    goal: { type: DataTypes.STRING, allowNull: true },
    duration_days: { type: DataTypes.INTEGER, defaultValue: 1 },
    boxes_per_day: { type: DataTypes.INTEGER, defaultValue: 1 },
    meals: { type: DataTypes.JSON, defaultValue: [] },
    schedule: { type: DataTypes.STRING, defaultValue: 'mon_fri' },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    skip_dates: { type: DataTypes.JSON, defaultValue: [] },
    total_boxes: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    balance_due_date: { type: DataTypes.DATEONLY, allowNull: true },
    // [{ id, amount, method, reference, date, note }] — every entry belongs to
    // this plan, so the ledger shown under each plan card is always correct.
    payment_history: { type: DataTypes.JSON, defaultValue: [] },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, { underscored: true });

  // Append-only audit log for the View Client page's "Update history" section.
  // `type` is a stable machine key (client_created, plan_created, renewed, …),
  // `message` is the human summary rendered in the list.
  const ClientEvent = sequelize.define('client_events', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    client_id: { type: DataTypes.UUID, allowNull: false },
    plan_id: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, defaultValue: '' },
  }, { underscored: true });

  return { MenuItem, User, Profile, Order, Customer, Payment, CustomerEnquiry, MealPlanSubscription, MealDelivery, ChefDeliveryMapping, Client, ClientPlan, ClientEvent };
}

// Safe, non-destructive schema sync: creates missing tables and only ADDs missing
// columns. Works for both MySQL and PostgreSQL (Neon).
async function syncSchema(sequelize: Sequelize, models: Record<string, any>) {
  const qi = sequelize.getQueryInterface();
  // showAllTables is dialect-specific:
  // - MySQL: ['menu_items', 'users', ...]
  // - Postgres: ['public.menu_items', ...] or [{tableName, schema}]
  const rawTables: any[] = await qi.showAllTables();
  const existingTables = rawTables.map((t: any) => {
    if (typeof t === 'string') return t.includes('.') ? t.split('.').pop()! : t;
    if (t && typeof t === 'object') {
      const v = (t as any).tableName || (t as any).table_name || Object.values(t)[0];
      if (typeof v === 'string') return v.includes('.') ? v.split('.').pop()! : v;
    }
    return String(t);
  }).map((s: string) => s.toLowerCase());

  for (const model of Object.values(models)) {
    const table = model.getTableName();
    const tableName = typeof table === 'string' ? table : (table as any).tableName;
    const normalizedTable = tableName.toLowerCase();
    if (!existingTables.includes(normalizedTable)) {
      await model.sync();
      continue;
    }
    const columns = await qi.describeTable(tableName);
    // describeTable keys are lowercased in PG; normalize for check
    const colKeys = Object.keys(columns).reduce((acc: Record<string, string>, k) => {
      acc[k.toLowerCase()] = k;
      return acc;
    }, {});
    const attributes = model.getAttributes();
    for (const attrName of Object.keys(attributes)) {
      const attr = attributes[attrName];
      const colName = (attr.field || attrName) as string;
      if (colKeys[colName.toLowerCase()]) continue;
      await qi.addColumn(tableName, colName, attr as any);
    }
  }
}

export async function getDbModels() {
  const sequelize = getSequelize();
  const models = defineModels(sequelize);
  try {
    await sequelize.authenticate();
    await syncSchema(sequelize, models);
  } catch (err: any) {
    console.warn('[DB] Schema sync skipped:', err?.message || err);
  }
  return models;
}
