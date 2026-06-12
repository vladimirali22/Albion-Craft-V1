import { Item, CraftRecipe, Material } from "./types";

export interface CraftCalculationInput {
  item: Item;
  recipe?: CraftRecipe;
  tier: number;
  enchantment: number;
  quantity: number;
  rrr: number; // e.g. 24.8 for 24.8% RRR
  
  // Custom inputs for Upgraded Calculator
  sellingPrice?: number;         // Manual entry by user
  isPremium?: boolean;           // Tax calculation option
  manualArtifactPrice?: number;  // Manual artifact unit price
  customPrices?: Record<string, number>; // User manual price overrides

  // Future Compatibility Placeholders
  useFocus?: boolean;
  journalsEnabled?: boolean;
  craftingBonuses?: {
    cityBonus?: number;
    activityBonus?: number;
    premiumBonus?: boolean;
    hasSpecialization?: boolean;
    customRrrOverride?: number;
  };
  customMultipliers?: {
    fameMultiplier?: number;
    nutritionMultiplier?: number;
  };
}

export interface MaterialBreakdown {
  materialId: string;       // Fully qualified, e.g. "T6_WOOD_BIRCH@2" or "T5_CULTIST_ROBE_ARTIFACT"
  baseMaterialId: string;   // e.g. "WOOD_BIRCH"
  materialName: string;     // e.g. "T6.2 Planks" or "Cultist Robe Artifact"
  materialType: string;     // e.g. "Wood", "Fiber", "Artifact"
  image_url: string;
  isArtifact: boolean;
  
  // Quantities
  unitBaseQty: number;      // Per-item recipe requirement
  purchasedQty: number;     // Total required upfront (Materials Purchased/Need)
  consumedQty: number;      // Total actually spent after RRR
  leftoverQty: number;      // Leftover material (Purchased - Consumed)
  
  // Pricing/Silver details
  unitPrice: number;
  calculatedCost: number;   // consumedQty * unitPrice
}

export interface LeftoverSummary {
  materialId: string;
  materialName: string;
  purchased: number;
  consumed: number;
  leftover: number;
  isArtifact: boolean;
}

export interface CraftEngineResult {
  fameGained: number;
  nutritionUsed: number;
  materials: MaterialBreakdown[];
  artifacts: MaterialBreakdown[];
  leftovers: LeftoverSummary[];
  totalSilverCost: number;
  
  // New Profit Breakdown fields
  totalRevenue: number;
  setupFee: number;
  transactionTax: number;
  netRevenue: number;
  netProfit: number;
  profitPercentage: number; // percentage based on ROI: (netProfit / totalMaterialCost) * 100
  
  // Future compatibility placeholder for premium/focus/profit
  calculationsExt?: {
    focusCost?: number;
    journalsReturned?: number;
    profitMargin?: number;
    cityTaxPercent?: number;
  };
}

// Helpers for automated image rendering
export const getMaterialImageUrl = (qualifiedId: string) => {
  let code = qualifiedId;
  code = code.replace("WOOD_BIRCH", "PLANKS");
  code = code.replace("MINERAL_ORE", "METALBAR");
  code = code.replace("FIBER_FLAX", "CLOTH");
  code = code.replace("HIDE_LEATHER", "LEATHER");
  code = code.replace("STONE_BLOCK", "STONEBLOCK");
  return `https://render.albiononline.com/v1/item/${code}`;
};

export class CraftCalculationService {
  /**
   * Calculates requirements for standard materials (non-artifacts)
   */
  public static calculateMaterials(
    input: CraftCalculationInput,
    materialsMap: Record<string, Material>,
    priceMap: Record<string, number>
  ): MaterialBreakdown[] {
    const { recipe, qtyToCraft, effectiveRrr, tier, enchantment } = this.preprocessInput(input);
    if (!recipe) return [];
    
    const standardIngredients = recipe.ingredients.filter(ing => !ing.is_artifact_material);

    return standardIngredients.map(ing => {
      const material = materialsMap[ing.material_id];
      const baseQtyRequired = ing.quantity * qtyToCraft;
      
      // Calculate consumed with dynamic RRR 
      const factor = 1 - (Math.min(99, Math.max(0, effectiveRrr)) / 100);
      const consumedQty = Math.ceil(baseQtyRequired * factor);
      const leftoverQty = baseQtyRequired - consumedQty;

      // Build qualified material ID
      const suffix = enchantment > 0 ? `@${enchantment}` : "";
      const fullyQualifiedId = `T${tier}_${ing.material_id}${suffix}`;

      // Support custom prices edited directly inside the table
      let unitPrice = priceMap[fullyQualifiedId] || 0;
      if (input.customPrices && input.customPrices[fullyQualifiedId] !== undefined) {
        unitPrice = input.customPrices[fullyQualifiedId];
      }

      const calculatedCost = consumedQty * unitPrice;

      const displayName = material
        ? `T${tier}.${enchantment} ${material.name}`
        : fullyQualifiedId;

      return {
        materialId: fullyQualifiedId,
        baseMaterialId: ing.material_id,
        materialName: displayName,
        materialType: material ? material.type : "Resource",
        image_url: getMaterialImageUrl(fullyQualifiedId),
        isArtifact: false,
        unitBaseQty: ing.quantity,
        purchasedQty: baseQtyRequired,
        consumedQty,
        leftoverQty,
        unitPrice,
        calculatedCost
      };
    });
  }

  /**
   * Calculates requirements for artifact materials
   */
  public static calculateArtifacts(
    input: CraftCalculationInput,
    materialsMap: Record<string, Material>,
    priceMap: Record<string, number>
  ): MaterialBreakdown[] {
    const { item, qtyToCraft, tier } = this.preprocessInput(input);

    // If the item itself has a designated first-class artifact relationship:
    if (item.is_artifact && item.artifact_id) {
      const artifactId = item.artifact_id;
      const baseQtyRequired = qtyToCraft; // Exactly 1 artifact per item craft
      
      // Artifacts never receive Resource Return Rate (RRR) reductions
      const consumedQty = baseQtyRequired;
      const leftoverQty = 0;

      // Pricing is manually entered from Item-specific pricing input
      const cleanArtifactId = artifactId.replace(/^T[4-8]_/, "");
      const fullyQualifiedId = `T${tier}_${cleanArtifactId}`;

      const unitPrice = (input.manualArtifactPrice !== undefined && input.manualArtifactPrice > 0)
        ? input.manualArtifactPrice
        : (priceMap[fullyQualifiedId] || 0);

      const calculatedCost = consumedQty * unitPrice;

      return [{
        materialId: artifactId,
        baseMaterialId: artifactId,
        materialName: item.artifact_name || artifactId,
        materialType: "Artifact",
        image_url: getMaterialImageUrl(fullyQualifiedId),
        isArtifact: true,
        unitBaseQty: 1,
        purchasedQty: baseQtyRequired,
        consumedQty,
        leftoverQty,
        unitPrice,
        calculatedCost
      }];
    }

    // Classic/Fallback: recipe ingredient matching artifact (with legacy DB support)
    const { recipe } = this.preprocessInput(input);
    if (!recipe) return [];

    const artifactIngredients = recipe.ingredients.filter(ing => !!ing.is_artifact_material);

    return artifactIngredients.map(ing => {
      const material = materialsMap[ing.material_id];
      const baseQtyRequired = ing.quantity * qtyToCraft;
      
      // Artifacts are never reduced by RRR: 100% consumed, 0% leftover
      const consumedQty = baseQtyRequired;
      const leftoverQty = 0;

      // Artifact qualified name
      const cleanMaterialId = ing.material_id.replace(/^T[4-8]_/, "");
      const fullyQualifiedId = `T${tier}_${cleanMaterialId}`;
      // Fallback: check manual artifact pricing or daily prices
      const unitPrice = (input.manualArtifactPrice !== undefined && input.manualArtifactPrice > 0)
        ? input.manualArtifactPrice
        : (priceMap[fullyQualifiedId] || 0);
      const calculatedCost = consumedQty * unitPrice;

      const displayName = material ? material.name : fullyQualifiedId;

      return {
        materialId: fullyQualifiedId,
        baseMaterialId: ing.material_id,
        materialName: displayName,
        materialType: material ? material.type : "Artifact",
        image_url: getMaterialImageUrl(fullyQualifiedId),
        isArtifact: true,
        unitBaseQty: ing.quantity,
        purchasedQty: baseQtyRequired,
        consumedQty,
        leftoverQty,
        unitPrice,
        calculatedCost
      };
    });
  }

  /**
   * Compiles purchase vs consumption to produce structured leftover metrics
   */
  public static calculateLeftovers(breakdowns: MaterialBreakdown[]): LeftoverSummary[] {
    return breakdowns.map(b => ({
      materialId: b.materialId,
      materialName: b.materialName,
      purchased: b.purchasedQty,
      consumed: b.consumedQty,
      leftover: b.leftoverQty,
      isArtifact: b.isArtifact
    }));
  }

  /**
   * Primary orchestrator executing all calculations as the Single Source of Truth
   */
  public static calculateAll(
    input: CraftCalculationInput,
    materialsMap: Record<string, Material>,
    priceMap: Record<string, number>
  ): CraftEngineResult {
    const { item, tier, enchantment, qtyToCraft } = this.preprocessInput(input);

    // Fame Gained Calculations with dynamic Tier/Enchantment scaling
    const tierFameMultipliers: Record<number, number> = { 4: 1, 5: 3, 6: 9, 7: 27, 8: 81 };
    const enchFameMultipliers: Record<number, number> = { 0: 1, 1: 1.5, 2: 2.25, 3: 3.375, 4: 5 };
    
    // Extensible overrides support standard or custom multi
    const fameScale = (input.customMultipliers?.fameMultiplier) || 
      ((tierFameMultipliers[tier] || 1) * (enchFameMultipliers[enchantment] || 1));
    const fameGained = Math.round(item.craft_fame * fameScale) * qtyToCraft;

    // Nutrition Scales with Tier
    const tierNutritionMultipliers: Record<number, number> = { 4: 1, 5: 2, 6: 4, 7: 8, 8: 16 };
    const nutritionScale = (input.customMultipliers?.nutritionMultiplier) || (tierNutritionMultipliers[tier] || 1);
    const nutritionUsed = Math.round(item.nutrition_cost * nutritionScale) * qtyToCraft;

    // Calculate core items using dedicated methods
    const materials = this.calculateMaterials(input, materialsMap, priceMap);
    const artifacts = this.calculateArtifacts(input, materialsMap, priceMap);

    // Combine breakdowns for total leftovers compilation
    const allBreakdowns = [...materials, ...artifacts];
    const leftovers = this.calculateLeftovers(allBreakdowns);

    // Sum silver costs
    const totalSilverCost = allBreakdowns.reduce((sum, current) => sum + current.calculatedCost, 0);

    // Sell & Profit details (Requirements 5, 6)
    const sellingPrice = input.sellingPrice || 0;
    const totalRevenue = sellingPrice * qtyToCraft;

    // Setup Fee: exactly 2.5% of listed price
    const setupFee = Math.round(totalRevenue * 0.025);

    // Transaction Tax: Non-Premium (8%) vs Premium (4%)
    const taxRate = input.isPremium ? 0.04 : 0.08;
    const transactionTax = Math.round(totalRevenue * taxRate);

    // Net results
    const netRevenue = totalRevenue - setupFee - transactionTax;
    const netProfit = netRevenue - totalSilverCost;
    const profitPercentage = totalSilverCost > 0 ? (netProfit / totalSilverCost) * 100 : 0;

    return {
      fameGained,
      nutritionUsed,
      materials,
      artifacts,
      leftovers,
      totalSilverCost,
      totalRevenue,
      setupFee,
      transactionTax,
      netRevenue,
      netProfit,
      profitPercentage,
      // Extensible details
      calculationsExt: {
        focusCost: input.useFocus ? 250 : 0,
        journalsReturned: input.journalsEnabled ? Math.floor(qtyToCraft / 12) : 0,
        profitMargin: 0,
        cityTaxPercent: 8,
      }
    };
  }

  /**
   * Sanitizes and extracts parameters from the request payload
   */
  private static preprocessInput(input: CraftCalculationInput) {
    const tier = Math.min(8, Math.max(4, input.tier));
    const enchantment = Math.min(4, Math.max(0, input.enchantment));
    const qtyToCraft = Math.max(1, input.quantity);
    
    // Extensibility: allow active city bonuses or custom override rates
    const effectiveRrr = input.craftingBonuses?.customRrrOverride !== undefined
      ? input.craftingBonuses.customRrrOverride
      : input.rrr;

    return {
      item: input.item,
      recipe: input.recipe,
      tier,
      enchantment,
      qtyToCraft,
      effectiveRrr
    };
  }
}
