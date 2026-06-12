-- ==========================================
-- ALBION CRAFT CALCULATOR - MySQL SCHEMA
-- Normalized Database Structure
-- ==========================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `albion_craft_calc` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `albion_craft_calc`;

-- 1. Materials Table
CREATE TABLE IF NOT EXISTS `materials` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `image_url` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Items Table
CREATE TABLE IF NOT EXISTS `items` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `parent_tree` VARCHAR(150) NOT NULL,
  `is_artifact` TINYINT(1) DEFAULT 0,
  `craft_fame` INT DEFAULT 0,
  `nutrition_cost` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Craft Recipes Table (Normalized association table)
CREATE TABLE IF NOT EXISTS `recipes` (
  `item_id` VARCHAR(100) NOT NULL,
  `material_id` VARCHAR(100) NOT NULL,
  `quantity` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`, `material_id`),
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Daily Material Prices Table
CREATE TABLE IF NOT EXISTS `daily_prices` (
  `material_id` VARCHAR(100) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`material_id`),
  FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Admins Table
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `username` VARCHAR(100) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- SEED INITIAL DATA FOR TESTING
-- ==========================================

INSERT INTO `admins` (`username`, `password_hash`) VALUES ('admin', '4bb613bc'); -- Simple default key

-- Initial Materials
INSERT INTO `materials` (`id`, `name`, `type`, `image_url`) VALUES
('T4_MINERAL_ORE', 'T4 Ore (Copper)', 'Ore', 'https://images.unsplash.com/photo-1518152006812-edab29b069ac?w=80&h=80&fit=crop'),
('T5_MINERAL_ORE', 'T5 Ore (Iron)', 'Ore', 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=80&h=80&fit=crop'),
('T6_MINERAL_ORE', 'T6 Ore (Runite)', 'Ore', 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=80&h=80&fit=crop'),
('T7_MINERAL_ORE', 'T7 Ore (Meteorite)', 'Ore', 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=80&h=80&fit=crop'),
('T8_MINERAL_ORE', 'T8 Ore (Titanium)', 'Ore', 'https://images.unsplash.com/photo-1543157145-f78b636d023d?w=80&h=80&fit=crop'),
('T4_FIBER_FLAX', 'T4 Fiber (Flax)', 'Fiber', 'https://images.unsplash.com/photo-1576426863848-c2df8b130e8e?w=80&h=80&fit=crop'),
('T5_FIBER_FLAX', 'T5 Fiber (Skyflower)', 'Fiber', 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=80&h=80&fit=crop'),
('T6_FIBER_FLAX', 'T6 Fiber (Amber)', 'Fiber', 'https://images.unsplash.com/photo-1463171359979-300627eb66fda?w=80&h=80&fit=crop'),
('T4_WOOD_BIRCH', 'T4 Wood (Birch)', 'Wood', 'https://images.unsplash.com/photo-1588880331179-bc9b93a8c5c2?w=80&h=80&fit=crop'),
('T5_WOOD_CEDAR', 'T5 Wood (Cedar)', 'Wood', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=80&fit=crop'),
('T6_WOOD_BLOODOAK', 'T6 Wood (Bloodoak)', 'Wood', 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=80&h=80&fit=crop'),
('T4_HIDE_LEATHER', 'T4 Hide (Leather)', 'Hide', 'https://images.unsplash.com/photo-1524275539700-cf5113cdc074?w=80&h=80&fit=crop'),
('T5_HIDE_LEATHER', 'T5 Hide (Reinforced)', 'Hide', 'https://images.unsplash.com/photo-1582201942988-13e60e4556ee?w=80&h=80&fit=crop'),
('T6_HIDE_LEATHER', 'T6 Hide (Red Hide)', 'Hide', 'https://images.unsplash.com/photo-1590736969955-71cb9480175b?w=80&h=80&fit=crop')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Initial Items
INSERT INTO `items` (`id`, `name`, `category`, `parent_tree`, `is_artifact`, `craft_fame`, `nutrition_cost`) VALUES
('T4_MAIN_BOW', 'T4 Bow', 'Weapon', 'Bows', 0, 120, 16),
('T5_MAIN_BOW', 'T5 Bow', 'Weapon', 'Bows', 0, 360, 32),
('T6_MAIN_BOW', 'T6 Bow', 'Weapon', 'Bows', 0, 1080, 64),
('T4_MAIN_GREATSWORD', 'T4 Greatsword', 'Weapon', 'Swords', 0, 150, 20),
('T5_MAIN_GREATSWORD', 'T5 Greatsword', 'Weapon', 'Swords', 0, 450, 40),
('T4_MAGE_ROBE_CLERIC', 'T4 Cleric Robe', 'Armor', 'Mage Armor', 0, 60, 10),
('T5_MAGE_ROBE_CLERIC', 'T5 Cleric Robe', 'Armor', 'Mage Armor', 0, 180, 20),
('T6_MAGE_ROBE_CULTIST', 'T6 Cultist Robe', 'Armor', 'Mage Armor', 1, 540, 40)
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Initial Recipes
INSERT INTO `recipes` (`item_id`, `material_id`, `quantity`) VALUES
('T4_MAIN_BOW', 'T4_WOOD_BIRCH', 32),
('T4_MAIN_BOW', 'T4_HIDE_LEATHER', 8),
('T5_MAIN_BOW', 'T5_WOOD_CEDAR', 32),
('T5_MAIN_BOW', 'T5_HIDE_LEATHER', 8),
('T6_MAIN_BOW', 'T6_WOOD_BLOODOAK', 32),
('T6_MAIN_BOW', 'T6_HIDE_LEATHER', 8),
('T4_MAIN_GREATSWORD', 'T4_MINERAL_ORE', 32),
('T4_MAIN_GREATSWORD', 'T4_HIDE_LEATHER', 8),
('T5_MAIN_GREATSWORD', 'T5_MINERAL_ORE', 32),
('T5_MAIN_GREATSWORD', 'T5_HIDE_LEATHER', 8),
('T4_MAGE_ROBE_CLERIC', 'T4_FIBER_FLAX', 16),
('T5_MAGE_ROBE_CLERIC', 'T5_FIBER_FLAX', 16),
('T6_MAGE_ROBE_CULTIST', 'T6_FIBER_FLAX', 16)
ON DUPLICATE KEY UPDATE `item_id`=`item_id`;

-- Initial Prices
INSERT INTO `daily_prices` (`material_id`, `price`) VALUES
('T4_MINERAL_ORE', 90.00),
('T5_MINERAL_ORE', 245.00),
('T6_MINERAL_ORE', 780.00),
('T7_MINERAL_ORE', 2100.00),
('T8_MINERAL_ORE', 8900.00),
('T4_FIBER_FLAX', 80.00),
('T5_FIBER_FLAX', 210.00),
('T6_FIBER_FLAX', 690.00),
('T4_WOOD_BIRCH', 75.00),
('T5_WOOD_CEDAR', 195.00),
('T6_WOOD_BLOODOAK', 620.00),
('T4_HIDE_LEATHER', 100.00),
('T5_HIDE_LEATHER', 280.00),
('T6_HIDE_LEATHER', 810.00)
ON DUPLICATE KEY UPDATE `material_id`=`material_id`;
