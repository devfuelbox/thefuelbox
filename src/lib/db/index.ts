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
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
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
  }, { underscored: true });

  return { MenuItem, User, Profile, Order, Customer };
}

export async function getDbModels() {
  const sequelize = getSequelize();
  try {
    await sequelize.authenticate();
    await sequelize.sync();
  } catch (err) {
    // If database connection fails in dev environment, models handle graceful fallbacks
    console.warn('MySQL DB not reachable yet, using fallback responses.');
  }
  return defineModels(sequelize);
}
