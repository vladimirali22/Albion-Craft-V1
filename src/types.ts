export interface Material {
  id: string; // Base Material ID (e.g. "WOOD_BIRCH", "CULTIST_ROBE_ARTIFACT")
  name: string;
  type: string; // e.g. "Ore", "Fiber", "Wood", "Hide", "Stone", "Artifact"
  image_url?: string; // Optional if fallback to Albion Render API is used
}

export interface Item {
  id: string; // Base Item ID (e.g. "HEAD_PLATE_FEY", "MAIN_BOW", "MAIN_GREATSWORD")
  name: string;
  parent_tree: string; // e.g. "Plate Helmet", "Cloth Helmet", "Leather Helmet", etc.
  category: string; // e.g. "Weapon", "Armor", "Accessory"
  is_artifact: boolean;
  craft_fame: number; // Base craft fame
  nutrition_cost: number; // Base nutrition cost
  artifact_name?: string;
  artifact_id?: string;
}

export interface RecipeIngredient {
  material_id: string;
  quantity: number;
  is_artifact_material: boolean; // Flag to specify artifact material rules
}

export interface CraftRecipe {
  item_id: string; // References Item.id (Base Item ID)
  ingredients: RecipeIngredient[];
}

export interface DailyPrice {
  material_id: string; // Fully qualified (e.g. "T6_WOOD_BIRCH@2" or "T6_CULTIST_ROBE_ARTIFACT")
  price: number;
  last_updated: string; // Date string
}

export interface DatabaseState {
  materials: Material[];
  items: Item[];
  recipes: CraftRecipe[];
  prices: DailyPrice[];
  adminConfig: {
    username: string;
    passwordHash: string;
  };
}

