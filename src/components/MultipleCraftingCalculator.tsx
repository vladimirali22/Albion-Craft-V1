import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, Coins, AlertCircle, ArrowUpRight, CheckCircle2, Search, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { Item, CraftRecipe, DailyPrice, Material } from '../types';
import { CraftCalculationService } from '../CraftCalculationService';

// Support Albion-style number formatting (Requirements 5)
// Examples: 10k -> 10,000; 2.5m -> 2,500,000; etc
export const parseAlbionNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  let clean = val.toString().trim().toLowerCase();
  if (!clean) return 0;

  // Swap common European comma decimals with standard dots e.g. 2,5m -> 2.5m
  clean = clean.replace(/,/g, '.');
  
  // Extract number and k/m matching
  const match = clean.match(/^([\d.]+)\s*([km]?)$/);
  if (!match) {
    // Non-standard fallback: extract numerical and dot characters
    const numericOnly = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(numericOnly);
    return isNaN(num) ? 0 : num;
  }

  const numPart = parseFloat(match[1]);
  const suffix = match[2];

  if (isNaN(numPart)) return 0;

  if (suffix === 'k') {
    return Math.round(numPart * 1_000);
  } else if (suffix === 'm') {
    return Math.round(numPart * 1_000_000);
  }

  return Math.round(numPart);
};

// Help format parsed numbers back into nice short Albion tags
export const formatAlbionNumber = (num: number): string => {
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return m % 1 === 0 ? `${m}m` : `${m.toFixed(2)}m`;
  }
  if (num >= 1_000) {
    const k = num / 1_000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return num.toLocaleString();
};

export interface SessionItem {
  id: string;
  itemId: string;
  tier: number;
  enchantment: number;
  quantityInput: string;
  sellingPriceInput: string;
  searchQuery: string;
  isSearchOpen: boolean;
}

interface MultipleCraftingCalculatorProps {
  items: Item[];
  recipes: CraftRecipe[];
  prices: DailyPrice[];
  materials: Material[];
  sessionItems?: SessionItem[];
  setSessionItems?: React.Dispatch<React.SetStateAction<SessionItem[]>>;
  onLogSession?: (sessionItems: SessionItem[], totals: any) => void;
}

export const MultipleCraftingCalculator: React.FC<MultipleCraftingCalculatorProps> = ({
  items,
  recipes,
  prices,
  materials,
  sessionItems: propSessionItems,
  setSessionItems: propSetSessionItems,
  onLogSession,
}) => {
  // Global Session Controls
  const [rrr, setRrr] = useState<number>(24.8); // Default to standard City Crafting
  const [isPremium, setIsPremium] = useState<boolean>(true); // F2P vs Premium Taxes
  const [targetProfitInput, setTargetProfitInput] = useState<string>('10m'); // Target profit input with Albion code support

  // List of items in the session. Initialize with one default Bow item row if possible.
  const [localSessionItems, setLocalSessionItems] = useState<SessionItem[]>(() => {
    const initialItem = items.find(i => i.id === 'MAIN_BOW') || items[0];
    return [
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
    ];
  });

  const sessionItems = propSessionItems !== undefined ? propSessionItems : localSessionItems;
  const setSessionItems = propSetSessionItems !== undefined ? propSetSessionItems : setLocalSessionItems;

  // Derived records
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    prices.forEach(p => {
      map[p.material_id] = p.price;
    });
    return map;
  }, [prices]);

  const materialsMap = useMemo(() => {
    const map: Record<string, Material> = {};
    materials.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [materials]);

  // Handle adding a new row
  const addSessionItem = () => {
    const defaultItem = items[0];
    const newId = `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setSessionItems(prev => [
      ...prev,
      {
        id: newId,
        itemId: defaultItem ? defaultItem.id : '',
        tier: 4,
        enchantment: 0,
        quantityInput: '50',
        sellingPriceInput: '20k',
        searchQuery: defaultItem ? defaultItem.name : '',
        isSearchOpen: false
      }
    ]);
  };

  // Handle removing a row
  const removeSessionItem = (id: string) => {
    if (sessionItems.length <= 1) {
      // Keep at least one item
      setSessionItems([
        {
          id: `row-${Date.now()}`,
          itemId: '',
          tier: 4,
          enchantment: 0,
          quantityInput: '10',
          sellingPriceInput: '0',
          searchQuery: '',
          isSearchOpen: false
        }
      ]);
      return;
    }
    setSessionItems(prev => prev.filter(item => item.id !== id));
  };

  // Handle changing row properties
  const updateSessionItem = (id: string, updates: Partial<SessionItem>) => {
    setSessionItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      return item;
    }));
  };

  // Perform calculations for all session items separately (Requirement 2)
  const calculatedItems = useMemo(() => {
    return sessionItems.map(row => {
      const item = items.find(i => i.id === row.itemId);
      const activeRecipe = recipes.find(r => r.item_id === row.itemId);
      
      const qty = parseAlbionNumber(row.quantityInput);
      const sellPrice = parseAlbionNumber(row.sellingPriceInput);

      if (!row.itemId) {
        return {
          row,
          item: null,
          qty,
          sellPrice,
          calculated: null,
          error: "No item selected"
        };
      }

      if (!item || !activeRecipe) {
        return {
          row,
          item,
          qty,
          sellPrice,
          calculated: null,
          error: "Recipe config missing for this item"
        };
      }

      // Seed standard artifact pricing if relevant
      let seededArtifactPrice = 0;
      const artId = item.artifact_id;
      if (artId) {
        const fullyQualifiedId = `T${row.tier}_${artId}`;
        seededArtifactPrice = priceMap[fullyQualifiedId] || 0;
      } else {
        const artIng = activeRecipe.ingredients.find(ing => ing.is_artifact_material);
        if (artIng) {
          const fullyQualifiedId = `T${row.tier}_${artIng.material_id}`;
          seededArtifactPrice = priceMap[fullyQualifiedId] || 0;
        }
      }

      const calculated = CraftCalculationService.calculateAll(
        {
          item,
          recipe: activeRecipe,
          tier: row.tier,
          enchantment: row.enchantment,
          quantity: qty,
          rrr,
          sellingPrice: sellPrice,
          isPremium,
          manualArtifactPrice: seededArtifactPrice,
        },
        materialsMap,
        priceMap
      );

      return {
        row,
        item,
        qty,
        sellPrice,
        calculated,
        error: null
      };
    });
  }, [sessionItems, items, recipes, priceMap, materialsMap, rrr, isPremium]);

  // Session Totals Summary (Requirement 3)
  const sessionTotals = useMemo(() => {
    let totalCost = 0;
    let totalRevenue = 0;
    let totalTaxes = 0;
    let totalNetProfit = 0;

    calculatedItems.forEach(res => {
      if (res.calculated) {
        totalCost += res.calculated.totalSilverCost;
        totalRevenue += res.calculated.totalRevenue;
        totalTaxes += (res.calculated.setupFee + res.calculated.transactionTax);
        totalNetProfit += res.calculated.netProfit;
      }
    });

    return {
      totalCost,
      totalRevenue,
      totalTaxes,
      totalNetProfit
    };
  }, [calculatedItems]);

  // Target Profit System Suggestions (Requirement 4)
  const targetProfit = useMemo(() => {
    return parseAlbionNumber(targetProfitInput);
  }, [targetProfitInput]);

  const reachedTargetProfit = sessionTotals.totalNetProfit >= targetProfit;

  const profitSuggestions = useMemo(() => {
    if (reachedTargetProfit || targetProfit <= 0) return [];
    
    const neededProfit = targetProfit - sessionTotals.totalNetProfit;
    const recommendations: {
      rowId: string;
      itemName: string;
      tier: number;
      enchantment: number;
      extraQtyNeeded: number;
      currentQty: number;
    }[] = [];

    calculatedItems.forEach(res => {
      if (res.calculated && res.error === null && res.item) {
        const qty = res.qty;
        const netProfit = res.calculated.netProfit;
        const unitNetProfit = netProfit / qty; // estimated profit margin per single item craft

        if (unitNetProfit > 0) {
          const extraQtyNeeded = Math.ceil(neededProfit / unitNetProfit);
          recommendations.push({
            rowId: res.row.id,
            itemName: res.item.name,
            tier: res.row.tier,
            enchantment: res.row.enchantment,
            extraQtyNeeded,
            currentQty: qty
          });
        }
      }
    });

    return recommendations;
  }, [reachedTargetProfit, targetProfit, sessionTotals.totalNetProfit, calculatedItems]);

  // Helper action to automatically apply recommendation
  const applySuggestion = (rowId: string, additionalQty: number) => {
    const row = sessionItems.find(i => i.id === rowId);
    if (row) {
      const currentVal = parseAlbionNumber(row.quantityInput);
      updateSessionItem(rowId, {
        quantityInput: (currentVal + additionalQty).toString()
      });
    }
  };

  return (
    <div id="multiple-crafting-calculator-panel" className="space-y-6 flex-1 flex flex-col justify-between">
      <div>
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-5 mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" /> Session Crafting & Multiple Calculator
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Add multiple different equipment rows, coordinate market values, and compute aggregate session profit targets.
            </p>
          </div>

          {/* Preset parameters & controls */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-3 rounded-2xl border border-white/5">
            {/* Global RRR Choice */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Global Return Rate (RRR %)</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  step="0.1"
                  min="0"
                  max="99"
                  value={rrr}
                  onChange={(e) => setRrr(Math.min(99, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 bg-[#0D0F14] border border-white/10 rounded h-7 text-xs px-1.5 focus:outline-none font-mono text-indigo-400 text-center"
                />
                <select
                  value={rrr}
                  onChange={(e) => setRrr(parseFloat(e.target.value))}
                  className="bg-[#0D0F14] border border-white/10 rounded h-7 text-xs px-1 text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="0">Dry (0%)</option>
                  <option value="15.2">Outpost (15.2%)</option>
                  <option value="24.8">City (24.8%)</option>
                  <option value="43.5">F.Ref (43.5%)</option>
                  <option value="47.9">Max F. (47.9%)</option>
                </select>
              </div>
            </div>

            {/* Global Premium Status Flag */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Market Tax Bracket</span>
              <button
                type="button"
                onClick={() => setIsPremium(!isPremium)}
                className={`h-7 px-3 text-xs font-semibold rounded flex items-center gap-1.5 border transition-colors ${
                  isPremium
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    : 'bg-indigo-500/15 border-white/10 text-slate-300'
                }`}
              >
                {isPremium ? 'Premium (4% Tax)' : 'F2P (8% Tax)'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Session Summary HUD & 4. Target Profit System (Requirement 3 & 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Combined metrics card */}
          <div className="lg:col-span-8 bg-gradient-to-r from-slate-900/70 to-slate-950/60 border border-white/5 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[180px]">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-start mb-6 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Session Aggregate ledger</span>
                <h3 className="text-sm font-semibold text-slate-300 mt-1">Sum of all items currently configured below</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  id="btn-log-multiple-session"
                  onClick={() => onLogSession && onLogSession(sessionItems, sessionTotals)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] uppercase font-bold tracking-widest transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/10 shrink-0"
                >
                  Log Completed Session
                </button>
                <Coins className="w-5 h-5 text-indigo-400/60 hidden md:inline" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider">Total Silver Raw Cost</span>
                <div className="text-base font-black text-rose-400 font-mono mt-1">
                  {sessionTotals.totalCost.toLocaleString()} <span className="text-[10px] text-rose-500 font-bold">s</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider">Gross Listed Revenue</span>
                <div className="text-base font-black text-blue-400 font-mono mt-1">
                  {sessionTotals.totalRevenue.toLocaleString()} <span className="text-[10px] text-blue-500 font-bold">s</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider">Market Cut (Taxes/Fees)</span>
                <div className="text-base font-black text-orange-400 font-mono mt-1">
                  -{sessionTotals.totalTaxes.toLocaleString()} <span className="text-[10px] text-orange-500 font-bold">s</span>
                </div>
              </div>

              <div className="border-l border-white/5 pl-4">
                <span className="text-[9px] uppercase font-extrabold text-indigo-400 tracking-wider">Net Combined Profit</span>
                <div className={`text-xl font-extrabold font-mono mt-1 ${
                  sessionTotals.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {sessionTotals.totalNetProfit >= 0 ? '+' : ''}
                  {sessionTotals.totalNetProfit.toLocaleString()} <span className="text-xs font-bold">s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Target Profit Input Widget (Requirement 4) */}
          <div className="lg:col-span-4 bg-slate-900/30 border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  Target Profit Goal
                </label>
                <div className="flex items-center gap-1">
                  {reachedTargetProfit ? (
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Reached
                    </span>
                  ) : (
                    <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/10 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Under Target
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={targetProfitInput}
                  onChange={(e) => setTargetProfitInput(e.target.value)}
                  placeholder="e.g. 10m"
                  className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-3 pr-16 text-lg font-black font-mono text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="absolute right-3 top-3.5 text-[10px] text-slate-500 font-bold uppercase font-mono tracking-widest">
                  parsed: {formatAlbionNumber(targetProfit)}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 tracking-wide mt-1">Supports Albion formatting shortcut inputs like <span className="text-indigo-400 font-mono">10k</span>, <span className="text-indigo-400 font-mono">250k</span>, <span className="text-indigo-400 font-mono">2.5m</span>.</p>
            </div>

            {/* Target Status Bar */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Target Achievement rate:</span>
              <span className="text-sm font-black text-indigo-300 font-mono">
                {targetProfit > 0 
                  ? `${Math.min(500, Math.round((sessionTotals.totalNetProfit / targetProfit) * 100))}%` 
                  : '0%'
                }
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  reachedTargetProfit ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, targetProfit > 0 ? (sessionTotals.totalNetProfit / targetProfit) * 100 : 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Suggestion recommendations container */}
        {profitSuggestions.length > 0 && (
          <div className="mb-6 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 space-y-3 animate-fade-in text-sm text-slate-300 relative">
            <span className="absolute right-4 top-4 text-[9px] border border-amber-500/20 px-2 py-0.5 rounded text-amber-500 uppercase font-black uppercase tracking-widest font-mono">
              Actionable recommendation ledger
            </span>
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wide">Target Profit System Recommendations</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Your aggregate net profit ({sessionTotals.totalNetProfit.toLocaleString()}s) is currently under your desired goal ({targetProfit.toLocaleString()}s) by <strong className="text-slate-300font-mono">{(targetProfit - sessionTotals.totalNetProfit).toLocaleString()} Silver</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {profitSuggestions.map(rec => (
                <div key={rec.rowId} className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/15 transition-all">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-200">{rec.itemName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Tier {rec.tier}.{rec.enchantment} &bull; Current: {rec.currentQty} &bull; Add: <span className="text-amber-500 font-black">+{rec.extraQtyNeeded}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => applySuggestion(rec.rowId, rec.extraQtyNeeded)}
                    className="p-1 px-2.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-[#0D0F14] text-amber-400 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Apply Quantity
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Interactive Multiple Items Session Crafting Grid (Requirement 2) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#0D0F14]/70 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Crafting queue list</span>
            <button
              onClick={addSessionItem}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Craft Row
            </button>
          </div>

          <div className="space-y-4">
            {calculatedItems.map((res, index) => {
              const rowId = res.row.id;
              
              return (
                <div 
                  key={rowId} 
                  className="bg-[#090B10] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors relative"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/30 rounded-l-2xl shrink-0" />
                  
                  {/* Grid Rows Layout: Selector, Params, Prices, Calculated Output, Actions */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                    
                    {/* Item Autocomplete Search selector (Requirement 2) */}
                    <div className="lg:col-span-4 space-y-1.5 relative">
                      <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                        Equipment Target #{index + 1}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={res.row.searchQuery}
                          onChange={(e) => {
                            updateSessionItem(rowId, {
                              searchQuery: e.target.value,
                              isSearchOpen: true
                            });
                          }}
                          onFocus={() => updateSessionItem(rowId, { isSearchOpen: true })}
                          placeholder="Search items..."
                          className="w-full bg-[#0D0F14] border border-white/10 rounded-xl p-2.5 pr-8 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 font-semibold"
                        />
                        <div className="absolute right-2.5 top-3 flex items-center pointer-events-none">
                          <Search className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                      </div>

                      {/* Search dropdown suggestions list */}
                      {res.row.isSearchOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => {
                              const currItem = items.find(i => i.id === res.row.itemId);
                              updateSessionItem(rowId, { 
                                isSearchOpen: false, 
                                searchQuery: currItem ? currItem.name : '' 
                              });
                            }} 
                          />
                          <div className="absolute left-0 right-0 top-16 bg-[#0B0D12] border border-white/10 rounded-xl shadow-2xl z-45 max-h-[170px] overflow-y-auto divide-y divide-white/5">
                            {(() => {
                              const q = res.row.searchQuery.toLowerCase().trim();
                              const searchResults = items.filter(i => 
                                i.name.toLowerCase().includes(q) || 
                                i.id.toLowerCase().includes(q)
                              );

                              if (searchResults.length === 0) {
                                return (
                                  <div className="p-3 text-[10px] text-slate-500 text-center">
                                    No equipment matched
                                  </div>
                                );
                              }

                              return searchResults.slice(0, 15).map(i => (
                                <button
                                  key={i.id}
                                  type="button"
                                  onClick={() => {
                                    updateSessionItem(rowId, {
                                      itemId: i.id,
                                      searchQuery: i.name,
                                      isSearchOpen: false
                                    });
                                  }}
                                  className={`w-full text-left p-2 hover:bg-white/5 transition-colors flex items-center justify-between text-xs pr-3 ${
                                    res.row.itemId === i.id ? 'bg-white/5' : ''
                                  }`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-slate-200">{i.name}</span>
                                    <span className="text-[9px] text-[#4f46e5] font-mono">{i.parent_tree || 'General'}</span>
                                  </div>
                                  <span className="text-[9px] text-slate-500 font-mono block">ID: {i.id}</span>
                                </button>
                              ));
                            })()}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Target level, scale parameters */}
                    <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Tier dropdown */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-500">Tier</label>
                        <select
                          value={res.row.tier}
                          onChange={(e) => updateSessionItem(rowId, { tier: parseInt(e.target.value) || 4 })}
                          className="w-full bg-[#0D0F14] border border-white/10 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                        >
                          {[4, 5, 6, 7, 8].map(t => (
                            <option key={t} value={t}>Tier {t}</option>
                          ))}
                        </select>
                      </div>

                      {/* Enchant dropdown */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-500">Enchant</label>
                        <select
                          value={res.row.enchantment}
                          onChange={(e) => updateSessionItem(rowId, { enchantment: parseInt(e.target.value) || 0 })}
                          className="w-full bg-[#0D0F14] border border-white/10 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                        >
                          {[0, 1, 2, 3, 4].map(en => (
                            <option key={en} value={en}>.{en}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity input using Albion pricing strings directly */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400">Qty to Craft</label>
                        <input
                          type="text"
                          value={res.row.quantityInput}
                          onChange={(e) => updateSessionItem(rowId, { quantityInput: e.target.value })}
                          className="w-full bg-[#0D0F14] border border-white/10 rounded-lg p-2.5 text-xs text-center font-mono focus:outline-none focus:border-indigo-500 text-indigo-300"
                          placeholder="e.g. 50"
                        />
                      </div>

                      {/* Selling price input supporting Albion codes (Requirement 5) */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 flex justify-between">
                          <span>Sell Price</span>
                          <span className="text-[8px] text-amber-500">Silver</span>
                        </label>
                        <input
                          type="text"
                          value={res.row.sellingPriceInput}
                          onChange={(e) => updateSessionItem(rowId, { sellingPriceInput: e.target.value })}
                          className="w-full bg-[#0D0F14] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500"
                          placeholder="e.g. 15k"
                        />
                      </div>
                    </div>

                    {/* Calculated output metrics panel (Requirement 2) */}
                    <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-3 border-t lg:border-t-0 lg:border-l border-white/5 pt-3 lg:pt-0 lg:pl-4">
                      {/* Cost */}
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-500">Material Cost</span>
                        <div className="text-[11px] font-bold font-mono text-slate-400 mt-0.5">
                          {res.calculated 
                            ? `${res.calculated.totalSilverCost.toLocaleString()}s` 
                            : 'N/A'
                          }
                        </div>
                      </div>

                      {/* Revenue */}
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-500">Net Revenue</span>
                        <div className="text-[11px] font-bold font-mono text-emerald-400/90 mt-0.5" title="Revenue after setup fees and transaction tax deductions">
                          {res.calculated 
                            ? `${res.calculated.netRevenue.toLocaleString()}s` 
                            : 'N/A'
                          }
                        </div>
                      </div>

                      {/* Taxes */}
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-500">Total Tax & Fee</span>
                        <div className="text-[11px] font-bold font-mono text-rose-400/90 mt-0.5">
                          {res.calculated 
                            ? `-${(res.calculated.setupFee + res.calculated.transactionTax).toLocaleString()}s` 
                            : 'N/A'
                          }
                        </div>
                      </div>

                      {/* Net Profit */}
                      <div>
                        <span className="text-[8px] uppercase font-extrabold text-slate-400">Net Pure Profit</span>
                        <div className={`text-xs font-black font-mono mt-0.5 ${
                          res.calculated && res.calculated.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {res.calculated 
                            ? `${res.calculated.netProfit >= 0 ? '+' : ''}${res.calculated.netProfit.toLocaleString()}s` 
                            : 'N/A'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Row control actions */}
                    <div className="lg:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSessionItem(rowId)}
                        className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl border border-transparent hover:border-rose-500/10 transition-all cursor-pointer"
                        title="Remove equipment entry from session list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
