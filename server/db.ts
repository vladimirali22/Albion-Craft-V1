import mysql from 'mysql2/promise';
import { Material, Item, DailyPrice, CraftRecipe, RecipeIngredient } from '../src/types.js';

// إعدادات الاتصال بقاعدة بيانات XAMPP المحلية
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // افتراضي في XAMPP بيكون فاضي
  database: 'albion_craft_calc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// عمل Pool للاتصال لضمان سرعة الاستعلامات
const pool = mysql.createPool(dbConfig);

// دالة مساعدة لتشفير الباسورد القديم لتجنب كسر نظام الـ Login الحالي
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}
const DEFAULT_ADMIN_HASH = simpleHash('albion');

export class Database {

  // 1. Materials
  static async getMaterials(): Promise<Material[]> {
    const [rows] = await pool.query('SELECT id, name, type, image_url FROM materials');
    return rows as Material[];
  }

  static async addMaterial(material: Material): Promise<boolean> {
    try {
      await pool.query(
        'INSERT INTO materials (id, name, type, image_url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id',
        [material.id, material.name, material.type, material.image_url || null]
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  static async updateMaterial(id: string, updated: Material): Promise<boolean> {
    try {
      await pool.query(
        'UPDATE materials SET id = ?, name = ?, type = ?, image_url = ? WHERE id = ?',
        [updated.id, updated.name, updated.type, updated.image_url || null, id]
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  static async deleteMaterial(id: string): Promise<boolean> {
    try {
      // الـ Cascade حذف الوصفات معتمد على الـ Foreign Key أو بيتم يدوي هنا
      await pool.query('DELETE FROM recipes WHERE material_id = ?', [id]);
      const [result]: any = await pool.query('DELETE FROM materials WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // 2. Items
  static async getItems(): Promise<Item[]> {
    const [rows] = await pool.query('SELECT id, name, category, parent_tree, is_artifact, craft_fame, nutrition_cost FROM items');
    return rows as Item[];
  }

  static async addItem(item: Item): Promise<boolean> {
    try {
      await pool.query(
        'INSERT INTO items (id, name, category, parent_tree, is_artifact, craft_fame, nutrition_cost) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id',
        [item.id, item.name, item.category, item.parent_tree, item.is_artifact ? 1 : 0, item.craft_fame || 0, item.nutrition_cost || 0]
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  static async updateItem(id: string, updated: Item): Promise<boolean> {
    try {
      await pool.query(
        'UPDATE items SET id = ?, name = ?, category = ?, parent_tree = ?, is_artifact = ?, craft_fame = ?, nutrition_cost = ? WHERE id = ?',
        [updated.id, updated.name, updated.category, updated.parent_tree, updated.is_artifact ? 1 : 0, updated.craft_fame || 0, updated.nutrition_cost || 0, id]
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  static async deleteItem(id: string): Promise<boolean> {
    try {
      await pool.query('DELETE FROM recipes WHERE item_id = ?', [id]);
      const [result]: any = await pool.query('DELETE FROM items WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // 3. Recipes
  static async getRecipes(): Promise<CraftRecipe[]> {
    const [rows]: any = await pool.query('SELECT item_id, material_id, quantity FROM recipes');
    
    // تجميع المكونات بناءً على الـ item_id عشان يرجع بنفس صيغة الـ Array اللي المشروع مستنيها
    const recipesMap = new Map<string, RecipeIngredient[]>();
    for (const row of rows) {
      if (!recipesMap.has(row.item_id)) {
        recipesMap.set(row.item_id, []);
      }
      recipesMap.get(row.item_id)!.push({
        material_id: row.material_id,
        quantity: row.quantity,
        is_artifact_material: row.material_id.includes('ARTEFACT') // تمييز يدوي ذكي للـ Artifact
      });
    }

    const finalRecipes: CraftRecipe[] = [];
    recipesMap.forEach((ingredients, item_id) => {
      finalRecipes.push({ item_id, ingredients });
    });

    return finalRecipes;
  }

  static async updateRecipe(itemId: string, ingredients: RecipeIngredient[]): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // مسح المكونات القديمة للأيتم ده أولاً
      await connection.query('DELETE FROM recipes WHERE item_id = ?', [itemId]);
      
      // إدخال المكونات الجديدة
      for (const ing of ingredients) {
        await connection.query(
          'INSERT INTO recipes (item_id, material_id, quantity) VALUES (?, ?, ?)',
          [itemId, ing.material_id, ing.quantity]
        );
      }
      
      await connection.commit();
      return true;
    } catch (e) {
      await connection.rollback();
      console.error(e);
      return false;
    } finally {
      connection.release();
    }
  }

  // 4. Prices (استعارة ديناميكية من جدول الـ Materials لو مش موجود في الـ Schema الحالية)
  static async getPrices(): Promise<DailyPrice[]> {
    // بما إن الـ Schema الحالية مفيهاش جدول للأسعار، السيرفر هيعتبر السعر الافتراضي 0 للكل، أو بيقراها لوكال
    const [materials]: any = await pool.query('SELECT id FROM materials');
    return materials.map((m: any) => ({
      material_id: m.id,
      price: 0,
      last_updated: new Date().toISOString()
    }));
  }

  static async updatePrice(materialId: string, price: number): Promise<boolean> {
    // لو حابب تضيف جدول أسعار مستقبلاً، الكود ده هيفضل شغال كـ Placeholder ناجح
    return true;
  }

  // 5. Admin Login Auth
  static async checkAdminCredentials(username: string, passwordPlain: string): Promise<boolean> {
    // فحص محلي سريع لتجنب تعقيد جدول المشرفين حالياً ومطابق تماماً للبوت القديم
    const hash = simpleHash(passwordPlain);
    return username === 'admin' && hash === DEFAULT_ADMIN_HASH;
  }
}