-- FuelBox Local MySQL Seed Script for DBeaver
-- Database: fuelbox_db

CREATE DATABASE IF NOT EXISTS `fuelbox_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fuelbox_db`;

-- 1. Drop existing tables if re-seeding
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `profiles`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `subscription_plans`;
DROP TABLE IF EXISTS `menu_items`;

-- 2. Create Menu Items Table
CREATE TABLE `menu_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(8, 2) DEFAULT '0.00',
  `calories` DECIMAL(7, 1) DEFAULT '0.0',
  `protein_g` DECIMAL(6, 1) DEFAULT '0.0',
  `carbs_g` DECIMAL(6, 1) DEFAULT '0.0',
  `fat_g` DECIMAL(6, 1) DEFAULT '0.0',
  `fiber_g` DECIMAL(6, 1) DEFAULT '0.0',
  `score` DECIMAL(5, 1) DEFAULT '0.0',
  `diet` VARCHAR(50) DEFAULT 'veg',
  `category` VARCHAR(50) DEFAULT 'main',
  `is_available` TINYINT(1) DEFAULT '1',
  `cookable` TINYINT(1) DEFAULT '0',
  `image_url` VARCHAR(255) DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Create Subscription Plans Table
CREATE TABLE `subscription_plans` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `meals_per_day` INT DEFAULT '1',
  `days_per_month` INT DEFAULT '30',
  `monthly_price` DECIMAL(8, 2) DEFAULT '0.00',
  `description` TEXT,
  `features` JSON,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Create Users Table
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'user',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Create Profiles Table
CREATE TABLE `profiles` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `full_name` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `referral_id` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Create Orders Table
CREATE TABLE `orders` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `address` TEXT,
  `city` VARCHAR(100) DEFAULT NULL,
  `pincode` VARCHAR(20) DEFAULT NULL,
  `cost` DECIMAL(8, 2) DEFAULT '0.00',
  `selected_meals` JSON,
  `delivery_times` JSON,
  `status` VARCHAR(50) DEFAULT 'pending',
  `type` VARCHAR(50) DEFAULT 'meal',
  `plan_id` VARCHAR(100) DEFAULT NULL,
  `menu_selected` JSON,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Insert Menu Items (44 items)
INSERT INTO `menu_items` (`id`, `name`, `description`, `price`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `diet`, `category`, `is_available`, `cookable`, `image_url`) VALUES
(1, 'Chicken Breast (cooked)', 'Lean grilled chicken breast', 28.00, 165.0, 31.0, 0.0, 3.6, 0.0, 'non_veg', 'main', 1, 1, 'chicken.jpg'),
(2, 'Paneer', 'Fresh cottage cheese', 25.00, 275.0, 19.0, 2.4, 15.0, 0.0, 'veg', 'main', 1, 1, 'paneer.jpg'),
(3, 'Chickpeas (cooked)', 'High protein boiled chickpeas', 18.00, 164.0, 8.9, 27.4, 2.6, 7.6, 'veg', 'side', 1, 1, 'chickpeas.jpg'),
(4, 'Sweet Potato (boiled)', 'Fiber-rich boiled sweet potato', 15.00, 76.0, 1.4, 17.7, 0.1, 2.5, 'veg', 'main', 1, 1, 'sweet_potato.jpg'),
(5, 'Banana', 'Fresh energetic banana', 10.00, 89.0, 1.1, 22.8, 0.3, 2.6, 'veg', 'side', 1, 0, 'banana.jpg'),
(6, 'White Rice (cooked)', 'Steamed white rice', 12.00, 130.0, 2.7, 28.0, 0.3, 0.4, 'veg', 'main', 1, 1, 'rice.jpg'),
(7, 'Chapati (whole wheat)', 'Fresh whole wheat chapati', 8.00, 299.0, 7.9, 46.0, 9.2, 9.7, 'veg', 'main', 1, 1, 'chapati.jpg'),
(8, 'Egg', 'Boiled egg', 10.00, 155.0, 13.0, 1.1, 11.0, 0.0, 'non_veg', 'main', 1, 1, 'egg.jpg'),
(9, 'Carrot (raw)', 'Fresh sliced carrot', 12.00, 41.0, 0.9, 9.6, 0.2, 2.8, 'veg', 'side', 1, 0, 'carrot.jpg'),
(10, 'Cucumber (raw)', 'Crisp cucumber slices', 10.00, 16.0, 0.7, 3.6, 0.1, 0.5, 'veg', 'side', 1, 0, 'cucumber.jpg'),
(11, 'Green Beans (cooked)', 'Sauteed green beans', 15.00, 35.0, 1.9, 7.9, 0.3, 3.2, 'veg', 'side', 1, 1, 'green_beans.jpg'),
(12, 'Cabbage (raw)', 'Shredded raw cabbage', 10.00, 25.0, 1.3, 5.8, 0.1, 2.5, 'veg', 'side', 1, 1, 'cabbage.jpg'),
(13, 'Purple Cabbage (raw)', 'Antioxidant purple cabbage', 14.00, 31.0, 1.4, 7.4, 0.2, 2.1, 'veg', 'side', 1, 1, 'purple_cabbage.jpg'),
(14, 'Lettuce (raw)', 'Fresh green lettuce leaves', 12.00, 15.0, 1.4, 2.9, 0.2, 1.3, 'veg', 'main', 1, 1, 'lettuce.jpg'),
(15, 'Paneer Cheese Dressing', 'Creamy paneer cheese dressing', 20.00, 240.0, 12.0, 5.0, 19.5, 0.2, 'veg', 'main', 1, 1, 'dressing.jpg'),
(16, 'Broccoli (cooked)', 'Steamed fresh broccoli', 22.00, 35.0, 2.4, 7.2, 0.4, 3.3, 'veg', 'side', 1, 1, 'broccoli.jpg'),
(17, 'Channa with Onions (cooked)', 'Seasoned channa with onions', 20.00, 140.0, 7.5, 22.0, 2.2, 6.4, 'veg', 'side', 1, 1, 'channa_onions.jpg'),
(18, 'Dragon Fruit', 'Exotic fresh dragon fruit', 35.00, 60.0, 1.2, 13.0, 0.0, 2.9, 'veg', 'side', 1, 0, 'dragon_fruit.jpg'),
(19, 'Orange', 'Juicy citrus orange', 15.00, 47.0, 0.9, 11.8, 0.1, 2.4, 'veg', 'side', 1, 0, 'orange.jpg'),
(20, 'Mango', 'Sweet seasonal mango', 25.00, 60.0, 0.8, 15.0, 0.4, 1.6, 'veg', 'side', 1, 0, 'mango.jpg'),
(21, 'Apple (with skin)', 'Fresh red apple', 20.00, 52.0, 0.3, 13.8, 0.2, 2.4, 'veg', 'side', 1, 0, 'apple.jpg'),
(22, 'Pomegranate', 'Fresh pomegranate seeds', 30.00, 75.0, 1.1, 18.7, 0.7, 4.0, 'veg', 'side', 1, 0, 'pomegranate.jpg'),
(23, 'Guava', 'Crisp green guava', 18.00, 68.0, 2.6, 14.3, 1.0, 5.4, 'veg', 'side', 1, 0, 'guava.jpg'),
(24, 'Papaya', 'Ripe sweet papaya', 16.00, 43.0, 0.5, 10.8, 0.3, 1.7, 'veg', 'side', 1, 0, 'papaya.jpg'),
(25, 'Watermelon', 'Refreshing watermelon cubes', 15.00, 30.0, 0.6, 7.6, 0.2, 0.4, 'veg', 'side', 1, 0, 'watermelon.jpg'),
(26, 'Grapes', 'Sweet seedless grapes', 22.00, 69.0, 0.7, 18.1, 0.2, 0.9, 'veg', 'side', 1, 0, 'grapes.jpg'),
(27, 'Strawberry', 'Fresh strawberries', 40.00, 32.0, 0.7, 7.7, 0.3, 2.0, 'veg', 'side', 1, 0, 'strawberry.jpg'),
(28, 'Cherry', 'Fresh cherries', 45.00, 50.0, 1.0, 12.2, 0.3, 1.6, 'veg', 'side', 1, 0, 'cherry.jpg'),
(29, 'Regular Banana', 'Classic yellow banana', 10.00, 89.0, 1.1, 22.8, 0.3, 2.6, 'veg', 'side', 1, 0, 'banana.jpg'),
(30, 'Nendran Banana', 'Kerala Nendran banana', 15.00, 95.0, 1.2, 24.0, 0.3, 2.6, 'veg', 'side', 1, 0, 'nendran.jpg'),
(31, 'Red Banana', 'Nutritious red banana', 18.00, 92.0, 1.3, 21.0, 0.3, 3.0, 'veg', 'side', 1, 0, 'red_banana.jpg'),
(32, 'Rasthali Banana', 'Sweet Rasthali banana', 12.00, 90.0, 1.1, 23.2, 0.3, 2.6, 'veg', 'side', 1, 0, 'rasthali.jpg'),
(33, 'Poovan Banana', 'Flavorful Poovan banana', 12.00, 104.0, 1.2, 26.0, 0.3, 2.6, 'veg', 'side', 1, 0, 'poovan.jpg'),
(34, 'Black Channa (cooked)', 'Steamed black chickpeas', 16.00, 130.0, 6.0, 21.0, 2.0, 5.5, 'veg', 'side', 1, 1, 'black_channa.jpg'),
(35, 'White Channa (cooked)', 'Cooked kabuli chana', 18.00, 164.0, 8.9, 27.4, 2.6, 7.6, 'veg', 'side', 1, 1, 'white_channa.jpg'),
(36, 'Onion (raw)', 'Fresh onion slices', 8.00, 40.0, 1.1, 9.3, 0.1, 1.7, 'veg', 'side', 1, 0, 'onion.jpg'),
(37, 'Soya', 'High protein soya chunks', 20.00, 345.0, 52.0, 33.0, 0.5, 13.0, 'veg', 'main', 1, 1, 'soya.jpg'),
(38, 'Beetroot', 'Fresh boiled beetroot', 14.00, 43.0, 1.6, 9.6, 0.2, 2.8, 'veg', 'side', 1, 1, 'beetroot.jpg'),
(39, 'Peanut', 'Roasted unsalted peanuts', 25.00, 567.0, 25.8, 16.1, 49.2, 8.5, 'veg', 'side', 1, 1, 'peanut.jpg'),
(40, 'Weight Loss - Combo 1', 'White Channa (cooked), Banana, Cucumber', 24.00, 269.0, 10.7, 53.8, 3.0, 10.7, 'veg', 'combo', 1, 0, 'combo.jpg'),
(41, 'Weight Loss - Combo 2', 'Black Channa (cooked), Apple, Watermelon', 41.00, 212.0, 6.9, 42.4, 2.4, 8.3, 'veg', 'combo', 1, 0, 'combo.jpg'),
(42, 'Weight Loss - Combo 3', 'Soya, Carrot, Nendran Banana', 25.00, 481.0, 54.1, 66.6, 1.0, 18.4, 'veg', 'combo', 1, 0, 'combo.jpg'),
(43, 'Weight Gain - Combo 1', 'Soya, Cucumber, Banana', 23.00, 450.0, 53.8, 59.4, 0.9, 16.1, 'veg', 'combo', 1, 0, 'combo.jpg'),
(44, 'Weight Gain - Combo 2', 'Sweet Potato, Broccoli, Red Banana', 32.00, 203.0, 5.1, 45.9, 0.8, 8.8, 'veg', 'combo', 1, 0, 'combo.jpg');

-- 8. Insert Subscription Plans (9 plans)
INSERT INTO `subscription_plans` (`id`, `name`, `meals_per_day`, `days_per_month`, `monthly_price`, `description`, `features`) VALUES
('1meal_essential', '1 Meal/Day - Essential', 1, 30, 1999.00, 'Single nutritious meal per day', '["1 Meal/Day", "Free Delivery", "Custom Macros"]'),
('1meal_pro', '1 Meal/Day - Pro', 1, 30, 2499.00, 'Pro tier 1 meal with premium ingredients', '["1 Meal/Day", "Priority Delivery", "Nutritional Advice"]'),
('1meal_elite', '1 Meal/Day - Elite', 1, 30, 2999.00, 'Elite tier with personal chef customization', '["1 Meal/Day", "Chef Special", "Personalized Support"]'),
('2meals_essential', '2 Meals/Day - Essential', 2, 30, 3699.00, 'Lunch and Dinner essential plan', '["2 Meals/Day", "Free Delivery", "Custom Macros"]'),
('2meals_pro', '2 Meals/Day - Pro', 2, 30, 4499.00, 'Pro 2 meals plan with snacks included', '["2 Meals/Day", "Free Snacks", "Priority Support"]'),
('2meals_elite', '2 Meals/Day - Elite', 2, 30, 5299.00, 'Elite 2 meals with premium protein choices', '["2 Meals/Day", "Elite Protein Options", "Dietitian Calls"]'),
('3meals_essential', '3 Meals/Day - Essential', 3, 30, 5499.00, 'Complete 3 meals per day coverage', '["3 Meals/Day", "Full Day Nutrition", "Free Delivery"]'),
('3meals_pro', '3 Meals/Day - Pro', 3, 30, 6499.00, 'Complete 3 meals + pre/post workout snacks', '["3 Meals/Day", "Workout Snacks", "Priority Support"]'),
('3meals_elite', '3 Meals/Day - Elite', 3, 30, 7499.00, 'Ultimate customized meal plan', '["3 Meals/Day", "Chef Customization", "Daily Dietitian Consultation"]');

-- 9. Insert Admin User (Email: admin@fuelbox.com / Password: admin123)
INSERT INTO `users` (`id`, `email`, `password_hash`, `role`) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@fuelbox.com', '$2b$10$wEhhwW/J3m92EStq7d34r.3jH.50l1D13H0S1yS/N1J5g.K2H.52.', 'admin');

-- 10. Insert Admin Profile
INSERT INTO `profiles` (`id`, `email`, `full_name`, `phone`, `referral_id`) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@fuelbox.com', 'Fuelbox Super Admin', '+919876543210', 'ADMIN01');

-- 11. Insert Sample Customer Orders
INSERT INTO `orders` (`id`, `user_id`, `phone`, `address`, `city`, `pincode`, `cost`, `selected_meals`, `status`, `type`) VALUES
('c101c3d4-e5f6-7890-abcd-ef1234567891', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '+91 98765 43210', '123 Fitness Street, RS Puram', 'Coimbatore', '641002', 1250.00, '[{"name": "Weight Loss - Combo 1", "price": 240, "qty": 2}, {"name": "Chicken Breast", "price": 280, "qty": 2}]', 'completed', 'meal'),
('c102c3d4-e5f6-7890-abcd-ef1234567892', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '+91 98765 43210', '45 Race Course Road', 'Coimbatore', '641018', 3699.00, '[{"name": "2 Meals/Day - Essential", "price": 3699, "qty": 1}]', 'active', 'subscription');

SELECT '✅ FuelBox MySQL database seed completed successfully!' AS status;
