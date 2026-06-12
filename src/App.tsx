import React, { useState, useEffect, useMemo } from 'react';
import { CraftCalculationService } from './CraftCalculationService';
import { MultipleCraftingCalculator, parseAlbionNumber, SessionItem } from './components/MultipleCraftingCalculator';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Calculator as CalcIcon, 
  Layers, 
  Database as DBIcon, 
  Coins, 
  Search, 
  Lock, 
  Unlock, 
  LogOut, 
  Check, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  Info,
  ChevronRight,
  TrendingUp,
  Package,
  Wrench,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  MapPin
} from 'lucide-react';

// Interfaces matching backend
interface Material {
  id: string;
  name: string;
  type: string;
  image_url?: string;
}

interface Item {
  id: string;
  name: string;
  category: string;
  parent_tree: string;
  is_artifact: boolean;
  craft_fame: number;
  nutrition_cost: number;
  artifact_name?: string;
  artifact_id?: string;
}

interface RecipeIngredient {
  material_id: string;
  quantity: number;
  is_artifact_material: boolean;
}

interface CraftRecipe {
  item_id: string;
  ingredients: RecipeIngredient[];
}

interface DailyPrice {
  material_id: string;
  price: number;
  last_updated: string;
}

interface SessionSummary {
  id: string;
  timestamp: string;
  items: { name: string; qty: number; tier: number; enchantment: number }[];
  totalCost: number;
  totalRevenue: number;
  netProfit: number;
}

const PARENT_TREES = [
  'Plate Helmet',
  'Cloth Helmet',
  'Leather Helmet',
  'Plate Armor',
  'Cloth Armor',
  'Leather Armor',
  'Bag',
  'Cape',
  'Weapon'
];

// Mappings for Material IDs to official Albion Online item codes for accurate automated rendering
const getMaterialImageUrl = (qualifiedId: string) => {
  let code = qualifiedId;
  code = code.replace('WOOD_BIRCH', 'PLANKS');
  code = code.replace('MINERAL_ORE', 'METALBAR');
  code = code.replace('FIBER_FLAX', 'CLOTH');
  code = code.replace('HIDE_LEATHER', 'LEATHER');
  code = code.replace('STONE_BLOCK', 'STONEBLOCK');
  return `https://render.albiononline.com/v1/item/${code}`;
};

const getItemImageUrl = (baseItemId: string, tier: number, enchantment: number) => {
  const suffix = enchantment > 0 ? `@${enchantment}` : '';
  return `https://render.albiononline.com/v1/item/T${tier}_${baseItemId}${suffix}`;
};

export default function App() {
  // Authentication & session state
  const [token, setToken] = useState<string | null>(localStorage.getItem('albion_token'));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  
  // App data state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [recipes, setRecipes] = useState<CraftRecipe[]>([]);
  const [prices, setPrices] = useState<DailyPrice[]>([]);
  
  // Selection / Navigation
  const [activeTab, setActiveTab] = useState<'calculator' | 'multiple_crafting' | 'session_history' | 'materials' | 'items' | 'recipes' | 'prices'>('calculator');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calculator input state
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false);
  const [craftQuantity, setCraftQuantity] = useState<number>(10);
  const [rrr, setRrr] = useState<number>(24.8); // Resource Return Rate e.g. 24.8% for city crafting with focus/activity
  const [selectedTier, setSelectedTier] = useState<number>(4);
  const [selectedEnchantment, setSelectedEnchantment] = useState<number>(0);
  const [selectedParentTreeFilter, setSelectedParentTreeFilter] = useState<string>('');
  
  // Upgraded pricing and calculator fields (Requirements 3, 4, 5, 7)
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [sellPriceInput, setSellPriceInput] = useState<string>('');
  const [isPremium, setIsPremium] = useState<boolean>(true);
  const [manualArtifactPrice, setManualArtifactPrice] = useState<number>(0);
  const [manualArtifactPriceInput, setManualArtifactPriceInput] = useState<string>('');
  const [isParentTreeDropdownOpen, setIsParentTreeDropdownOpen] = useState<boolean>(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [tableInputPrices, setTableInputPrices] = useState<Record<string, string>>({});

  // Session Input Prices (Requirement 4)
  const [sessionInputPrices, setSessionInputPrices] = useState<Record<string, string>>({});

  // Session History (Requirement 7)
  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>(() => {
    const saved = localStorage.getItem('albion_session_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('albion_session_history', JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  // Multiple crafting session state lifted from child component for batched Albion API queries
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);

  // Initialize multiple crafting calculator row once database items load
  useEffect(() => {
    if (items.length > 0 && sessionItems.length === 0) {
      const initialItem = items.find(i => i.id === 'MAIN_BOW') || items[0];
      setSessionItems([
        {
          id: 'init-1',
          itemId: initialItem ? initialItem.id : '',
          tier: 4,
          enchantment: 0,
          quantityInput: '100',
          sellingPriceInput: '25k',
          searchQuery: initialItem ? initialItem.name : '',
          isSearchOpen: false
        }
      ]);
    }
  }, [items]);

  // Admin Forms login state
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'albion' });

  // Material Creation / Edit states
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialForm, setMaterialForm] = useState({
    id: '',
    name: '',
    type: 'Ore',
    image_url: ''
  });

  // Item Creation / Edit states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({
    id: '',
    name: '',
    category: 'Weapon',
    parent_tree: 'Weapon',
    is_artifact: false,
    craft_fame: 120,
    nutrition_cost: 16,
    artifact_name: '',
    artifact_id: ''
  });

  // Recipe Editor states
  const [selectedRecipeItemId, setSelectedRecipeItemId] = useState<string>('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);

  // Price Fast Updater fields
  const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({});

  // Trigger temporary flash utility
  const triggerStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // Helper fetch wrapper taking bearer tokens automatically
  const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(endpoint, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }
    return response.json();
  };

  // Check Session on startup
  useEffect(() => {
    const verifySession = async () => {
      if (!token) return;
      try {
        const data = await fetchAPI('/api/auth/session');
        if (data.authenticated) {
          setIsLoggedIn(true);
          setUsername(data.username);
        } else {
          // Token expired or invalid
          setToken(null);
          localStorage.removeItem('albion_token');
          setIsLoggedIn(false);
        }
      } catch (e) {
        setToken(null);
        localStorage.removeItem('albion_token');
        setIsLoggedIn(false);
      }
    };
    verifySession();
  }, [token]);

  // Load all central database records
  const loadDatabase = async () => {
    setIsLoading(true);
    try {
      const [materialsList, itemsList, recipesList, pricesList] = await Promise.all([
        fetchAPI('/api/materials'),
        fetchAPI('/api/items'),
        fetchAPI('/api/recipes'),
        fetchAPI('/api/prices')
      ]);

      setMaterials(materialsList);
      setItems(itemsList);
      setRecipes(recipesList);
      setPrices(pricesList);

      // Set default calculated item if list isn't empty
      if (itemsList.length > 0 && !selectedItemId) {
        setSelectedItemId(itemsList[0].id);
      }

      // Pre-fill local quick price modifier dictionary
      const initialPricesMap: Record<string, number> = {};
      pricesList.forEach((p: DailyPrice) => {
        initialPricesMap[p.material_id] = p.price;
      });
      setPriceUpdates(initialPricesMap);

    } catch (e: any) {
      triggerStatus(e.message || 'Failed to load databases.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, [token]);

  // Handle Admin Authorization
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await fetchAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('albion_token', data.token);
        setIsLoggedIn(true);
        setUsername(data.username);
        triggerStatus(`Welcome back, Commander ${data.username}!`, 'success');
      }
    } catch (e: any) {
      triggerStatus(e.message || 'Login credentials rejected.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetchAPI('/api/auth/logout', { method: 'POST' });
    } catch(e) {}
    setToken(null);
    localStorage.removeItem('albion_token');
    setIsLoggedIn(false);
    setUsername('');
    triggerStatus('Logged out successfully.', 'success');
  };

  // --- Material CRUD Operations ---
  const openAddMaterial = () => {
    setEditingMaterial(null);
    setMaterialForm({ id: '', name: '', type: 'Ore', image_url: '' });
    setIsMaterialModalOpen(true);
  };

  const openEditMaterial = (m: Material) => {
    setEditingMaterial(m);
    setMaterialForm({ id: m.id, name: m.name, type: m.type, image_url: m.image_url });
    setIsMaterialModalOpen(true);
  };

  const saveMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.id || !materialForm.name) {
      triggerStatus('ID and Name fields are absolute requirements.', 'error');
      return;
    }

    try {
      if (editingMaterial) {
        await fetchAPI(`/api/materials/${editingMaterial.id}`, {
          method: 'PUT',
          body: JSON.stringify(materialForm)
        });
        triggerStatus(`Material "${materialForm.name}" updated successfully.`);
      } else {
        await fetchAPI('/api/materials', {
          method: 'POST',
          body: JSON.stringify(materialForm)
        });
        triggerStatus(`Material "${materialForm.name}" registered in the codex.`);
      }
      setIsMaterialModalOpen(false);
      loadDatabase();
    } catch (e: any) {
      triggerStatus(e.message || 'Action on Material declined.', 'error');
    }
  };

  const deleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to delete "${name}"? This cascades over all corresponding recipes and prices!`)) return;
    try {
      await fetchAPI(`/api/materials/${id}`, { method: 'DELETE' });
      triggerStatus(`Material "${name}" completely stripped from database.`);
      loadDatabase();
    } catch (e: any) {
      triggerStatus(e.message || 'Deletion error.', 'error');
    }
  };

  // --- Item CRUD Operations ---
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({
      id: '',
      name: '',
      category: 'Weapon',
      parent_tree: 'Weapon',
      is_artifact: false,
      craft_fame: 150,
      nutrition_cost: 20,
      artifact_name: '',
      artifact_id: ''
    });
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      id: item.id,
      name: item.name,
      category: item.category,
      parent_tree: item.parent_tree,
      is_artifact: item.is_artifact,
      craft_fame: item.craft_fame,
      nutrition_cost: item.nutrition_cost,
      artifact_name: item.artifact_name || '',
      artifact_id: item.artifact_id || ''
    });
    setIsItemModalOpen(true);
  };

  const saveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.id || !itemForm.name) {
      triggerStatus('Item ID and Name are required fields.', 'error');
      return;
    }

    try {
      if (editingItem) {
        await fetchAPI(`/api/items/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(itemForm)
        });
        triggerStatus(`Item "${itemForm.name}" configuration updated.`);
      } else {
        await fetchAPI('/api/items', {
          method: 'POST',
          body: JSON.stringify(itemForm)
        });
        triggerStatus(`Item "${itemForm.name}" logged to database.`);
      }
      setIsItemModalOpen(false);
      loadDatabase();
    } catch (e: any) {
      triggerStatus(e.message || 'Failed to persist item configuration.', 'error');
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" item card? This cleans up its recipe ingredients too!`)) return;
    try {
      await fetchAPI(`/api/items/${id}`, { method: 'DELETE' });
      triggerStatus(`Item "${name}" dissolved.`);
      loadDatabase();
    } catch (e: any) {
      triggerStatus(e.message || 'Dissolution error.', 'error');
    }
  };

  // --- Recipe Management Operators ---
  const handleSelectRecipeItem = (itemId: string) => {
    setSelectedRecipeItemId(itemId);
    const existingRecipe = recipes.find(r => r.item_id === itemId);
    if (existingRecipe) {
      setRecipeIngredients([...existingRecipe.ingredients]);
    } else {
      setRecipeIngredients([]);
    }
  };

  // Initial load of recipe workspace selector
  useEffect(() => {
    if (items.length > 0 && !selectedRecipeItemId) {
      handleSelectRecipeItem(items[0].id);
    }
  }, [items]);

  const addIngredientRow = () => {
    if (materials.length === 0) return;
    // Pick first material that is not already in row as helper if possible
    const firstMatId = materials[0].id;
    setRecipeIngredients([...recipeIngredients, { material_id: firstMatId, quantity: 8 }]);
  };

  const updateIngredientRow = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...recipeIngredients];
    if (field === 'quantity') {
      updated[index][field] = Math.max(1, Number(value));
    } else {
      updated[index][field] = value;
    }
    setRecipeIngredients(updated);
  };

  const removeIngredientRow = (index: number) => {
    const updated = recipeIngredients.filter((_, i) => i !== index);
    setRecipeIngredients(updated);
  };

  const saveRecipeSubmit = async () => {
    if (!selectedRecipeItemId) return;
    try {
      // Validate duplicates
      const uniqueMaterials = new Set(recipeIngredients.map(i => i.material_id));
      if (uniqueMaterials.size !== recipeIngredients.length) {
        triggerStatus('Error: Duplicates detected. Do not add same ingredient multiple times.', 'error');
        return;
      }

      await fetchAPI(`/api/recipes/${selectedRecipeItemId}`, {
        method: 'PUT',
        body: JSON.stringify({ ingredients: recipeIngredients })
      });
      triggerStatus('Recipe specifications successfully customized in master codex.');
      loadDatabase();
    } catch (e: any) {
      triggerStatus(e.message || 'Recipe saving failed.', 'error');
    }
  };

  // --- Save Session Prices & Craft Log Sessions ---
  const saveSessionPricesToDatabase = async () => {
    if (!isLoggedIn) {
      triggerStatus('Admin authorization is required to save current prices to the permanent Daily Prices database. Please log in on the sidebar first.', 'error');
      return;
    }
    if (Object.keys(customPrices).length === 0) {
      triggerStatus('No custom session prices to save yet!', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const updatePromises = Object.entries(customPrices).map(([matId, priceValue]) => {
        return fetchAPI(`/api/prices/${matId}`, {
          method: 'PUT',
          body: JSON.stringify({ price: priceValue })
        });
      });
      await Promise.all(updatePromises);
      triggerStatus('Session Material prices have been successfully saved to the Daily Prices database.', 'success');
      loadDatabase(); // Refresh internal state of daily prices
    } catch (e: any) {
      triggerStatus(e.message || 'Failed to save session prices to the database.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const logSingleCraftSession = () => {
    if (!calculationResults || !selectedItemData) return;
    
    const qty = craftQuantity;
    const newSession: SessionSummary = {
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: [{
        name: selectedItemData.name,
        qty,
        tier: selectedTier,
        enchantment: selectedEnchantment
      }],
      totalCost: calculationResults.totalSilverCost,
      totalRevenue: calculationResults.totalRevenue,
      netProfit: calculationResults.netProfit
    };

    setSessionHistory(prev => [newSession, ...prev]);
    triggerStatus('Single crafting session logged successfully to history!', 'success');
  };

  const logMultipleCraftSession = (sessionItemsToLog: any[], totals: any) => {
    const itemsList = sessionItemsToLog
      .filter(row => row.itemId && parseAlbionNumber(row.quantityInput) > 0)
      .map(row => {
        const item = items.find(i => i.id === row.itemId);
        return {
          name: item ? item.name : row.itemId,
          qty: parseAlbionNumber(row.quantityInput),
          tier: row.tier,
          enchantment: row.enchantment
        };
      });

    if (itemsList.length === 0) {
      triggerStatus('Cannot log or complete an empty crafting session. Select items and quantities first.', 'error');
      return;
    }

    const newSession: SessionSummary = {
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: itemsList,
      totalCost: totals.totalCost,
      totalRevenue: totals.totalRevenue,
      netProfit: totals.totalNetProfit
    };

    setSessionHistory(prev => [newSession, ...prev]);
    triggerStatus('Crafting session logged successfully to history!', 'success');
  };

  // --- Manual Price Updates ---
  const saveAllPrices = async () => {
    try {
      setIsLoading(true);
      const updatePromises = Object.entries(priceUpdates).map(([matId, priceValue]) => {
        const numericPrice = typeof priceValue === 'string' ? parseAlbionNumber(priceValue) : priceValue;
        return fetchAPI(`/api/prices/${matId}`, {
          method: 'PUT',
          body: JSON.stringify({ price: numericPrice })
        });
      });
      await Promise.all(updatePromises);
      triggerStatus('Daily Material prices updated and logged into the active database.', 'success');
      loadDatabase();
    } catch (e: any) {
      triggerStatus(e.message || 'Failed to backup manual price changes.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePriceFieldChange = (materialId: string, val: string) => {
    // Keep it as a raw string so Albion formats (10k, 2.5m) are supported during editing
    setPriceUpdates(prev => ({
      ...prev,
      [materialId]: val
    }));
  };

  // --- Complex Crafting Calculations ---
  const selectedItemData = useMemo(() => {
    return items.find(i => i.id === selectedItemId);
  }, [items, selectedItemId]);

  const activeRecipe = useMemo(() => {
    return recipes.find(r => r.item_id === selectedItemId);
  }, [recipes, selectedItemId]);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    prices.forEach(p => {
      map[p.material_id] = p.price;
    });
    // Overlay custom session prices
    Object.entries(customPrices).forEach(([matId, price]) => {
      map[matId] = Number(price);
    });
    return map;
  }, [prices, customPrices]);

  const effectivePricesList = useMemo(() => {
    return prices.map(p => {
      const customPrice = customPrices[p.material_id];
      if (customPrice !== undefined) {
        return {
          ...p,
          price: customPrice
        };
      }
      return p;
    });
  }, [prices, customPrices]);

  const materialsMap = useMemo(() => {
    const map: Record<string, Material> = {};
    materials.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [materials]);

  // Dynamic Session Materials (Requirement 3 & 5)
  const activeSessionMaterials = useMemo(() => {
    const mats = new Map<string, { materialId: string; materialName: string; imageUrl: string; baseId: string }>();

    // Helper to add material
    const addMaterial = (qualifiedId: string, baseId: string, defaultName?: string) => {
      if (mats.has(qualifiedId)) return;
      const material = materials.find(m => m.id === baseId);
      let displayName = material ? material.name : baseId;
      
      // Format name if it is tier-based
      const match = qualifiedId.match(/^T(\d)_(.*?)(?:@(\d))?$/);
      if (match) {
        const tier = match[1];
        const baseMatName = material ? material.name : match[2];
        const enchantment = match[3] || '0';
        if (enchantment !== '0') {
          displayName = `T${tier}.${enchantment} ${baseMatName}`;
        } else {
          displayName = `T${tier} ${baseMatName}`;
        }
      } else if (defaultName) {
        displayName = defaultName;
      }

      mats.set(qualifiedId, {
        materialId: qualifiedId,
        materialName: displayName,
        imageUrl: getMaterialImageUrl(qualifiedId),
        baseId
      });
    };

    // 1. Single craft calculator materials (if we have active recipe)
    if (activeRecipe) {
      activeRecipe.ingredients.forEach(ing => {
        if (ing.is_artifact_material) {
          const artId = selectedItemData?.artifact_id || ing.material_id;
          const cleanArtId = artId.replace(/^T[4-8]_/, "");
          const fullyQualifiedId = `T${selectedTier}_${cleanArtId}`;
          addMaterial(fullyQualifiedId, artId, selectedItemData?.artifact_name);
        } else {
          const suffix = selectedEnchantment > 0 ? `@${selectedEnchantment}` : "";
          const fullyQualifiedId = `T${selectedTier}_${ing.material_id}${suffix}`;
          addMaterial(fullyQualifiedId, ing.material_id);
        }
      });
    }

    // 2. Multiple crafting calculator materials
    sessionItems.forEach(row => {
      if (!row.itemId) return;
      const rx = recipes.find(r => r.item_id === row.itemId);
      const itemData = items.find(i => i.id === row.itemId);
      if (rx) {
        rx.ingredients.forEach(ing => {
          if (ing.is_artifact_material) {
            const artId = itemData?.artifact_id || ing.material_id;
            const cleanArtId = artId.replace(/^T[4-8]_/, "");
            const fullyQualifiedId = `T${row.tier}_${cleanArtId}`;
            addMaterial(fullyQualifiedId, artId, itemData?.artifact_name);
          } else {
            const suffix = row.enchantment > 0 ? `@${row.enchantment}` : "";
            const fullyQualifiedId = `T${row.tier}_${ing.material_id}${suffix}`;
            addMaterial(fullyQualifiedId, ing.material_id);
          }
        });
      }
    });

    return Array.from(mats.values());
  }, [selectedItemId, selectedTier, selectedEnchantment, selectedItemData, activeRecipe, recipes, sessionItems, items, materials]);

  const hasArtifact = useMemo(() => {
    return !!(selectedItemData?.is_artifact || activeRecipe?.ingredients.some(ing => ing.is_artifact_material));
  }, [selectedItemData, activeRecipe]);

  // Synchronize manualArtifactPrice / pre-fill with seeded default price on item or tier changes
  useEffect(() => {
    if (selectedItemData && Object.keys(priceMap).length > 0) {
      const artId = selectedItemData.artifact_id;
      if (artId) {
        const fullyQualifiedId = `T${selectedTier}_${artId}`;
        const seededPrice = priceMap[fullyQualifiedId] || 0;
        setManualArtifactPrice(seededPrice);
      } else {
        const artIng = activeRecipe?.ingredients.find(ing => ing.is_artifact_material);
        if (artIng) {
          const fullyQualifiedId = `T${selectedTier}_${artIng.material_id}`;
          const seededPrice = priceMap[fullyQualifiedId] || 0;
          setManualArtifactPrice(seededPrice);
        } else {
          setManualArtifactPrice(0);
        }
      }
    } else {
      setManualArtifactPrice(0);
    }
  }, [selectedItemId, selectedTier, priceMap, activeRecipe, selectedItemData]);

  // Synchronize string inputs for Albion shortcuts
  useEffect(() => {
    if (sellPrice !== parseAlbionNumber(sellPriceInput)) {
      setSellPriceInput(sellPrice > 0 ? sellPrice.toString() : '');
    }
  }, [sellPrice]);

  useEffect(() => {
    if (manualArtifactPrice !== parseAlbionNumber(manualArtifactPriceInput)) {
      setManualArtifactPriceInput(manualArtifactPrice > 0 ? manualArtifactPrice.toString() : '');
    }
  }, [manualArtifactPrice]);

  // Sync search input query when the selected item changes
  useEffect(() => {
    if (selectedItemData) {
      setItemSearchQuery(selectedItemData.name);
    }
  }, [selectedItemId, selectedItemData]);

  // Craft results containing exact returned values based on Resource Return Rate (RRR)
  const calculationResults = useMemo(() => {
    if (!selectedItemData || !activeRecipe) return null;

    const result = CraftCalculationService.calculateAll(
      {
        item: selectedItemData,
        recipe: activeRecipe,
        tier: selectedTier,
        enchantment: selectedEnchantment,
        quantity: craftQuantity,
        rrr: rrr,
        sellingPrice: sellPrice,
        isPremium: isPremium,
        manualArtifactPrice: manualArtifactPrice,
        customPrices: customPrices
      },
      materialsMap,
      priceMap
    );

    // Map the new fields to look like what the UI expects for compatibility
    const ingredients = [
      ...result.materials.map(m => {
        let imageUrl = m.image_url;
        if (m.isArtifact) {
          const cleanId = m.materialId.replace(/^T[4-8]_/, "");
          imageUrl = `https://render.albiononline.com/v1/item/T${selectedTier}_${cleanId}`;
        }
        return {
          material_id: m.materialId,
          materialName: m.materialName,
          materialType: m.materialType,
          image_url: imageUrl,
          baseQty: m.purchasedQty,
          adjustedQty: m.consumedQty,
          unitPrice: m.unitPrice,
          calculatedCost: m.calculatedCost,
          isArtifact: m.isArtifact
        };
      }),
      ...result.artifacts.map(a => {
        const cleanId = a.materialId.replace(/^T[4-8]_/, "");
        const imageUrl = `https://render.albiononline.com/v1/item/T${selectedTier}_${cleanId}`;
        return {
          material_id: a.materialId,
          materialName: a.materialName,
          materialType: a.materialType,
          image_url: imageUrl,
          baseQty: a.purchasedQty,
          adjustedQty: a.consumedQty,
          unitPrice: a.unitPrice,
          calculatedCost: a.calculatedCost,
          isArtifact: a.isArtifact
        };
      })
    ];

    return {
      fameGained: result.fameGained,
      nutritionUsed: result.nutritionUsed,
      ingredients,
      totalSilverCost: result.totalSilverCost,
      leftovers: result.leftovers,
      
      // Upgraded profit fields
      totalRevenue: result.totalRevenue,
      setupFee: result.setupFee,
      transactionTax: result.transactionTax,
      netRevenue: result.netRevenue,
      netProfit: result.netProfit,
      profitPercentage: result.profitPercentage
    };

  }, [selectedItemData, activeRecipe, craftQuantity, rrr, priceMap, materialsMap, selectedTier, selectedEnchantment, sellPrice, isPremium, manualArtifactPrice, customPrices]);

  const parentTrees = useMemo(() => {
    const list = new Set(PARENT_TREES);
    items.forEach(item => {
      if (item.parent_tree) {
        list.add(item.parent_tree);
      }
    });
    return Array.from(list).sort();
  }, [items]);

  // General counts & Search for database stats section
  const filteredMaterials = useMemo(() => {
    // Exclude of type 'Artifact' to prevent mixing unique artifacts with raw materials
    const list = materials.filter(m => m.type !== 'Artifact');
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.type.toLowerCase().includes(q));
  }, [materials, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.parent_tree.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const filteredSidebarItems = useMemo(() => {
    if (!selectedParentTreeFilter) return items;
    return items.filter(it => it.parent_tree === selectedParentTreeFilter);
  }, [items, selectedParentTreeFilter]);

  const filteredPrices = useMemo(() => {
    if (!searchQuery) return prices;
    const q = searchQuery.toLowerCase();
    return prices.filter(p => {
      const match = p.material_id.match(/^T(\d)_(.*?)(?:@(\d))?$/);
      const tier = match ? match[1] : '';
      const baseMatId = match ? match[2] : p.material_id;
      const enchantment = match && match[3] ? match[3] : '0';
      const baseMat = materials.find(m => m.id === baseMatId);
      const name = baseMat ? baseMat.name : '';
      
      return p.material_id.toLowerCase().includes(q) || 
             name.toLowerCase().includes(q) || 
             `t${tier}.${enchantment}`.includes(q) ||
             `tier ${tier}`.includes(q);
    });
  }, [prices, materials, searchQuery]);

  return (
    <div id="albion-app" className="min-h-screen bg-[#0A0B0D] text-slate-200 font-sans flex flex-col antialiased">
      {/* Top Banner Alert notification */}
      {statusMessage && (
        <div id="status-bar" className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-bounce max-w-sm ${
          statusMessage.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' 
            : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
        }`}>
          {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span className="text-sm font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Main Structural Outer Frame styled like Bento Page layout */}
      <div className="flex flex-1 flex-col lg:flex-row h-full">
        
        {/* SIDEBAR BLOCK */}
        <aside id="sidebar" className="w-full lg:w-64 bg-[#111318] border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col justify-between shrink-0">
          <div>
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div id="app-logo" className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center font-bold text-black shadow-lg shadow-amber-500/20">
                  A
                </div>
                <div>
                  <h1 className="font-bold tracking-tight text-slate-100 text-lg leading-tight">Albion Craft</h1>
                  <span className="text-[10px] text-amber-500 font-sans tracking-widest uppercase">Calculator</span>
                </div>
              </div>
              <div className="lg:hidden">
                {isLoggedIn ? (
                  <button onClick={handleLogout} className="p-1 px-2.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Out
                  </button>
                ) : (
                  <button onClick={() => setActiveTab('materials')} className="p-1 px-2.5 text-xs bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Login
                  </button>
                )}
              </div>
            </div>

            {/* Navigation links */}
            <nav className="p-4 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2.5">
                Main Tools
              </div>
              <button 
                id="tab-calculator"
                onClick={() => setActiveTab('calculator')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                  activeTab === 'calculator' 
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <CalcIcon className="w-4 h-4" /> Craft Calculator
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">HQ</span>
              </button>

              <button 
                id="tab-multiple-calculator"
                onClick={() => setActiveTab('multiple_crafting')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                  activeTab === 'multiple_crafting' 
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Coins className="w-4 h-4" /> Multiple Crafting Calculator
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">HQ</span>
              </button>

              <button 
                id="tab-session-history"
                onClick={() => setActiveTab('session_history')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                  activeTab === 'session_history' 
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4" /> Session History
                </span>
                {sessionHistory.length > 0 && (
                  <span className="text-[10px] bg-indigo-500/25 text-indigo-300 px-1.5 py-0.5 rounded-full font-mono font-bold">
                    {sessionHistory.length}
                  </span>
                )}
              </button>

              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mt-6 mb-2.5">
                Core Databases
              </div>
              <button 
                id="tab-materials"
                onClick={() => setActiveTab('materials')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeTab === 'materials' 
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Layers className="w-4 h-4" /> Materials Manager
                {!isLoggedIn && <Lock className="w-3 h-3 ml-auto text-slate-600" />}
              </button>

              <button 
                id="tab-items"
                onClick={() => setActiveTab('items')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeTab === 'items' 
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <DBIcon className="w-4 h-4" /> Item Codex
                {!isLoggedIn && <Lock className="w-3 h-3 ml-auto text-slate-600" />}
              </button>

              <button 
                id="tab-recipes"
                onClick={() => setActiveTab('recipes')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeTab === 'recipes' 
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Wrench className="w-4 h-4" /> Crafting Recipes
                {!isLoggedIn && <Lock className="w-3 h-3 ml-auto text-slate-600" />}
              </button>

              <button 
                id="tab-prices"
                onClick={() => setActiveTab('prices')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeTab === 'prices' 
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-medium' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Coins className="w-4 h-4" /> Market Prices
                {!isLoggedIn && <Lock className="w-3 h-3 ml-auto text-slate-600" />}
              </button>
            </nav>
          </div>

          {/* User authentication footer card */}
          <div className="p-4 border-t border-white/5 bg-[#0D0F14]/50">
            {isLoggedIn ? (
              <div className="flex items-center justify-between gap-3 p-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-black">
                    {username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-slate-200 truncate">{username}</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> Admin Authorized
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleLogout} 
                  title="Logout" 
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" /> Admin Access Locked
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Toggle admin to unlock material additions, item creation, and pricing.
                </p>
                <button 
                  onClick={() => setActiveTab('materials')} 
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Verify Admin Identity
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* WORKSPACE AREA CONTAINER */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0D0F14]">
          
          {/* TOP HEADER */}
          <header className="h-16 flex items-center justify-between px-6 lg:px-8 border-b border-white/5 bg-[#111318]">
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-slate-500 uppercase tracking-widest">Albion Workbench</span>
              <span className="text-slate-700">/</span>
              <span className="text-indigo-400 uppercase tracking-widest bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/30">
                {activeTab}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></span>
                <span className="text-xs text-slate-400 font-sans">MySQL/JSON Core Linked</span>
              </div>
              <button 
                onClick={loadDatabase} 
                title="Reload DB Data"
                className={`p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors cursor-pointer flex items-center gap-1 ${isLoading ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-xs hidden md:inline">Synchronize</span>
              </button>
            </div>
          </header>

          {/* MASTER BENTO GRID */}
          <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-auto max-w-[1600px] w-full mx-auto overflow-y-auto">
            
            {/* LARGE GRID COLUMN: workspace focus (Span 8 modules) */}
            <section id="bento-workspace" className="md:col-span-8 bg-[#161920] rounded-2xl border border-white/5 p-4 lg:p-6 flex flex-col shadow-2xl relative min-w-0">
              
              {(activeTab === 'calculator' || activeTab === 'multiple_crafting') && (
                <div id="pricing-info-card" className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-indigo-505/5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl mb-6 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 shrink-0">
                      <Coins className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Manual Session Pricing Enforced</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Use the "Session Materials Panel" to change material prices in real time. Prices apply only to the active crafting session unless committed.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Calculator Panel */}
              {activeTab === 'calculator' && (
                <div id="calculator-panel" className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                          <CalcIcon className="w-5 h-5 text-indigo-400" /> Crafting Calculator Engine
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Configure batch size and localized return rates to measure base and RRR material requirements.</p>
                      </div>
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/20 uppercase tracking-wider">
                        City Refining Core
                      </span>
                    </div>

                    {/* DYNAMIC ITEM CARD WITH AUTOMATIC IMAGES */}
                    {selectedItemId && (
                      <div className="flex flex-col sm:flex-row gap-5 items-center bg-[#0D0F14]/40 border border-white/5 rounded-2xl p-4 mb-6">
                        <div className="relative shrink-0">
                          <img 
                            src={getItemImageUrl(selectedItemId, selectedTier, selectedEnchantment)} 
                            alt={selectedItemData?.name || 'Item'} 
                            className="w-20 h-20 bg-[#0D0F14] rounded-2xl border border-indigo-500/20 object-cover shadow-2xl shadow-indigo-500/5 hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=80&h=80&fit=crop';
                            }}
                          />
                          <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shadow">
                            T{selectedTier}.{selectedEnchantment}
                          </div>
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                            {selectedItemData?.category || 'Category'}
                          </span>
                          <h3 className="text-xl font-bold text-white mt-1.5 leading-tight">
                            {selectedItemData?.name || 'Loading Item'} <span className="font-mono text-slate-500">T{selectedTier}.{selectedEnchantment}</span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-2">
                            <span>Parent Tree: <strong className="text-indigo-300">{selectedItemData?.parent_tree || 'N/A'}</strong></span>
                            <span>•</span>
                            {selectedItemData?.is_artifact && (
                              <span className="text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded text-[10px]">Artifact Spec</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 mb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Filter by Parent Tree
                          </label>
                          <select
                            value={selectedParentTreeFilter}
                            onChange={(e) => {
                              setSelectedParentTreeFilter(e.target.value);
                              const filtered = e.target.value 
                                ? items.filter(it => it.parent_tree === e.target.value)
                                : items;
                              if (filtered.length > 0) {
                                setSelectedItemId(filtered[0].id);
                              }
                            }}
                            className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">All Parent Trees</option>
                            {parentTrees.map(pt => (
                              <option key={pt} value={pt}>{pt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5 relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Target Crafted Item
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={itemSearchQuery}
                              onChange={(e) => {
                                setItemSearchQuery(e.target.value);
                                setIsAutocompleteOpen(true);
                              }}
                              onFocus={() => setIsAutocompleteOpen(true)}
                              placeholder="Type to search items..."
                              className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-3 pr-10 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650"
                            />
                            <div className="absolute right-3 top-3 flex items-center pointer-events-none">
                              <Search className="w-4 h-4 text-slate-500" />
                            </div>
                          </div>

                          {isAutocompleteOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => {
                                  setIsAutocompleteOpen(false);
                                  if (selectedItemData) {
                                    setItemSearchQuery(selectedItemData.name);
                                  }
                                }} 
                              />
                              
                              <div className="absolute left-0 right-0 top-18 bg-[#0D0F14] border border-white/10 rounded-xl shadow-2xl z-20 max-h-[250px] overflow-y-auto divide-y divide-white/5">
                                {(() => {
                                  const query = itemSearchQuery.toLowerCase().trim();
                                  const searchResults = filteredSidebarItems.filter(i => 
                                    i.name.toLowerCase().includes(query) || 
                                    i.id.toLowerCase().includes(query)
                                  );

                                  if (searchResults.length === 0) {
                                    return (
                                      <div className="p-3 text-xs text-slate-500 text-center">
                                        No matching items found
                                      </div>
                                    );
                                  }

                                  return searchResults.map(i => (
                                    <button
                                      key={i.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedItemId(i.id);
                                        setItemSearchQuery(i.name);
                                        setIsAutocompleteOpen(false);
                                      }}
                                      className={`w-full text-left p-2.5 hover:bg-white/5 transition-colors flex flex-col gap-0.5 cursor-pointer ${
                                        selectedItemId === i.id ? 'bg-white/5 border-l-2 border-indigo-500 pl-2' : ''
                                      }`}
                                    >
                                      <span className="text-xs font-bold text-slate-200">{i.name}</span>
                                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                        <span>ID: {i.id}</span>
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600" />
                                        <span>{i.category}</span>
                                      </span>
                                    </button>
                                  ));
                                })()}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Tier level
                          </label>
                          <div className="flex bg-[#0D0F14] rounded-xl border border-white/10 p-1">
                            {[4, 5, 6, 7, 8].map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedTier(t)}
                                className={`flex-1 py-1.5 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                  selectedTier === t
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                              >
                                T{t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Enchantment level
                          </label>
                          <div className="flex bg-[#0D0F14] rounded-xl border border-white/10 p-1">
                            {[0, 1, 2, 3, 4].map(e => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => setSelectedEnchantment(e)}
                                className={`flex-1 py-1.5 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                  selectedEnchantment === e
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                              >
                                .{e}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left configuration */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Batch Quantity
                            </label>
                            <input 
                              type="number" 
                              min="1"
                              value={craftQuantity} 
                              onChange={(e) => setCraftQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                              RRR (%) 
                              <span className="text-[9px] text-slate-500 lowercase font-normal">(resource return)</span>
                            </label>
                            <div className="relative">
                              <input 
                                type="number" 
                                step="0.1"
                                min="0" 
                                max="99"
                                value={rrr} 
                                onChange={(e) => setRrr(Math.min(99, Math.max(0, parseFloat(e.target.value) || 0)))}
                                className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                              />
                              <span className="absolute right-3 top-3.5 text-xs text-slate-500 font-mono">%</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                              Selling Price / Unit
                              {sellPrice > 0 && (
                                <span className="text-[9px] text-[#efb034] font-mono">Parsed: {sellPrice.toLocaleString()}s</span>
                              )}
                            </label>
                            <input 
                              type="text" 
                              value={sellPriceInput} 
                              onChange={(e) => {
                                setSellPriceInput(e.target.value);
                                setSellPrice(parseAlbionNumber(e.target.value));
                              }}
                              className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#efb034] text-amber-400 font-mono"
                              placeholder="e.g. 25k"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Tax Status (Premium)
                            </label>
                            <div 
                              className={`border rounded-xl p-3 flex items-center justify-between h-[46px] cursor-pointer transition-all ${
                                isPremium 
                                  ? 'bg-[#ef4444]/5 border-[#ef4444]/30 text-slate-100' 
                                  : 'bg-[#5c2d91]/5 border-white/10 text-slate-300'
                              }`} 
                              onClick={() => setIsPremium(!isPremium)}
                            >
                              <div className="text-xs font-semibold">{isPremium ? 'Premium (4% Tax)' : 'F2P (8% Tax)'}</div>
                              <input 
                                type="checkbox"
                                checked={isPremium}
                                onChange={(e) => setIsPremium(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 border-white/10 bg-slate-900 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        </div>

                        {hasArtifact && (
                          <div className="space-y-1.5 bg-[#4f46e5]/10 border border-[#4f46e5]/30 p-4 rounded-xl animate-fade-in">
                            <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center justify-between">
                              <span>Artifact Unit Price</span>
                              {manualArtifactPrice > 0 && (
                                <span className="text-[9px] text-indigo-400 font-mono">Parsed: {manualArtifactPrice.toLocaleString()}s</span>
                              )}
                            </label>
                            <input 
                              type="text" 
                              id="artifact-unit-price-input"
                              value={manualArtifactPriceInput} 
                              onChange={(e) => {
                                setManualArtifactPriceInput(e.target.value);
                                setManualArtifactPrice(parseAlbionNumber(e.target.value));
                              }}
                              className="w-full bg-[#0D0F14] border border-[#4f46e5]/25 rounded-lg p-2.5 text-xs text-indigo-200 font-mono focus:outline-none focus:border-indigo-400"
                              placeholder="e.g. 150k"
                            />
                          </div>
                        )}

                        {/* Presets */}
                        <div className="pt-2">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">RRR Presets</span>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: 'No Bonus (0%)', val: 0 },
                              { label: 'Outpost (15.2%)', val: 15.2 },
                              { label: 'City Crafting (24.8%)', val: 24.8 },
                              { label: 'Focus Refining (43.5%)', val: 43.5 },
                              { label: 'Max Focus (47.9%)', val: 47.9 }
                            ].map(preset => (
                              <button 
                                key={preset.label}
                                type="button"
                                onClick={() => setRrr(preset.val)}
                                className={`text-[10px] px-2 py-1 rounded border transition-colors cursor-pointer ${
                                  rrr === preset.val 
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right info bento stat highlights */}
                      <div className="space-y-4">
                        <div className="bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 rounded-2xl border border-indigo-500/10 p-5 flex flex-col justify-center items-center text-center relative overflow-hidden">
                          <div className="absolute top-2 right-3 flex items-center gap-1.5 opacity-40">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[9px] text-indigo-300 font-mono">Fame Multiplier</span>
                          </div>
                          
                          <div className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-1">Estimated Craft Fame Gained</div>
                          <div className="text-3xl font-black text-indigo-400 font-mono tracking-wide">
                            {calculationResults ? calculationResults.fameGained.toLocaleString() : '0'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            +{calculationResults ? Math.round(calculationResults.fameGained * 0.1).toLocaleString() : '0'} Master Specialization Bonus
                          </div>
                        </div>

                        <div className="bg-slate-900/30 rounded-2xl border border-white/5 p-4 flex justify-between items-center">
                          <div>
                            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Required Nutrition</div>
                            <div className="text-xl font-bold text-slate-200 mt-1 font-mono">
                              {calculationResults ? calculationResults.nutritionUsed.toLocaleString() : '0'}
                            </div>
                          </div>
                          <div className="text-right text-[10px] text-slate-500 leading-normal max-w-[140px]">
                            Required capacity food points for station feed.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upgraded Financial Breakdown Bento (Requirement 6) */}
                    {calculationResults && (
                      <div className="mt-8 space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Coins className="w-4 h-4 text-amber-500" /> Craft Commercials & Taxation Ledger
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Cost */}
                          <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Crafting Cost</div>
                            <div className="text-xl font-black text-rose-400 font-mono mt-1">
                              {calculationResults.totalSilverCost.toLocaleString()} <span className="text-[10px] text-rose-500 font-bold">s</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2">Sum of resources + manual artifact costs</p>
                          </div>
                          
                          {/* Gross Revenue */}
                          <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Gross Sell Revenue</div>
                            <div className="text-xl font-black text-amber-500 font-mono mt-1">
                              {calculationResults.totalRevenue.toLocaleString()} <span className="text-[10px] text-amber-600 font-bold">s</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2">{craftQuantity} units × {sellPrice.toLocaleString()}s per unit</p>
                          </div>

                          {/* Marketplace Fees */}
                          <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Market Taxes & Fees</div>
                            <div className="text-xl font-black text-red-400 font-mono mt-1">
                              -{(calculationResults.setupFee + calculationResults.transactionTax).toLocaleString()} <span className="text-[10px] text-red-500 font-bold">s</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2 flex flex-wrap gap-1 leading-normal">
                              <span>Setup: 2.5% ({calculationResults.setupFee.toLocaleString()}s)</span>
                              <span>Tax: {isPremium ? "4%" : "8%"} ({calculationResults.transactionTax.toLocaleString()}s)</span>
                            </p>
                          </div>

                          {/* Net Revenue */}
                          <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Net Sell Revenue</div>
                            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                              {calculationResults.netRevenue.toLocaleString()} <span className="text-[10px] text-emerald-600 font-bold">s</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2">Returned after listing fees deduction</p>
                          </div>
                        </div>

                        {/* Large Profit/Loss Banner */}
                        <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
                          calculationResults.netProfit >= 0 
                            ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-200' 
                            : 'bg-rose-950/20 border-rose-500/25 text-rose-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            <Coins className={`w-10 h-10 ${calculationResults.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`} />
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                                {calculationResults.netProfit >= 0 ? "Estimated Net Pure Profit" : "Estimated Net Pure Loss"}
                              </div>
                              <div className="text-2xl font-black font-mono mt-0.5">
                                {calculationResults.netProfit >= 0 ? "+" : ""}{calculationResults.netProfit.toLocaleString()}<span className="text-xs font-normal opacity-70 ml-1">Silver</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                            <div className="text-center sm:text-right">
                              <div className="text-[9px] uppercase tracking-widest opacity-80">Return on Investment (ROI)</div>
                              <div className="text-2xl font-black font-mono">
                                {calculationResults.netProfit >= 0 ? "+" : ""}{calculationResults.profitPercentage.toFixed(1)}%
                              </div>
                            </div>

                            <button
                              id="btn-log-single-session"
                              onClick={logSingleCraftSession}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
                            >
                              <FileSpreadsheet className="w-4 h-4" /> Log Session
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Breakdown spreadsheet table */}
                    <div className="mt-8 pt-6 border-t border-white/5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resource Matrix Breakdown</h3>
                        {selectedItemData && (
                          <div className="text-xs text-slate-500">
                            Configured Recipe: <span className="text-slate-300 font-medium">{activeRecipe?.ingredients.length || 0} unique mats</span>
                          </div>
                        )}
                      </div>

                      {!activeRecipe ? (
                        <div className="bg-[#0D0F14] rounded-xl p-8 text-center border border-white/5 text-slate-500 text-xs">
                          {selectedItemId 
                            ? "No ingredients defined for this item yet. Please authorize as Administrator to add materials in 'Crafting Recipes'."
                            : "Select an item to begin recipe evaluation."
                          }
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0D0F14]/50">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-[#0D0F14] text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/5">
                              <tr>
                                <th className="p-3 font-semibold">Material Name</th>
                                <th className="p-3 font-semibold text-center">Unit Base</th>
                                <th className="p-3 font-semibold text-center">Batch Base</th>
                                <th className="p-3 font-semibold text-center text-amber-400">Batch with RRR</th>
                                <th className="p-3 font-semibold text-right">Unit Price</th>
                                <th className="p-3 font-semibold text-right text-emerald-400">Silver Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {calculationResults && calculationResults.ingredients.map(ing => (
                                <tr key={ing.material_id} className="hover:bg-white/[2%] transition-colors">
                                  <td className="p-3 flex items-center gap-3 font-medium">
                                    {ing.image_url ? (
                                      <img src={ing.image_url} alt={ing.materialName} className="w-6 h-6 rounded bg-slate-800 object-cover border border-white/15" />
                                    ) : (
                                      <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-[10px] font-bold text-indigo-400">
                                        M
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-slate-200 font-bold">{ing.materialName}</div>
                                      <div className="text-[9px] text-slate-500 font-mono">{ing.material_id}</div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-mono text-slate-400">
                                    {ing.baseQty / craftQuantity}
                                  </td>
                                  <td className="p-3 text-center font-mono text-slate-400">
                                    {ing.baseQty}
                                  </td>
                                  <td className="p-3 text-center font-mono text-amber-400 font-bold bg-amber-500/5">
                                    {ing.adjustedQty}
                                  </td>
                                  <td className="p-3 text-right">
                                    {ing.isArtifact ? (
                                      <div className="flex flex-col items-end">
                                        <div className="flex items-center justify-end gap-1">
                                          <input 
                                            type="text"
                                            value={
                                              tableInputPrices[ing.material_id] !== undefined 
                                                ? tableInputPrices[ing.material_id] 
                                                : (manualArtifactPrice ? manualArtifactPrice.toLocaleString() : '')
                                            }
                                            onChange={(e) => {
                                              const rawVal = e.target.value;
                                              setTableInputPrices(prev => ({ ...prev, [ing.material_id]: rawVal }));
                                              const parsedVal = parseAlbionNumber(rawVal);
                                              setManualArtifactPrice(parsedVal);
                                            }}
                                            onBlur={() => {
                                              setTableInputPrices(prev => {
                                                const copy = { ...prev };
                                                delete copy[ing.material_id];
                                                return copy;
                                              });
                                            }}
                                            placeholder="Manual"
                                            className="w-20 bg-[#0A0C10] border border-indigo-500/30 hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-0 rounded py-0.5 px-1.5 text-right font-mono text-indigo-200 focus:outline-none"
                                          />
                                          <span className="text-[10px] text-indigo-400 font-mono">s</span>
                                        </div>
                                        <div className="text-[9px] mt-0.5 text-indigo-400 font-extrabold uppercase tracking-widest leading-none">
                                          Manual Only
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-end">
                                        <div className="flex items-center justify-end gap-1">
                                          <input 
                                            type="text"
                                            value={
                                              tableInputPrices[ing.material_id] !== undefined 
                                                ? tableInputPrices[ing.material_id] 
                                                : (customPrices[ing.material_id] !== undefined 
                                                    ? customPrices[ing.material_id].toLocaleString() 
                                                    : ing.unitPrice.toLocaleString())
                                            }
                                            onChange={(e) => {
                                              const rawVal = e.target.value;
                                              setTableInputPrices(prev => ({ ...prev, [ing.material_id]: rawVal }));
                                              const parsedVal = parseAlbionNumber(rawVal);
                                              setCustomPrices(prev => ({
                                                ...prev,
                                                [ing.material_id]: parsedVal
                                              }));
                                            }}
                                            onBlur={() => {
                                              setTableInputPrices(prev => {
                                                const copy = { ...prev };
                                                delete copy[ing.material_id];
                                                return copy;
                                              });
                                            }}
                                            className="w-20 bg-[#0A0C10] border border-white/10 hover:border-white/20 focus:border-indigo-500 focus:ring-0 rounded py-0.5 px-1.5 text-right font-mono text-slate-200 focus:outline-none"
                                          />
                                          <span className="text-[10px] text-slate-500 font-mono">s</span>
                                        </div>
                                        <div className="text-[9px] mt-0.5 font-extrabold uppercase tracking-widest leading-none">
                                          {customPrices[ing.material_id] !== undefined ? (
                                            <span className="text-amber-500">Manual Override</span>
                                          ) : (
                                            <span className="text-emerald-500">API</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                                    {ing.calculatedCost.toLocaleString()}s
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    {/* Leftovers Spreadsheet segment */}
                    {calculationResults && calculationResults.leftovers && calculationResults.leftovers.some(l => l.leftover > 0) && (
                      <div className="mt-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Leftover Materials Console (Saved by RRR)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {calculationResults.leftovers.filter(l => l.leftover > 0).map(l => (
                            <div key={l.materialId} className="bg-slate-900/40 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-bold text-slate-200">{l.materialName}</div>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5">{l.materialId}</div>
                                <div className="text-[10px] text-indigo-400 font-medium mt-1">
                                  Need: <span className="text-slate-300 font-bold">{l.purchased}</span> • Consume: <span className="text-slate-300 font-bold">{l.consumed}</span>
                                </div>
                              </div>
                              <div className="text-right col-span-1 shrink-0">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Leftover</span>
                                <span className="text-sm font-black text-amber-400 font-mono">+{l.leftover}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}

              {/* Multiple Crafting Calculator Panel (Requirements 2, 3, 4) */}
              {activeTab === 'multiple_crafting' && (
                <MultipleCraftingCalculator
                  items={items}
                  recipes={recipes}
                  prices={effectivePricesList}
                  materials={materials}
                  sessionItems={sessionItems}
                  setSessionItems={setSessionItems}
                  onLogSession={logMultipleCraftSession}
                />
              )}

              {/* Materials Management View */}
              {activeTab === 'materials' && (
                <div id="materials-panel" className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                          <Layers className="w-5 h-5 text-indigo-400" /> Materials Management Codex
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Register new materials, customize types, or update material references.</p>
                      </div>
                      
                      {isLoggedIn && (
                        <button 
                          onClick={openAddMaterial}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add Material Card
                        </button>
                      )}
                    </div>

                    {!isLoggedIn ? (
                      <div className="bg-[#090A0D] rounded-2xl border border-white/5 p-8 max-w-md mx-auto text-center space-y-4 my-8">
                        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-200">Admin Authorization Required</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          You must supply valid administrator credentials to unlock structural database fields.
                        </p>
                        <form onSubmit={handleLogin} className="space-y-3 pt-2 text-left">
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Username</label>
                            <input 
                              type="text"
                              value={loginForm.username}
                              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Password</label>
                            <input 
                              type="password"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Default credentials: <span className="text-slate-400 font-mono">admin / albion</span></p>
                          </div>
                          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer">
                            Unlock Workspace
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
                            <input 
                              type="text" 
                              placeholder="Search registered materials..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-[#0D0F14] border border-white/5 rounded-xl text-xs focus:outline-none"
                            />
                          </div>
                        </div>

                        {filteredMaterials.length === 0 ? (
                          <div className="text-center p-8 text-slate-500 text-xs bg-[#0D0F14] rounded-xl">
                            No materials found matching current filter query.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                            {filteredMaterials.map(m => (
                              <div key={m.id} className="p-3 rounded-xl bg-[#0D0F14] border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {m.image_url ? (
                                    <img src={m.image_url} alt={m.name} className="w-10 h-10 rounded-lg bg-slate-800 object-cover border border-white/10" />
                                  ) : (
                                    <div className="w-10 h-10 bg-slate-850 text-indigo-400 rounded-lg border border-white/10 flex items-center justify-center font-bold font-mono">
                                      {m.type.charAt(0)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-xs font-bold text-slate-200">{m.name}</div>
                                    <div className="text-[9px] text-slate-500 font-mono">{m.id}</div>
                                    <span className="inline-block mt-1 text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold px-1 rounded">
                                      {m.type}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openEditMaterial(m)} className="p-1 px-1.5 text-slate-400 hover:bg-white/5 hover:text-indigo-400 rounded transition-colors cursor-pointer" title="Edit">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteMaterial(m.id, m.name)} className="p-1 px-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded transition-colors cursor-pointer" title="Delete">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Item Database Codex Panel */}
              {activeTab === 'items' && (
                <div id="items-panel" className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                          <DBIcon className="w-5 h-5 text-indigo-400" /> Item Specification Database
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Populate weapons, armors, accessories, values, fame values, and parent specialization trunks.</p>
                      </div>
                      
                      {isLoggedIn && (
                        <button 
                          onClick={openAddItem}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add Item spec
                        </button>
                      )}
                    </div>

                    {!isLoggedIn ? (
                      <div className="bg-[#090A0D] rounded-2xl border border-white/5 p-8 max-w-md mx-auto text-center space-y-4 my-8">
                        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-200">Admin Authorization Required</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          You must supply valid administrator credentials to unlock structural database fields.
                        </p>
                        <form onSubmit={handleLogin} className="space-y-3 pt-2 text-left">
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Username</label>
                            <input 
                              type="text"
                              value={loginForm.username}
                              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Password</label>
                            <input 
                              type="password"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Default credentials: <span className="text-slate-400 font-mono">admin / albion</span></p>
                          </div>
                          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer">
                            Unlock Workspace
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
                          <input 
                            type="text" 
                            placeholder="Filter item name, tier tag, branch..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[#0D0F14] border border-white/5 rounded-xl text-xs focus:outline-none"
                          />
                        </div>

                        {filteredItems.length === 0 ? (
                          <div className="text-center p-8 text-slate-500 text-xs bg-[#0D0F14] rounded-xl">
                            No items found matching the filter specs.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0D0F14]/50 max-h-[460px]">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-[#0D0F14] text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/5">
                                <tr>
                                  <th className="p-3">Item Name</th>
                                  <th className="p-3">Category / Tree</th>
                                  <th className="p-3 text-center">Is Artifact</th>
                                  <th className="p-3 text-right">Base Fame</th>
                                  <th className="p-3 text-right">Nutrition Cost</th>
                                  <th className="p-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {filteredItems.map(item => (
                                  <tr key={item.id} className="hover:bg-white/[2%] transition-colors">
                                    <td className="p-3 flex items-center gap-3 font-medium">
                                      <img 
                                        src={getItemImageUrl(item.id, 6, 0)} 
                                        alt={item.name} 
                                        className="w-10 h-10 rounded bg-[#0D0F14] object-cover border border-white/5 shrink-0" 
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=40&h=40&fit=crop';
                                        }}
                                      />
                                      <div>
                                        <div className="font-bold text-slate-200">{item.name}</div>
                                        <div className="text-[9px] text-slate-500 font-mono">{item.id}</div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-slate-300">{item.category}</div>
                                      <div className="text-[10px] text-indigo-400">{item.parent_tree || 'General'}</div>
                                    </td>
                                    <td className="p-3 text-center">
                                      {item.is_artifact ? (
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Yes</span>
                                      ) : (
                                        <span className="text-[9px] px-2 py-0.5 text-slate-600 font-mono">No</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-300">
                                      {item.craft_fame.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-300">
                                      {item.nutrition_cost}
                                    </td>
                                    <td className="p-3 text-right font-medium">
                                      <div className="inline-flex gap-1">
                                        <button onClick={() => openEditItem(item)} className="p-1 text-slate-400 hover:text-indigo-400 rounded transition-colors cursor-pointer" title="Edit">
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => deleteItem(item.id, item.name)} className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer" title="Delete">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Crafting Recipes Workspace */}
              {activeTab === 'recipes' && (
                <div id="recipes-panel" className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-white/5 pb-4 mb-6">
                      <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-indigo-400" /> Item Recipe Blueprint Builder
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">Associate materials and establish quantities required for producing catalog items.</p>
                    </div>

                    {!isLoggedIn ? (
                      <div className="bg-[#090A0D] rounded-2xl border border-white/5 p-8 max-w-md mx-auto text-center space-y-4 my-8">
                        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-200">Admin Authorization Required</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          You must supply valid administrator credentials to unlock structural database fields.
                        </p>
                        <form onSubmit={handleLogin} className="space-y-3 pt-2 text-left">
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Username</label>
                            <input 
                              type="text"
                              value={loginForm.username}
                              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Password</label>
                            <input 
                              type="password"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Default credentials: <span className="text-slate-400 font-mono">admin / albion</span></p>
                          </div>
                          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer">
                            Unlock Workspace
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Selector items column */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            1. Select Target Item
                          </label>
                          <div className="max-h-[380px] overflow-y-auto border border-white/5 rounded-xl bg-[#0D0F14]/50 p-2 space-y-1">
                            {items.map(it => (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() => handleSelectRecipeItem(it.id)}
                                className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors block cursor-pointer ${
                                  selectedRecipeItemId === it.id
                                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                                    : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <div className="font-bold">{it.name}</div>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5">{it.id}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Ingredients rows form column */}
                        <div className="md:col-span-2 space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              2. Recipe Component Materials
                            </label>
                            
                            <button
                              type="button"
                              onClick={addIngredientRow}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded border border-white/5 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Material Row
                            </button>
                          </div>

                          <div className="space-y-2 max-h-[340px] overflow-y-auto bg-[#0D0F14] border border-white/5 rounded-xl p-3">
                            {recipeIngredients.length === 0 ? (
                              <p className="text-slate-500 text-xs text-center py-8 leading-relaxed">
                                No recipe ingredients defined for this item yet.<br />
                                Click "Add Material Row" to configure requirements.
                              </p>
                            ) : (
                              recipeIngredients.map((ing, idx) => (
                                <div key={idx} className="flex gap-2 items-center bg-[#161920] p-2 rounded-lg border border-white/5">
                                  <div className="flex-1 min-w-0">
                                    <select
                                      value={ing.material_id}
                                      onChange={(e) => updateIngredientRow(idx, 'material_id', e.target.value)}
                                      className="w-full bg-[#0D0F14] border border-white/5 rounded p-1.5 text-xs text-slate-200 focus:outline-[1px] focus:outline-indigo-500 cursor-pointer"
                                    >
                                      {materials.filter(m => m.type !== 'Artifact').map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="w-20">
                                    <input
                                      type="number"
                                      min="1"
                                      value={ing.quantity}
                                      onChange={(e) => updateIngredientRow(idx, 'quantity', e.target.value)}
                                      placeholder="Qty"
                                      className="w-full bg-[#0D0F14] border border-white/5 rounded p-1.5 text-xs text-center text-slate-200 font-mono focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-[#0D0F14] px-2.5 py-1.5 rounded border border-white/5">
                                    <input
                                      type="checkbox"
                                      id={`art-check-${idx}`}
                                      checked={!!ing.is_artifact_material}
                                      onChange={(e) => updateIngredientRow(idx, 'is_artifact_material', e.target.checked)}
                                      className="w-3.5 h-3.5 rounded text-indigo-600 border-white/10 bg-slate-900 cursor-pointer"
                                    />
                                    <label htmlFor={`art-check-${idx}`} className="text-[10px] text-slate-400 select-none cursor-pointer">Artifact?</label>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeIngredientRow(idx)}
                                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {selectedRecipeItemId && (
                            <button
                              type="button"
                              onClick={saveRecipeSubmit}
                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer"
                            >
                              Save Recipe Blueprint specifications
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Price Management Panel */}
              {activeTab === 'prices' && (
                <div id="prices-panel" className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                          <Coins className="w-5 h-5 text-indigo-400" /> Manual Daily Market Prices
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Manual updates are security enforced. APIs are turned off in favor of absolute admin-defined efficiency.</p>
                      </div>
                    </div>

                    {!isLoggedIn ? (
                      <div className="bg-[#090A0D] rounded-2xl border border-white/5 p-8 max-w-md mx-auto text-center space-y-4 my-8">
                        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-200">Admin Authorization Required</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          You must supply valid administrator credentials to unlock structural database fields.
                        </p>
                        <form onSubmit={handleLogin} className="space-y-3 pt-2 text-left">
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Username</label>
                            <input 
                              type="text"
                              value={loginForm.username}
                              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Password</label>
                            <input 
                              type="password"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                              className="w-full bg-[#111318] border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500" 
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Default credentials: <span className="text-slate-400 font-mono">admin / albion</span></p>
                          </div>
                          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer">
                            Unlock Workspace
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 text-xs text-amber-400 font-sans tracking-wide leading-relaxed">
                          Edit the direct rates inside individual grids! When you are ready, lock the entries into the MySQL database with the "Commit Pricing Changes" action block.
                        </div>

                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
                            <input 
                              type="text" 
                              placeholder="Search prices by tier, material ID, or enchantment (e.g., T6, .2, Wood)..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-[#0D0F14] border border-white/5 rounded-xl text-xs focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                          {filteredPrices.map(priceEntry => {
                            const currentVal = priceUpdates[priceEntry.material_id] !== undefined 
                              ? priceUpdates[priceEntry.material_id] 
                              : priceEntry.price;
                            
                            // Parse out tier and enchantment for pretty display
                            const match = priceEntry.material_id.match(/^T(\d)_(.*?)(?:@(\d))?$/);
                            const tier = match ? match[1] : '';
                            const baseMatId = match ? match[2] : priceEntry.material_id;
                            const enchantment = match && match[3] ? match[3] : '0';
                            
                            const baseMat = materials.find(m => m.id === baseMatId);
                            const displayName = baseMat 
                              ? `Tier ${tier}.${enchantment} ${baseMat.name}` 
                              : priceEntry.material_id;
                            
                            return (
                              <div key={priceEntry.material_id} className="p-3 rounded-xl bg-[#0D0F14] border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded bg-[#161920] flex flex-col items-center justify-center border border-white/5 shrink-0">
                                    <span className="text-[10px] font-bold text-amber-500 font-mono">T{tier || '?'}$</span>
                                    {enchantment !== '0' && <span className="text-[8px] text-indigo-400 font-mono">.{enchantment}</span>}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-slate-200">{displayName}</div>
                                    <div className="text-[9px] text-slate-500 font-mono">{priceEntry.material_id}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text"
                                    value={currentVal}
                                    onChange={(e) => handlePriceFieldChange(priceEntry.material_id, e.target.value)}
                                    className="w-24 bg-[#161920] border border-white/10 rounded p-1.5 text-xs text-right font-mono text-emerald-400 focus:outline-[1px] focus:outline-indigo-500"
                                    placeholder="e.g. 10k"
                                  />
                                  <span className="text-xs text-slate-500 font-mono">s</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button 
                          onClick={saveAllPrices}
                          className="w-full py-2.5 bg-[#12B76A] hover:bg-[#0E9F5D] text-white rounded-xl text-xs font-bold tracking-widest uppercase transition-colors shrink-0 cursor-pointer"
                        >
                          Commit Pricing Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Session History View (Requirement 7) */}
              {activeTab === 'session_history' && (
                <div id="session-history-panel" className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                          <FileSpreadsheet className="w-5 h-5 text-indigo-400" /> Session Crafting History Log
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          Track your archived crafting sessions, revenue yields, materials spent, and net margins.
                        </p>
                      </div>
                      {sessionHistory.length > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to purge all crafting history? This action is irreversible.")) {
                              setSessionHistory([]);
                              triggerStatus("Session history has been purged.", "success");
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 transition-colors cursor-pointer"
                        >
                          Clear Log
                        </button>
                      )}
                    </div>

                    {sessionHistory.length === 0 ? (
                      <div className="py-20 text-center space-y-3 bg-[#0D0F14]/30 rounded-2xl border border-white/5">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-300">No session crafting records yet</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Complete a single calculation or a multiple item session row and click "Log Completed Session" to store metrics here.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {sessionHistory.map((sess) => {
                          const formattedTime = new Date(sess.timestamp).toLocaleString();
                          const isProfit = sess.netProfit >= 0;
                          return (
                            <div key={sess.id} className="p-4 bg-[#0D0F14] border border-white/5 rounded-2xl hover:border-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-slate-500">{formattedTime}</span>
                                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-wider">
                                    {sess.items.length} {sess.items.length === 1 ? 'Item' : 'Items'}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-slate-200 mt-1 flex flex-wrap gap-1.5">
                                  {sess.items.map((it, idx) => (
                                    <span key={idx} className="inline-block bg-slate-900 border border-white/5 rounded px-2 py-0.5 text-[11px] text-slate-300 font-mono">
                                      {it.qty}x T{it.tier}.{it.enchantment} {it.name}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 sm:gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 font-mono">
                                <div className="text-right">
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest font-sans">Total Silver Costs</div>
                                  <div className="text-xs font-bold text-slate-300">{sess.totalCost.toLocaleString()}s</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest font-sans">Net Profit</div>
                                  <div className={`text-sm font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isProfit ? '+' : ''}{sess.netProfit.toLocaleString()}s
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setSessionHistory(prev => prev.filter(p => p.id !== sess.id));
                                    triggerStatus("Logged craft removed.", "success");
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 border border-white/5 transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* BENTO COLUMN: Session Materials Panel (Span 4) (Requirement 2, 3, 4, 5, 6, 7, 8) */}
            <section id="bento-market" className="md:col-span-4 bg-[#161920] rounded-2xl border border-white/5 flex flex-col overflow-hidden max-h-[600px] shadow-2xl relative">
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111318]/50">
                <div>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-xs uppercase tracking-widest">
                    <Coins className="w-3.5 h-3.5 text-amber-500" /> Session Materials
                  </h3>
                  <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Dynamic Materials & Shared Session Pricing</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                  Active Session
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {activeSessionMaterials.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                    <Layers className="w-8 h-8 text-slate-700" />
                    <span>No active crafting recipes. Select items to craft to list materials here.</span>
                  </div>
                ) : (
                  activeSessionMaterials.map(m => {
                    const dailyPrice = prices.find(p => p.material_id === m.materialId)?.price || 0;
                    const curPrice = customPrices[m.materialId] !== undefined ? customPrices[m.materialId] : dailyPrice;
                    const isOverridden = customPrices[m.materialId] !== undefined && customPrices[m.materialId] !== dailyPrice;
                    
                    const inputValue = sessionInputPrices[m.materialId] !== undefined 
                      ? sessionInputPrices[m.materialId]
                      : curPrice.toLocaleString();

                    return (
                      <div key={m.materialId} className={`flex items-center justify-between p-2.5 bg-[#0D0F14] rounded-xl border transition-colors ${
                        isOverridden ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-white/5 hover:border-white/10'
                      }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={m.imageUrl} 
                            alt={m.materialName} 
                            className="w-9 h-9 rounded bg-slate-900 object-cover border border-white/5" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://render.albiononline.com/v1/item/' + m.baseId;
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-300 truncate">{m.materialName}</div>
                            <div className="text-[8px] font-mono text-slate-500 truncate mt-0.5">{m.materialId}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              setSessionInputPrices(prev => ({ ...prev, [m.materialId]: rawVal }));
                              const parsedVal = parseAlbionNumber(rawVal);
                              setCustomPrices(prev => ({
                                ...prev,
                                [m.materialId]: parsedVal
                              }));
                            }}
                            onBlur={() => {
                              setSessionInputPrices(prev => {
                                const copy = { ...prev };
                                delete copy[m.materialId];
                                return copy;
                              });
                            }}
                            className="w-20 bg-[#161920] border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-md py-1 px-1.5 text-right font-mono text-xs text-amber-400 focus:outline-none"
                            placeholder="Price"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">s</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {activeSessionMaterials.length > 0 && (
                <div className="p-3 bg-indigo-500/5 border-t border-white/5 shrink-0 space-y-2">
                  <p className="text-[9px] text-slate-400 leading-tight">
                    * Interactive pricing edits apply to your workspace instantly. Prices are ephemeral until committed.
                  </p>
                  <button 
                    onClick={saveSessionPricesToDatabase}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Save Current Prices
                  </button>
                </div>
              )}
            </section>

            {/* BENTO COLUMN: Indexed Items stat card (Span 3) */}
            <section id="bento-stats" className="md:col-span-3 bg-[#161920] rounded-2xl border border-white/5 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-3 translate-y-3">
                <DBIcon className="w-32 h-32 text-indigo-400" />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Items</h3>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
              </div>
              
              <div className="my-4">
                <div className="text-4xl font-black text-slate-100 font-mono">
                  {items.length}
                </div>
                <div className="text-[10px] text-slate-400 tracking-wide mt-1">Items fully normalized & mapped</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Filling Index State</span>
                  <span className="font-mono">{Math.min(100, Math.floor((items.length / 50) * 100))}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, (items.length / 50) * 100)}%` }}></div>
                </div>
              </div>
            </section>

            {/* BENTO COLUMN: Active material types count (Span 3) */}
            <section id="bento-materials-count" className="md:col-span-3 bg-[#161920] rounded-2xl border border-white/5 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Materials</h3>
                <span className="text-[10px] text-indigo-400 font-semibold tracking-wider font-mono">2026 Core</span>
              </div>

              <div className="my-4">
                <div className="text-4xl font-black text-slate-100 font-mono">
                  {materials.length}
                </div>
                <div className="text-[10px] text-slate-400 tracking-wide mt-1">Resource variants linked</div>
              </div>

              {/* Mini visual chart graphic */}
              <div className="flex items-end gap-1.5 h-8">
                <span className="w-1.5 h-4 bg-indigo-500/40 rounded-sm"></span>
                <span className="w-1.5 h-6 bg-indigo-500/60 rounded-sm"></span>
                <span className="w-1.5 h-3 bg-indigo-500/20 rounded-sm"></span>
                <span className="w-1.5 h-8 bg-indigo-500 rounded-sm animate-pulse"></span>
                <span className="w-1.5 h-5 bg-indigo-500/50 rounded-sm"></span>
                <span className="w-1.5 h-6.5 bg-indigo-500/70 rounded-sm"></span>
                <span className="w-1.5 h-4 bg-indigo-500/30 rounded-sm"></span>
              </div>
            </section>

            {/* BENTO COLUMN: Fast search input / Quick filters shortcut (Span 6) */}
            <section id="bento-search-shortcuts" className="md:col-span-6 bg-[#161920] rounded-2xl border border-white/5 p-5 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick Search Database</h3>
                <span className="text-[9px] text-slate-500 italic">Filters workspace list</span>
              </div>

              <div className="relative flex-1 flex items-center my-2">
                <Search className="absolute left-4 w-4.5 h-4.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Instantly filter Material registries or Item Codex..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 bg-[#0D0F14] border border-white/5 rounded-xl pl-11 pr-4 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              {/* Hot query tags preview */}
              <div className="mt-2 flex gap-1.5 overflow-hidden">
                <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded border border-white/5 text-slate-400 whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 hover:text-indigo-300" onClick={() => setSearchQuery('Bow')}>
                  Bow
                </span>
                <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded border border-white/5 text-slate-400 whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 hover:text-indigo-300" onClick={() => setSearchQuery('Leather')}>
                  Leather
                </span>
                <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded border border-white/5 text-slate-400 whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 hover:text-indigo-300" onClick={() => setSearchQuery('Ore')}>
                  Ore
                </span>
                <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded border border-white/5 text-slate-400 whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 hover:text-indigo-300" onClick={() => setSearchQuery('')}>
                  Reset Filter
                </span>
              </div>
            </section>

          </div>
        </main>
      </div>

      {/* MODAL: ADD / EDIT MATERIAL DIALOG */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 bg-[#000]/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#161920] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
              {editingMaterial ? 'Edit Material specifications' : 'Create new Material Codex card'}
            </h3>
            
            <form onSubmit={saveMaterialSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Material ID (e.g. T4_WOOD_BIRCH)</label>
                <input 
                  type="text" 
                  value={materialForm.id}
                  onChange={(e) => setMaterialForm({ ...materialForm, id: e.target.value })}
                  disabled={!!editingMaterial}
                  placeholder="UNIQUE_ALBION_ID"
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Material Name</label>
                <input 
                  type="text" 
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  placeholder="e.g. T4 Birch Plank"
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Resource Category Type</label>
                <select 
                  value={materialForm.type}
                  onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Ore">Ore / Bars</option>
                  <option value="Fiber">Fiber / Cloth</option>
                  <option value="Wood">Wood / Planks</option>
                  <option value="Hide">Hide / Leather</option>
                  <option value="Stone">Stone / Blocks</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Icon / Illustration URL</label>
                <input 
                  type="url" 
                  value={materialForm.image_url}
                  onChange={(e) => setMaterialForm({ ...materialForm, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[9px] text-slate-500">Unsplash or direct image link. Leave empty for default symbol.</p>
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ITEM DIALOG */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-[#000]/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#161920] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
              {editingItem ? 'Edit Item Specification' : 'Register New Catalog Item'}
            </h3>

            <form onSubmit={saveItemSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Albion Item ID (e.g. T4_MAIN_BOW)</label>
                <input 
                  type="text" 
                  value={itemForm.id}
                  disabled={!!editingItem}
                  onChange={(e) => setItemForm({ ...itemForm, id: e.target.value })}
                  placeholder="UNIQUE_ALBION_ITEM_ID"
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Item Name</label>
                <input 
                  type="text" 
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Elder's Bow"
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Category</label>
                  <select 
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Weapon">Weapon</option>
                    <option value="Armor">Armor</option>
                    <option value="Off-hand">Off-hand</option>
                    <option value="Accessory">Accessory</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1 relative">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Parent Tree</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={itemForm.parent_tree}
                      onChange={(e) => {
                        setItemForm({ ...itemForm, parent_tree: e.target.value });
                        setIsParentTreeDropdownOpen(true);
                      }}
                      onFocus={() => setIsParentTreeDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsParentTreeDropdownOpen(false), 200)}
                      placeholder="e.g. Bow, Crossbow, custom..."
                      className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
                    />
                    {isParentTreeDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-[#161920] border border-white/10 rounded-xl max-h-40 overflow-y-auto z-50 shadow-2xl">
                        {parentTrees
                          .filter(pt => pt.toLowerCase().includes((itemForm.parent_tree || '').toLowerCase()))
                          .map(pt => (
                            <button
                              key={pt}
                              type="button"
                              onMouseDown={() => {
                                setItemForm({ ...itemForm, parent_tree: pt });
                                setIsParentTreeDropdownOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
                            >
                              {pt}
                            </button>
                          ))
                        }
                        {parentTrees.filter(pt => pt.toLowerCase() === (itemForm.parent_tree || '').toLowerCase()).length === 0 && itemForm.parent_tree && (
                          <div className="px-3 py-2 text-[10px] text-amber-500 italic bg-amber-500/5">
                            Create new "{itemForm.parent_tree}" Tree
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#0D0F14] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-300">Is Artifact Item</div>
                  <div className="text-[9px] text-slate-500">Requires specific rune/relic drops ?</div>
                </div>
                <input 
                  type="checkbox"
                  checked={itemForm.is_artifact}
                  onChange={(e) => setItemForm({ ...itemForm, is_artifact: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-0 border-white/10 bg-slate-900 cursor-pointer"
                />
              </div>

              {itemForm.is_artifact && (
                <div className="space-y-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-indigo-300">Artifact Name</label>
                    <input 
                      type="text" 
                      value={itemForm.artifact_name || ''}
                      onChange={(e) => setItemForm({ ...itemForm, artifact_name: e.target.value })}
                      placeholder="e.g. Fey Plate Helmet Artifact"
                      className="w-full bg-[#0D0F14] border border-indigo-400/20 rounded-xl p-2.5 text-xs text-indigo-100 focus:outline-[#1px] focus:outline-indigo-500"
                      required={itemForm.is_artifact}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-indigo-300">Artifact Item ID</label>
                    <input 
                      type="text" 
                      value={itemForm.artifact_id || ''}
                      onChange={(e) => setItemForm({ ...itemForm, artifact_id: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      placeholder="e.g. FEY_HELMET_ARTIFACT"
                      className="w-full bg-[#0D0F14] border border-indigo-400/20 rounded-xl p-2.5 text-xs text-indigo-100 font-mono focus:outline-[#1px] focus:outline-indigo-500"
                      required={itemForm.is_artifact}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Craft Fame</label>
                  <input 
                    type="number" 
                    value={itemForm.craft_fame}
                    onChange={(e) => setItemForm({ ...itemForm, craft_fame: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs text-right font-mono text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Nutrition Cost</label>
                  <input 
                    type="number" 
                    value={itemForm.nutrition_cost}
                    onChange={(e) => setItemForm({ ...itemForm, nutrition_cost: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 text-xs text-right font-mono text-slate-200"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
