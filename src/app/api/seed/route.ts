import { NextResponse } from 'next/server';
import { getSequelize, defineModels } from '@/lib/db';
import bcrypt from 'bcrypt';

/**
 * Database Seeder
 * ──────────────────────────────────────────────────────────────────────────────
 * Usage: GET /api/seed?secret=YOUR_SEED_SECRET
 *
 * Set SEED_SECRET in your .env file.
 * WARNING: This drops and recreates all tables (force: true).
 *          Never expose this endpoint in production without a strong secret.
 */
export async function GET(req: Request) {
  // ── Auth Guard ──────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const providedSecret = searchParams.get('secret');
  const expectedSecret = process.env.SEED_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — provide ?secret=SEED_SECRET' },
      { status: 403 }
    );
  }

  try {
    const sequelize = getSequelize();
    await sequelize.authenticate();
    const { MenuItem, User, Profile } = defineModels(sequelize);

    // Drop & recreate all tables
    await sequelize.sync({ force: true });

    // ── Menu Items ────────────────────────────────────────────────────────────
    // image_url values MUST match filenames in /public/images/
    const menuItems = [
      // Individual foods — proteins
      { name: 'Chicken Breast (cooked)', description: 'Lean grilled chicken breast', price: 28.00, calories: 165.0, protein_g: 31.0, carbs_g: 0, fat_g: 3.6, fiber_g: 0, diet: 'non_veg', category: 'main', is_available: true, cookable: true, image_url: 'chickenbreast.jpg' },
      { name: 'Paneer', description: 'Fresh cottage cheese', price: 25.00, calories: 275.0, protein_g: 19.0, carbs_g: 2.4, fat_g: 15.0, fiber_g: 0, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'paneer.jpg' },
      { name: 'Egg', description: 'Boiled egg', price: 10.00, calories: 155.0, protein_g: 13.0, carbs_g: 1.1, fat_g: 11.0, fiber_g: 0, diet: 'non_veg', category: 'main', is_available: true, cookable: true, image_url: 'egg.jpg' },
      { name: 'Soya', description: 'High protein soya chunks', price: 20.00, calories: 345.0, protein_g: 52.0, carbs_g: 33.0, fat_g: 0.5, fiber_g: 13.0, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'soya.jpg' },
      { name: 'Peanut', description: 'Roasted unsalted peanuts', price: 25.00, calories: 567.0, protein_g: 25.8, carbs_g: 16.1, fat_g: 49.2, fiber_g: 8.5, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'peanut.jpg' },

      // Individual foods — grains / carbs
      { name: 'White Rice (cooked)', description: 'Steamed white rice', price: 12.00, calories: 130.0, protein_g: 2.7, carbs_g: 28.0, fat_g: 0.3, fiber_g: 0.4, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'whiterice.jpg' },
      { name: 'Chapati (whole wheat)', description: 'Fresh whole wheat chapati', price: 8.00, calories: 299.0, protein_g: 7.9, carbs_g: 46.0, fat_g: 9.2, fiber_g: 9.7, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'chapati.jpg' },
      { name: 'Sweet Potato (boiled)', description: 'Fiber-rich boiled sweet potato', price: 15.00, calories: 76.0, protein_g: 1.4, carbs_g: 17.7, fat_g: 0.1, fiber_g: 2.5, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'sweetpotato.jpg' },

      // Individual foods — legumes
      { name: 'Chickpeas (cooked)', description: 'High protein boiled chickpeas', price: 18.00, calories: 164.0, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, fiber_g: 7.6, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'chickpeas.jpg' },
      { name: 'Black Channa (cooked)', description: 'Steamed black chickpeas', price: 16.00, calories: 130.0, protein_g: 6.0, carbs_g: 21.0, fat_g: 2.0, fiber_g: 5.5, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'blackchanna.jpg' },
      { name: 'White Channa (cooked)', description: 'Cooked kabuli chana', price: 18.00, calories: 164.0, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, fiber_g: 7.6, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'whitechanna.jpg' },
      { name: 'Channa with Onions (cooked)', description: 'Seasoned channa with onions', price: 20.00, calories: 140.0, protein_g: 7.5, carbs_g: 22.0, fat_g: 2.2, fiber_g: 6.4, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'whitechannawithonions.jpg' },

      // Individual foods — vegetables
      { name: 'Carrot (raw)', description: 'Fresh sliced carrot', price: 12.00, calories: 41.0, protein_g: 0.9, carbs_g: 9.6, fat_g: 0.2, fiber_g: 2.8, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'carrot.jpg' },
      { name: 'Cucumber (raw)', description: 'Crisp cucumber slices', price: 10.00, calories: 16.0, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'cucumber.jpg' },
      { name: 'Green Beans (cooked)', description: 'Sauteed green beans', price: 15.00, calories: 35.0, protein_g: 1.9, carbs_g: 7.9, fat_g: 0.3, fiber_g: 3.2, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'greenbeans.jpg' },
      { name: 'Cabbage (raw)', description: 'Shredded raw cabbage', price: 10.00, calories: 25.0, protein_g: 1.3, carbs_g: 5.8, fat_g: 0.1, fiber_g: 2.5, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'cabbage.jpg' },
      { name: 'Purple Cabbage (raw)', description: 'Antioxidant purple cabbage', price: 14.00, calories: 31.0, protein_g: 1.4, carbs_g: 7.4, fat_g: 0.2, fiber_g: 2.1, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'purplecabbage.jpg' },
      { name: 'Lettuce (raw)', description: 'Fresh green lettuce leaves', price: 12.00, calories: 15.0, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2, fiber_g: 1.3, diet: 'veg', category: 'main', is_available: true, cookable: false, image_url: 'lettuce.jpg' },
      { name: 'Broccoli (cooked)', description: 'Steamed fresh broccoli', price: 22.00, calories: 35.0, protein_g: 2.4, carbs_g: 7.2, fat_g: 0.4, fiber_g: 3.3, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'broccolicooked.jpg' },
      { name: 'Beetroot', description: 'Fresh boiled beetroot', price: 14.00, calories: 43.0, protein_g: 1.6, carbs_g: 9.6, fat_g: 0.2, fiber_g: 2.8, diet: 'veg', category: 'side', is_available: true, cookable: true, image_url: 'beetroot.jpg' },
      { name: 'Onion (raw)', description: 'Fresh onion slices', price: 8.00, calories: 40.0, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'onion.jpg' },
      { name: 'Paneer Cheese Dressing', description: 'Creamy paneer cheese dressing', price: 20.00, calories: 240.0, protein_g: 12.0, carbs_g: 5.0, fat_g: 19.5, fiber_g: 0.2, diet: 'veg', category: 'main', is_available: true, cookable: true, image_url: 'paneercheesedressing.jpg' },

      // Individual foods — fruits
      { name: 'Banana', description: 'Fresh energetic banana', price: 10.00, calories: 89.0, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'banana.jpg' },
      { name: 'Regular Banana', description: 'Classic yellow banana', price: 10.00, calories: 89.0, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'regularbanana.jpg' },
      { name: 'Nendran Banana', description: 'Kerala Nendran banana', price: 15.00, calories: 95.0, protein_g: 1.2, carbs_g: 24.0, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'nendranbanana.jpg' },
      { name: 'Red Banana', description: 'Nutritious red banana', price: 18.00, calories: 92.0, protein_g: 1.3, carbs_g: 21.0, fat_g: 0.3, fiber_g: 3.0, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'redbanana.jpg' },
      { name: 'Rasthali Banana', description: 'Sweet Rasthali banana', price: 12.00, calories: 90.0, protein_g: 1.1, carbs_g: 23.2, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'rasthalibanana.jpg' },
      { name: 'Poovan Banana', description: 'Flavorful Poovan banana', price: 12.00, calories: 104.0, protein_g: 1.2, carbs_g: 26.0, fat_g: 0.3, fiber_g: 2.6, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'poovanbanana.jpg' },
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
      { name: 'Dragon Fruit', description: 'Exotic fresh dragon fruit', price: 35.00, calories: 60.0, protein_g: 1.2, carbs_g: 13.0, fat_g: 0, fiber_g: 2.9, diet: 'veg', category: 'side', is_available: true, cookable: false, image_url: 'dragonfruit.jpg' },

      // ── Combos (from import_combos.sql + additional) ───────────────────────
      // Weight Loss combos
      { name: 'Weight Loss - Combo 1', description: 'White Channa (cooked), Banana, Cucumber', price: 24.00, calories: 269.0, protein_g: 10.7, carbs_g: 53.8, fat_g: 3.0, fiber_g: 10.7, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'weight_loss_combo_1.jpg' },
      { name: 'Weight Loss - Combo 2', description: 'Black Channa (cooked), Apple, Watermelon', price: 41.00, calories: 212.0, protein_g: 6.9, carbs_g: 42.4, fat_g: 2.4, fiber_g: 8.3, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'weight_loss_combo_2.jpg' },
      { name: 'Weight Loss - Combo 3', description: 'Soya, Carrot, Nendran Banana', price: 25.00, calories: 481.0, protein_g: 54.1, carbs_g: 66.6, fat_g: 1.0, fiber_g: 18.4, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'weight_loss_combo_3.jpg' },

      // Weight Gain combos
      { name: 'Weight Gain - Combo 1', description: 'Soya, Cucumber, Banana', price: 23.00, calories: 450.0, protein_g: 53.8, carbs_g: 59.4, fat_g: 0.9, fiber_g: 16.1, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'weight_gain_combo_1.jpg' },
      { name: 'Weight Gain - Combo 2', description: 'Sweet Potato (boiled), Broccoli, Red Banana', price: 32.00, calories: 203.0, protein_g: 5.1, carbs_g: 45.9, fat_g: 0.8, fiber_g: 8.8, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'weight_gain_combo_2.jpg' },
      { name: 'Weight Gain - Combo 3', description: 'Black Channa (cooked), Carrot, Nendran Banana', price: 23.00, calories: 266.0, protein_g: 8.1, carbs_g: 54.6, fat_g: 2.5, fiber_g: 10.9, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'weight_gain_combo_3.jpg' },

      // Muscle Gain combos
      { name: 'Muscle Gain - Combo 1', description: 'White Channa (cooked), Cucumber, Guava', price: 23.00, calories: 248.0, protein_g: 12.2, carbs_g: 45.3, fat_g: 3.7, fiber_g: 13.5, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'muscle_gain_combo_1.jpg' },
      { name: 'Muscle Gain - Combo 2', description: 'Black Channa (cooked), Apple, Carrot', price: 45.00, calories: 223.0, protein_g: 7.2, carbs_g: 44.4, fat_g: 2.4, fiber_g: 10.7, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'muscle_gain_combo_2.jpg' },
      { name: 'Muscle Gain - Combo 3', description: 'Soya, Papaya, Cabbage (raw)', price: 17.00, calories: 413.0, protein_g: 53.8, carbs_g: 49.6, fat_g: 0.9, fiber_g: 17.2, diet: 'veg', category: 'combo', is_available: true, cookable: false, image_url: 'muscle_gain_combo_3.jpg' },
    ];

    await (MenuItem as any).bulkCreate(menuItems);

    // ── Admin User ────────────────────────────────────────────────────────────
    const adminPass = await bcrypt.hash('admin123', 12);
    const adminId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    await (User as any).create({
      id: adminId,
      email: 'admin@fuelbox.com',
      password_hash: adminPass,
      role: 'admin',
    });
    await (Profile as any).create({
      id: adminId,
      email: 'admin@fuelbox.com',
      full_name: 'Fuelbox Super Admin',
      phone: '+919876543210',
      referral_id: 'ADMIN01',
    });

    return NextResponse.json({
      success: true,
      message: `Database seeded successfully with ${menuItems.length} menu items (including 9 combos) and Admin account.`,
      counts: {
        menuItems: menuItems.length,
        combos: 9,
        individualFoods: menuItems.length - 9,
      },
    });
  } catch (error: any) {
    console.error('[Seed] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
