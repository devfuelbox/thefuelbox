import 'dotenv/config';
import { Sequelize, DataTypes } from 'sequelize';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'fuelbox_db';

async function seed() {
  console.log(`Connecting to MySQL database ${DB_NAME} at ${DB_HOST}:${DB_PORT}...`);
  
  // Connect to MySQL server first to create database if it doesn't exist
  const serverSequelize = new Sequelize('', DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: false,
  });

  await serverSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await serverSequelize.close();

  const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Define tables inline for self-contained execution
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

    const SubscriptionPlan = sequelize.define('subscription_plans', {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      meals_per_day: { type: DataTypes.INTEGER, defaultValue: 1 },
      days_per_month: { type: DataTypes.INTEGER, defaultValue: 30 },
      monthly_price: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
      description: { type: DataTypes.TEXT, defaultValue: '' },
      features: { type: DataTypes.JSON, defaultValue: [] },
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

    await sequelize.sync({ force: true });
    console.log('Tables synced.');

    // Seed Menu Items (44 items)
    const menuItems = [
      { name: 'Chicken Breast (cooked)', description: 'Lean grilled chicken breast', price: 28.00, calories: 165.0, protein_g: 31.0, carbs_g: 0, fat_g: 3.6, fiber_g: 0, diet: 'non_veg', category: 'main', is_available: true, cookable: true, image_url: 'chicken.jpg' },
      { name: 'Paneer', description: 'Fresh cottage cheese', price: 25.00, calories: 275.0, protein_g: 19.0, carbs_g: 2.4, fat_g: 15.0, fiber_g: 0, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'paneer.jpg' },
      { name: 'Chickpeas (cooked)', description: 'High protein boiled chickpeas', price: 18.00, calories: 164.0, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, fiber_g: 7.6, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'chickpeas.jpg' },
      { name: 'Sweet Potato (boiled)', description: 'Fiber-rich boiled sweet potato', price: 15.00, calories: 76.0, protein_g: 1.4, carbs_g: 17.7, fat_g: 0.1, fiber_g: 2.5, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'sweet_potato.jpg' },
      { name: 'Banana', description: 'Fresh energetic banana', price: 10.00, calories: 89.0, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'banana.jpg' },
      { name: 'White Rice (cooked)', description: 'Steamed white rice', price: 12.00, calories: 130.0, protein_g: 2.7, carbs_g: 28.0, fat_g: 0.3, fiber_g: 0.4, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'rice.jpg' },
      { name: 'Chapati (whole wheat)', description: 'Fresh whole wheat chapati', price: 8.00, calories: 299.0, protein_g: 7.9, carbs_g: 46.0, fat_g: 9.2, fiber_g: 9.7, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'chapati.jpg' },
      { name: 'Egg', description: 'Boiled egg', price: 10.00, calories: 155.0, protein_g: 13.0, carbs_g: 1.1, fat_g: 11.0, fiber_g: 0, diet: 'non_veg', category: 'main', is_available: true, cookable: true, image_url: 'egg.jpg' },
      { name: 'Carrot (raw)', description: 'Fresh sliced carrot', price: 12.00, calories: 41.0, protein_g: 0.9, carbs_g: 9.6, fat_g: 0.2, fiber_g: 2.8, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'carrot.jpg' },
      { name: 'Cucumber (raw)', description: 'Crisp cucumber slices', price: 10.00, calories: 16.0, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'cucumber.jpg' },
      { name: 'Green Beans (cooked)', description: 'Sauteed green beans', price: 15.00, calories: 35.0, protein_g: 1.9, carbs_g: 7.9, fat_g: 0.3, fiber_g: 3.2, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'green_beans.jpg' },
      { name: 'Cabbage (raw)', description: 'Shredded raw cabbage', price: 10.00, calories: 25.0, protein_g: 1.3, carbs_g: 5.8, fat_g: 0.1, fiber_g: 2.5, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'cabbage.jpg' },
      { name: 'Purple Cabbage (raw)', description: 'Antioxidant purple cabbage', price: 14.00, calories: 31.0, protein_g: 1.4, carbs_g: 7.4, fat_g: 0.2, fiber_g: 2.1, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'purple_cabbage.jpg' },
      { name: 'Lettuce (raw)', description: 'Fresh green lettuce leaves', price: 12.00, calories: 15.0, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2, fiber_g: 1.3, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'lettuce.jpg' },
      { name: 'Paneer Cheese Dressing', description: 'Creamy paneer cheese dressing', price: 20.00, calories: 240.0, protein_g: 12.0, carbs_g: 5.0, fat_g: 19.5, fiber_g: 0.2, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'dressing.jpg' },
      { name: 'Broccoli (cooked)', description: 'Steamed fresh broccoli', price: 22.00, calories: 35.0, protein_g: 2.4, carbs_g: 7.2, fat_g: 0.4, fiber_g: 3.3, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'broccoli.jpg' },
      { name: 'Channa with Onions (cooked)', description: 'Seasoned channa with onions', price: 20.00, calories: 140.0, protein_g: 7.5, carbs_g: 22.0, fat_g: 2.2, fiber_g: 6.4, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'channa_onions.jpg' },
      { name: 'Dragon Fruit', description: 'Exotic fresh dragon fruit', price: 35.00, calories: 60.0, protein_g: 1.2, carbs_g: 13.0, fat_g: 0, fiber_g: 2.9, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'dragon_fruit.jpg' },
      { name: 'Orange', description: 'Juicy citrus orange', price: 15.00, calories: 47.0, protein_g: 0.9, carbs_g: 11.8, fat_g: 0.1, fiber_g: 2.4, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'orange.jpg' },
      { name: 'Mango', description: 'Sweet seasonal mango', price: 25.00, calories: 60.0, protein_g: 0.8, carbs_g: 15.0, fat_g: 0.4, fiber_g: 1.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'mango.jpg' },
      { name: 'Apple (with skin)', description: 'Fresh red apple', price: 20.00, calories: 52.0, protein_g: 0.3, carbs_g: 13.8, fat_g: 0.2, fiber_g: 2.4, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'apple.jpg' },
      { name: 'Pomegranate', description: 'Fresh pomegranate seeds', price: 30.00, calories: 75.0, protein_g: 1.1, carbs_g: 18.7, fat_g: 0.7, fiber_g: 4.0, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'pomegranate.jpg' },
      { name: 'Guava', description: 'Crisp green guava', price: 18.00, calories: 68.0, protein_g: 2.6, carbs_g: 14.3, fat_g: 1.0, fiber_g: 5.4, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'guava.jpg' },
      { name: 'Papaya', description: 'Ripe sweet papaya', price: 16.00, calories: 43.0, protein_g: 0.5, carbs_g: 10.8, fat_g: 0.3, fiber_g: 1.7, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'papaya.jpg' },
      { name: 'Watermelon', description: 'Refreshing watermelon cubes', price: 15.00, calories: 30.0, protein_g: 0.6, carbs_g: 7.6, fat_g: 0.2, fiber_g: 0.4, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'watermelon.jpg' },
      { name: 'Grapes', description: 'Sweet seedless grapes', price: 22.00, calories: 69.0, protein_g: 0.7, carbs_g: 18.1, fat_g: 0.2, fiber_g: 0.9, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'grapes.jpg' },
      { name: 'Strawberry', description: 'Fresh strawberries', price: 40.00, calories: 32.0, protein_g: 0.7, carbs_g: 7.7, fat_g: 0.3, fiber_g: 2.0, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'strawberry.jpg' },
      { name: 'Cherry', description: 'Fresh cherries', price: 45.00, calories: 50.0, protein_g: 1.0, carbs_g: 12.2, fat_g: 0.3, fiber_g: 1.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'cherry.jpg' },
      { name: 'Regular Banana', description: 'Classic yellow banana', price: 10.00, calories: 89.0, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'banana.jpg' },
      { name: 'Nendran Banana', description: 'Kerala Nendran banana', price: 15.00, calories: 95.0, protein_g: 1.2, carbs_g: 24.0, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'nendran.jpg' },
      { name: 'Red Banana', description: 'Nutritious red banana', price: 18.00, calories: 92.0, protein_g: 1.3, carbs_g: 21.0, fat_g: 0.3, fiber_g: 3.0, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'red_banana.jpg' },
      { name: 'Rasthali Banana', description: 'Sweet Rasthali banana', price: 12.00, calories: 90.0, protein_g: 1.1, carbs_g: 23.2, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'rasthali.jpg' },
      { name: 'Poovan Banana', description: 'Flavorful Poovan banana', price: 12.00, calories: 104.0, protein_g: 1.2, carbs_g: 26.0, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'poovan.jpg' },
      { name: 'Black Channa (cooked)', description: 'Steamed black chickpeas', price: 16.00, calories: 130.0, protein_g: 6.0, carbs_g: 21.0, fat_g: 2.0, fiber_g: 5.5, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'black_channa.jpg' },
      { name: 'White Channa (cooked)', description: 'Cooked kabuli chana', price: 18.00, calories: 164.0, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, fiber_g: 7.6, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'white_channa.jpg' },
      { name: 'Onion (raw)', description: 'Fresh onion slices', price: 8.00, calories: 40.0, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'onion.jpg' },
      { name: 'Soya', description: 'High protein soya chunks', price: 20.00, calories: 345.0, protein_g: 52.0, carbs_g: 33.0, fat_g: 0.5, fiber_g: 13.0, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'soya.jpg' },
      { name: 'Beetroot', description: 'Fresh boiled beetroot', price: 14.00, calories: 43.0, protein_g: 1.6, carbs_g: 9.6, fat_g: 0.2, fiber_g: 2.8, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'beetroot.jpg' },
      { name: 'Peanut', description: 'Roasted unsalted peanuts', price: 25.00, calories: 567.0, protein_g: 25.8, carbs_g: 16.1, fat_g: 49.2, fiber_g: 8.5, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'peanut.jpg' },
      // Combos
      { name: 'Weight Loss - Combo 1', description: 'White Channa (cooked), Banana, Cucumber', price: 24.00, calories: 269.0, protein_g: 10.7, carbs_g: 53.8, fat_g: 3.0, fiber_g: 10.7, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'combo.jpg' },
      { name: 'Weight Loss - Combo 2', description: 'Black Channa (cooked), Apple, Watermelon', price: 41.00, calories: 212.0, protein_g: 6.9, carbs_g: 42.4, fat_g: 2.4, fiber_g: 8.3, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'combo.jpg' },
      { name: 'Weight Loss - Combo 3', description: 'Soya, Carrot, Nendran Banana', price: 25.00, calories: 481.0, protein_g: 54.1, carbs_g: 66.6, fat_g: 1.0, fiber_g: 18.4, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'combo.jpg' },
      { name: 'Weight Gain - Combo 1', description: 'Soya, Cucumber, Banana', price: 23.00, calories: 450.0, protein_g: 53.8, carbs_g: 59.4, fat_g: 0.9, fiber_g: 16.1, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'combo.jpg' },
      { name: 'Weight Gain - Combo 2', description: 'Sweet Potato, Broccoli, Red Banana', price: 32.00, calories: 203.0, protein_g: 5.1, carbs_g: 45.9, fat_g: 0.8, fiber_g: 8.8, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'combo.jpg' },
    ];

    await MenuItem.bulkCreate(menuItems);
    console.log(`Seeded ${menuItems.length} menu items.`);

    // Seed Subscription Plans (9 plans)
    const plans = [
      { id: '1meal_essential', name: '1 Meal/Day - Essential', meals_per_day: 1, days_per_month: 30, monthly_price: 1999.00, description: 'Single nutritious meal per day', features: ['1 Meal/Day', 'Free Delivery', 'Custom Macros'] },
      { id: '1meal_pro', name: '1 Meal/Day - Pro', meals_per_day: 1, days_per_month: 30, monthly_price: 2499.00, description: 'Pro tier 1 meal with premium ingredients', features: ['1 Meal/Day', 'Priority Delivery', 'Nutritional Advice'] },
      { id: '1meal_elite', name: '1 Meal/Day - Elite', meals_per_day: 1, days_per_month: 30, monthly_price: 2999.00, description: 'Elite tier with personal chef customization', features: ['1 Meal/Day', 'Chef Special', 'Personalized Support'] },
      { id: '2meals_essential', name: '2 Meals/Day - Essential', meals_per_day: 2, days_per_month: 30, monthly_price: 3699.00, description: 'Lunch and Dinner essential plan', features: ['2 Meals/Day', 'Free Delivery', 'Custom Macros'] },
      { id: '2meals_pro', name: '2 Meals/Day - Pro', meals_per_day: 2, days_per_month: 30, monthly_price: 4499.00, description: 'Pro 2 meals plan with snacks included', features: ['2 Meals/Day', 'Free Snacks', 'Priority Support'] },
      { id: '2meals_elite', name: '2 Meals/Day - Elite', meals_per_day: 2, days_per_month: 30, monthly_price: 5299.00, description: 'Elite 2 meals with premium protein choices', features: ['2 Meals/Day', 'Elite Protein Options', 'Dietitian Calls'] },
      { id: '3meals_essential', name: '3 Meals/Day - Essential', meals_per_day: 3, days_per_month: 30, monthly_price: 5499.00, description: 'Complete 3 meals per day coverage', features: ['3 Meals/Day', 'Full Day Nutrition', 'Free Delivery'] },
      { id: '3meals_pro', name: '3 Meals/Day - Pro', meals_per_day: 3, days_per_month: 30, monthly_price: 6499.00, description: 'Complete 3 meals + pre/post workout snacks', features: ['3 Meals/Day', 'Workout Snacks', 'Priority Support'] },
      { id: '3meals_elite', name: '3 Meals/Day - Elite', meals_per_day: 3, days_per_month: 30, monthly_price: 7499.00, description: 'Ultimate customized meal plan', features: ['3 Meals/Day', 'Chef Customization', 'Daily Dietitian Consultation'] },
    ];

    await SubscriptionPlan.bulkCreate(plans);
    console.log(`Seeded ${plans.length} subscription plans.`);

    // Seed Admin & Demo User
    const bcrypt = await import('bcrypt');
    const adminPass = await bcrypt.hash('admin123', 10);
    const adminId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    await User.create({
      id: adminId,
      email: 'admin@fuelbox.com',
      password_hash: adminPass,
      role: 'admin',
    });

    await Profile.create({
      id: adminId,
      email: 'admin@fuelbox.com',
      full_name: 'Fuelbox Super Admin',
      phone: '+18005550199',
      referral_id: 'ADMIN01',
    });

    console.log('Seeded Admin user (admin@fuelbox.com / admin123).');

    await sequelize.close();
    console.log('Database seeding completed successfully!');
  } catch (err) {
    console.error('Database seeding failed:', err);
  }
}

seed();
