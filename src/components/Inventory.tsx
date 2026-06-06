/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountingDB, Item, UOM, StockLedgerEntry } from '../types';
import { LiveAccountingDatabase } from '../utils/db';
import { Plus, Package, ShieldAlert, ArchiveRestore, ClipboardEdit, ListFilter, SlidersHorizontal, Search } from 'lucide-react';

interface InventoryProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
}

export default function Inventory({ db, onDbChange, onNotification }: InventoryProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedSkuForLedger, setSelectedSkuForLedger] = useState<string | null>(null);

  // New Item formulation fields
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [uom, setUom] = useState<UOM>('Pcs');
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [openingStock, setOpeningStock] = useState<number>(0);

  // Manual Adjustment fields
  const [showApplyAdjustment, setShowApplyAdjustment] = useState<string | null>(null); // holds Sku
  const [adjQty, setAdjQty] = useState<number>(0); // positive or negative qty
  const [adjRate, setAdjRate] = useState<number>(0);
  const [adjNotes, setAdjNotes] = useState('');

  const company = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  const formatCurrency = (val: number) => {
    const symbol = company?.currency === 'INR' ? '₹' : company?.currency === 'USD' ? '$' : '€';
    return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Safe Item Creation
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim() || sellingPrice < 0 || purchasePrice < 0) {
      onNotification('Please fill all mandatory variables accurately.', 'amber');
      return;
    }

    // Check if SKU exists already under this company
    const skuExists = db.items.some(i => i.sku.toLowerCase() === sku.toLowerCase() && i.companyId === db.activeCompanyId);
    if (skuExists) {
      onNotification('SKU already exists! Every item must maintain a unique SKU barcode identifier.', 'amber');
      return;
    }

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      const newItem: Item = {
        sku: sku.trim().toUpperCase(),
        companyId: state.activeCompanyId,
        name: name.trim(),
        uom,
        sellingPrice,
        purchasePrice,
        openingStock,
        createdAt: new Date().toISOString()
      };
      
      state.items.push(newItem);
      LiveAccountingDatabase.addLog(
        state, 
        'Created Item', 
        `Configured SKU: ${newItem.sku} (${name}) with initial opening stock of ${openingStock}.`,
        state.activeCompanyId,
        state.customUserEmail,
        'create',
        'item'
      );
    });

    onDbChange(newDb);
    setShowCreateModal(false);
    
    // reset fields
    setSku('');
    setName('');
    setUom('Pcs');
    setSellingPrice(0);
    setPurchasePrice(0);
    setOpeningStock(0);

    onNotification(`Product ${name} initialized successfully!`, 'success');
  };

  // Safe Stock Adjustment Application
  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showApplyAdjustment || adjQty === 0) return;

    if (activeFy?.isLocked) {
      onNotification("Current fiscal period is locked! Adjustments cannot be recorded.", "amber");
      return;
    }

    const adjustSku = showApplyAdjustment;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      const entry: StockLedgerEntry = {
        id: `st-adj-${Date.now()}`,
        companyId: state.activeCompanyId,
        fyId: state.activeFyId,
        itemSku: adjustSku,
        date: new Date().toISOString().split('T')[0], // today
        type: 'Adjustment',
        quantity: adjQty, // positive for addition, negative for shrinkage/scrap
        rate: adjRate || 0,
        notes: adjNotes.trim() || 'Manual stock reconciliation ledger write-in.'
      };

      state.stockLedger.push(entry);
      LiveAccountingDatabase.addLog(
        state, 
        'Stock Adjusted', 
        `Reconciled stock of SKU: ${adjustSku} by ${adjQty > 0 ? '+' : ''}${adjQty} ${uom}. Reason: ${entry.notes}`,
        state.activeCompanyId,
        state.customUserEmail,
        'update',
        'item'
      );
    });

    onDbChange(newDb);
    setShowApplyAdjustment(null);
    setAdjQty(0);
    setAdjRate(0);
    setAdjNotes('');

    onNotification('Manual Balance correction compiled and written.', 'success');
  };

  // Calculate items under this company
  const companyItems = db.items.filter(item => item.companyId === db.activeCompanyId);
  
  // Filter search matches
  const filteredItems = companyItems.filter(item => 
    item.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Page header and action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 flex items-center gap-2">
            <Package className="text-indigo-600" />
            Inventory &amp; Products Master
          </h2>
          <p className="text-slate-500 text-xs font-medium">Establish Products master definitions, track inward/outward supply chains, and reconcile wastage adjustments.</p>
        </div>

        <button
          onClick={() => {
            if (activeFy?.isLocked) {
              onNotification("The active financial year is locked. You cannot add products.", "amber");
              return;
            }
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4.5 py-2.5 text-xs rounded-xl transition-all cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <Plus className="size-4" />
          <span>Add Custom SKU</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Items Listing Grid (Cols: 2 on large screens) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4 text-slate-800">
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="size-4" />
              </span>
              <input
                type="text"
                placeholder="Search inventory by product title or exact SKU barcode..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-sans transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">SKU Barcode</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Inward Costs</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right">In Stock Current</th>
                  <th className="p-3 text-center">Tally Cards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-450 font-sans">
                      No matching item SKUs found in this firm ledger.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const currentStock = LiveAccountingDatabase.calculateStock(item.sku, db.activeCompanyId, db.items, db.stockLedger);
                    return (
                      <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-indigo-750 font-mono text-xs">{item.sku}</td>
                        <td className="p-3">
                          <span className="text-slate-850 font-sans font-bold block text-sm">{item.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium font-sans">UOM: {item.uom} | Opening: {item.openingStock}</span>
                        </td>
                        <td className="p-3 text-right text-slate-700 font-mono">{formatCurrency(item.purchasePrice)}</td>
                        <td className="p-3 text-right text-slate-700 font-mono">{formatCurrency(item.sellingPrice)}</td>
                        <td className="p-3 text-right font-bold text-slate-900 font-mono">
                          <span id={`stock-level-${item.sku}`} className={`inline-block px-2 py-0.5 rounded text-[11px] ${currentStock <= 3 ? 'text-amber-700 bg-amber-50 border border-amber-200 font-bold' : 'text-slate-800'}`}>
                            {currentStock} {item.uom} {currentStock <= 3 ? '(Low)' : ''}
                          </span>
                        </td>
                        <td className="p-3 text-center space-x-1 whitespace-nowrap">
                          {/* Ledger action */}
                          <button
                            id={`btn-ledger-${item.sku}`}
                            onClick={() => setSelectedSkuForLedger(item.sku)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-750 border border-indigo-100 px-3 py-1.5 rounded-xl text-[10px] uppercase font-bold cursor-pointer transition-all"
                          >
                            Card Logs
                          </button>
                          
                          {/* Manual adjustment action */}
                          <button
                            id={`btn-adj-${item.sku}`}
                            onClick={() => {
                              if (activeFy?.isLocked) {
                                onNotification("The period is locked. You cannot perform adjustments.", "amber");
                                return;
                              }
                              setShowApplyAdjustment(item.sku);
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-150 px-3 py-1.5 rounded-xl text-[10px] uppercase font-bold cursor-pointer transition-all"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Sidebar displaying detailed Product Stock Card (Ledger history for selected item) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-slate-800">
          <div>
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-3">
              <ArchiveRestore className="size-4.5 text-slate-400" />
              <h3 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-wider">Product Stock Card</h3>
            </div>

            {selectedSkuForLedger ? (() => {
              const item = companyItems.find(i => i.sku === selectedSkuForLedger);
              if (!item) return <p className="text-slate-500 text-xs">SKU model not found.</p>;

              const itemHistory = db.stockLedger
                .filter(l => l.itemSku === selectedSkuForLedger && l.companyId === db.activeCompanyId)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              const runningTotal = LiveAccountingDatabase.calculateStock(item.sku, db.activeCompanyId, db.items, db.stockLedger);

              return (
                <div className="space-y-4">
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-inner">
                    <span className="text-[10px] text-indigo-700 font-bold tracking-wider uppercase font-mono">{item.sku}</span>
                    <h4 className="text-base font-sans font-bold text-slate-900 mb-1 leading-tight">{item.name}</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-sans text-slate-600 pt-2 border-t border-indigo-100 mt-2 font-semibold">
                      <span>UOM Pack: <strong className="text-slate-800">{item.uom}</strong></span>
                      <span>Closing: <strong className="text-indigo-750 font-mono text-xs">{runningTotal} {item.uom}</strong></span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Stock ledger lines:</span>
                  <div className="space-y-2.5 overflow-y-auto max-h-[200px] pr-1">
                    {/* Primary Opening stock line representation */}
                    <div className="p-3 border border-slate-100 rounded-xl text-[11px] font-sans bg-slate-50/70 shadow-sm">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-semibold">
                        <span className="font-mono">{item.createdAt.slice(0, 10)}</span>
                        <span className="text-indigo-600 font-bold uppercase">Opening Tally</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Original Tally Ingress</span>
                        <span className="text-emerald-700 font-mono">+{item.openingStock} {item.uom}</span>
                      </div>
                    </div>

                    {itemHistory.length === 0 ? (
                      <p className="text-[10px] text-slate-450 italic font-sans py-2">No transactional stock ledger movements registered for this specific active range.</p>
                    ) : (
                      itemHistory.map(entry => (
                        <div key={entry.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/40 text-[11px] font-sans shadow-sm">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-semibold">
                            <span className="font-mono">{entry.date}</span>
                            <span className={`font-bold uppercase ${
                              entry.type === 'Inward' ? 'text-emerald-700' : 
                              entry.type === 'Outward' ? 'text-rose-700' : 'text-amber-700'
                            }`}>{entry.type}</span>
                          </div>
                          
                          <p className="text-slate-700 font-medium leading-relaxed mt-0.5">{entry.notes || 'No description write-on'}</p>
                          <div className="flex justify-between pt-1.5 border-t border-slate-100 mt-1.5 text-[10px] text-slate-500 font-semibold">
                            <span>Valuation per unit:</span>
                            <span className="text-slate-850 font-bold font-mono">{entry.type === 'Outward' ? '-' : '+'}{entry.quantity} @ {formatCurrency(entry.rate)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-10">
                <ArchiveRestore className="size-10 text-slate-400 mx-auto mb-2.5 opacity-55 animate-pulse" />
                <p className="text-xs text-slate-500 font-medium max-w-[200px] mx-auto leading-relaxed">Select any SKU&apos;s &quot;Card Logs&quot; to review its complete lifecycle trail and running stocks.</p>
              </div>
            )}
          </div>

          <div className="pt-3.5 border-t border-slate-100 text-[10px] text-slate-500 font-sans font-semibold leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 mt-4">
            <ShieldAlert className="size-4.5 inline mr-1 text-slate-400 align-text-bottom flex-shrink-0" />
            Every supply invoice automatically tallies stock. Do not delete vouchers manually except when adjusting corrections.
          </div>
        </div>

      </div>

      {/* 1. CREATE SKU MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <h3 className="font-sans font-bold text-lg text-slate-900 mb-1.5">Configure Item SKU</h3>
            <p className="text-slate-500 text-xs mb-4 leading-normal font-medium">Introduce custom items into your stock books. This initializes the item profile and opening records.</p>
            
            <form onSubmit={handleCreateItem} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">SKU / Code *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. SKU-MAC-M3"
                    value={sku} 
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">UOM Unit *</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value as UOM)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150"
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Kgs">Kgs (Kilograms)</option>
                    <option value="Ltr">Ltr (Litres)</option>
                    <option value="Box">Box (Boxes)</option>
                    <option value="Mtr">Mtr (Metres)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Item Label / Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Apple MacBook Pro"
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Cost Price *</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={purchasePrice} 
                    onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Retail Price *</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={sellingPrice} 
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Initial Opening Stock Count</label>
                <input 
                  type="number" 
                  min={0}
                  value={openingStock} 
                  onChange={(e) => setOpeningStock(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block font-medium">Carried forward into ledger as first available physical supply.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-all cursor-pointer shadow-sm"
                >
                  Initiate SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MANUAL ADJUSTMENT MODAL */}
      {showApplyAdjustment && (() => {
        const item = companyItems.find(i => i.sku === showApplyAdjustment);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
              <h3 className="font-sans font-bold text-lg text-slate-900 mb-1.5">Reconcile Inventory</h3>
              <p className="text-slate-500 text-xs mb-4 leading-normal font-medium">Record manual shortages or surpluses due to damage, wastage, or shrinkage. Updating counts updates book valuation immediately.</p>
              
              <form onSubmit={handleApplyAdjustment} className="space-y-4 text-xs font-sans">
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-indigo-700 font-bold tracking-wider uppercase font-mono">{item?.sku}</span>
                  <p className="font-bold text-slate-800 mt-0.5 leading-normal">{item?.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Adjustment Qty *</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. -2 for breakage"
                      value={adjQty} 
                      onChange={(e) => setAdjQty(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-100 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <span className="text-[9px] text-slate-500 mt-1 block font-medium leading-relaxed">Negative values = Waste. Positive values = Surplus found.</span>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Value Rate per Unit</label>
                    <input 
                      type="number" 
                      min={0}
                      value={adjRate} 
                      onChange={(e) => setAdjRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-150 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Reconciliation Notes *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Water damage in warehouse block B"
                    value={adjNotes} 
                    onChange={(e) => setAdjNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowApplyAdjustment(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl text-white font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Publish Adj
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
