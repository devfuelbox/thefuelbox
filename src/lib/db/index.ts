import { Sequelize, DataTypes, Model } from 'sequelize';
import mysql2 from 'mysql2';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'fuelbox_db';

let sequelizeInstance: Sequelize | null = null;

export function getSequelize(): Sequelize {
  if (!sequelizeInstance) {
    sequelizeInstance = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
      host: DB_HOST,
      port: DB_PORT,
      dialect: 'mysql',
      dialectModule: mysql2,
      logging: false,
    });
  }
  return sequelizeInstance;
}

export function defineModels(sequelize: Sequelize) {
  const MenuItem = sequelize.define('menu_items', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: '' },
    price: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
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

  return { MenuItem, User, Profile, Order, Customer, Payment, CustomerEnquiry, MealPlanSubscription, MealDelivery, ChefDeliveryMapping };
}

// Safe, non-destructive schema sync: creates missing tables and only ADDs missing
// columns. It never ALTERs existing columns or indexes (the previous `sync({ alter: true })`
// regenerated every column with `ALTER TABLE ... CHANGE`, which breaks on unique columns
// with MySQL error "Too many keys specified; max 64 keys allowed").
async function syncSchema(sequelize: Sequelize, models: Record<string, any>) {
  const qi = sequelize.getQueryInterface();
  const existingTables = await qi.showAllTables();
  for (const model of Object.values(models)) {
    const table = model.getTableName();
    const tableName = typeof table === 'string' ? table : table.tableName;
    if (!existingTables.includes(tableName)) {
      await model.sync();
      continue;
    }
    const columns = await qi.describeTable(tableName);
    const attributes = model.getAttributes();
    for (const attrName of Object.keys(attributes)) {
      const attr = attributes[attrName];
      const colName = attr.field || attrName;
      if (columns[colName]) continue;
      await qi.addColumn(tableName, colName, attr);
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
    // If database connection fails in dev environment, models handle graceful fallbacks
    console.warn('[DB] Schema sync skipped:', err?.message || err);
  }
  return models;
}
