/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Company, FinancialYear, AccountingDB, StockLedgerEntry } from '../types';
import { Building2, Calendar, Lock, Unlock, Plus, RefreshCw, Layers } from 'lucide-react';
import { LiveAccountingDatabase } from '../utils/db';

interface HeaderProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
}

export default function Header({ db, onDbChange, activeTab, setActiveTab, onNotification }: HeaderProps) {
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showFyModal, setShowFyModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);

  // New company form
  const [compName, setCompName] = useState('');
  const [compGstin, setCompGstin] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compCurrency, setCompCurrency] = useState('INR');

  // New FY form
  const [fyName, setFyName] = useState('');
  const [fyStart, setFyStart] = useState('2026-04-01');
  const [fyEnd, setFyEnd] = useState('2027-03-31');

  // Selected FY for Rollover carry-forward process
  const [rolloverSourceFyId, setRolloverSourceFyId] = useState(db.activeFyId);
  const [rolloverTargetName, setRolloverTargetName] = useState('FY 2027-28');
  const [rolloverTargetStart, setRolloverTargetStart] = useState('2027-04-01');
  const [rolloverTargetEnd, setRolloverTargetEnd] = useState('2028-03-31');

  const activeCompany = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  const handleCompanyChange = (compId: string) => {
    // Also switch active FY to first available for that company
    const relevantFys = db.financialYears.filter(f => f.companyId === compId);
    const firstFyId = relevantFys.length > 0 ? relevantFys[0].id : '';

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      state.activeCompanyId = compId;
      state.activeFyId = firstFyId;
      LiveAccountingDatabase.addLog(
        state, 
        'Changed Active Company', 
        `Switched workspace focus to company ID: ${compId}`,
        compId,
        state.customUserEmail,
        'update',
        'company'
      );
    });
    onDbChange(newDb);
    onNotification(`Switched to ${db.companies.find(c => c.id === compId)?.name}`, 'success');
  };

  const handleFyChange = (fyId: string) => {
    const selectedFy = db.financialYears.find(f => f.id === fyId);
    if (!selectedFy) return;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      state.activeFyId = fyId;
      LiveAccountingDatabase.addLog(
        state, 
        'Changed Financial Year', 
        `Switched reporting frame to Financial Year: ${selectedFy.name}`,
        state.activeCompanyId,
        state.customUserEmail,
        'update',
        'financial_year'
      );
    });
    onDbChange(newDb);
    onNotification(`Switched Active FY to ${selectedFy.name}`, 'neutral');
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;

    const newCompId = `comp-${Date.now()}`;
    const newFyId = `fy-${Date.now()}`;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      const newCompany: Company = {
        id: newCompId,
        name: compName,
        gstin: compGstin || 'Unregistered',
        address: compAddress || 'N/A',
        currency: compCurrency,
        createdAt: new Date().toISOString()
      };
      
      const defaultFy: FinancialYear = {
        id: newFyId,
        companyId: newCompId,
        name: 'FY 2026-27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isLocked: false
      };

      state.companies.push(newCompany);
      state.financialYears.push(defaultFy);
      state.activeCompanyId = newCompId;
      state.activeFyId = newFyId;

      LiveAccountingDatabase.addLog(
        state, 
        'Created Company', 
        `Provisioned new business entity and primary schema for ${compName}`,
        newCompId,
        state.customUserEmail,
        'create',
        'company'
      );
    });

    onDbChange(newDb);
    setShowCompanyModal(false);
    setCompName('');
    setCompGstin('');
    setCompAddress('');
    onNotification(`Successfully configured company ${compName}!`, 'success');
  };

  const handleCreateFy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fyName.trim() || !fyStart || !fyEnd) return;

    const newFyId = `fy-${Date.now()}`;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      const newFy: FinancialYear = {
        id: newFyId,
        companyId: state.activeCompanyId,
        name: fyName,
        startDate: fyStart,
        endDate: fyEnd,
        isLocked: false
      };
      state.financialYears.push(newFy);
      state.activeFyId = newFyId;
      LiveAccountingDatabase.addLog(
        state, 
        'Created Financial Year', 
        `Added Financial Year term range: ${fyName} with index locked as active.`,
        state.activeCompanyId,
        state.customUserEmail,
        'create',
        'financial_year'
      );
    });

    onDbChange(newDb);
    setShowFyModal(false);
    setFyName('');
    onNotification(`Configured Financial Year details for ${fyName}!`, 'success');
  };

  const handleToggleLockFy = () => {
    const currentFy = db.financialYears.find(f => f.id === db.activeFyId);
    if (!currentFy) return;

    const stateVerb = currentFy.isLocked ? 'Unlocked' : 'Locked';

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      const fyItem = state.financialYears.find(f => f.id === state.activeFyId);
      if (fyItem) {
        fyItem.isLocked = !fyItem.isLocked;
        LiveAccountingDatabase.addLog(
          state, 
          `FY ${stateVerb}`, 
          `Accounting period limits updated for ${fyItem.name}. New lock state: ${fyItem.isLocked}`,
          state.activeCompanyId,
          state.customUserEmail,
          'update',
          'financial_year'
        );
      }
    });

    onDbChange(newDb);
    onNotification(`Financial Year ${currentFy.name} has been ${stateVerb}!`, 'amber');
  };

  // Perform Rollover carry forward
  const handleRolloverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const sourceFy = db.financialYears.find(f => f.id === rolloverSourceFyId);
    if (!sourceFy) {
      onNotification('Invalid source Financial Year selected.', 'amber');
      return;
    }

    const newFyId = `fy-${Date.now()}`;

    // Target rollover calculations
    const newDb = LiveAccountingDatabase.updateDB((state) => {
      // 1. Mark previous source year as locked safely
      const prevFy = state.financialYears.find(f => f.id === rolloverSourceFyId);
      if (prevFy) prevFy.isLocked = true;

      // 2. Insert new Financial Year record
      const targetFy: FinancialYear = {
        id: newFyId,
        companyId: state.activeCompanyId,
        name: rolloverTargetName,
        startDate: rolloverTargetStart,
        endDate: rolloverTargetEnd,
        isLocked: false,
      };
      state.financialYears.push(targetFy);

      // 3. To satisfy rollover rule: Carry forward Closing stock to Opening stock for next terms
      // In our simple unified items array, items have fields for selling Price, purchase Price, and openingStock.
      // But items are global to all company years. To handle rollover gracefully in a lightweight table master,
      // we can update static Opening Stock count of items to match their final "Current Stock" dynamically, 
      // or we can insert "Manual Adjustments" logged on the start date of the new active financial year to bridge the values!
      // Carrying forward closing stock as automatic adjustments ensures perfect stock ledgers.
      const companyItems = state.items.filter(item => item.companyId === state.activeCompanyId);
      companyItems.forEach(item => {
        const closingStock = LiveAccountingDatabase.calculateStock(item.sku, state.activeCompanyId, state.items, state.stockLedger);
        
        // Log manual stock rollover adjustment in the incoming financial year!
        if (closingStock > 0) {
          const rolloverStockEntry: StockLedgerEntry = {
            id: `st-roll-${Date.now()}-${item.sku}`,
            companyId: state.activeCompanyId,
            fyId: newFyId,
            itemSku: item.sku,
            date: rolloverTargetStart,
            type: 'Inward',
            quantity: closingStock,
            rate: item.purchasePrice,
            notes: `Auto stock rollover carried forward from ${sourceFy.name}`
          };
          state.stockLedger.push(rolloverStockEntry);
        }
      });

      // 4. Carry forward customer & supplier closing balances as opening balances for the next stage.
      // We can adjust contact opening balances directly to match current actual balances.
      const companyContacts = state.contacts.filter(contact => contact.companyId === state.activeCompanyId);
      companyContacts.forEach(contact => {
        const closingBalance = LiveAccountingDatabase.getContactBalance(contact.id, state);
        
        // Set new opening balance
        contact.openingBalance = closingBalance;
      });

      // Clear historic vouchers under the older locked financial year if they want to isolate logs by period.
      // (Actually keeping logs linked to the active company ensures reports still render historical statements safely).
      
      // Select the new target FY as active
      state.activeFyId = newFyId;

      LiveAccountingDatabase.addLog(
        state, 
        'New FY Rollover Triggered', 
        `Terminated previous reporting term ${sourceFy.name} and established ${rolloverTargetName}. Closing ledger balances of contacts and closing stock values carried forward successfully.`,
        state.activeCompanyId,
        state.customUserEmail,
        'create',
        'financial_year'
      );
    });

    onDbChange(newDb);
    setShowRolloverModal(false);
    onNotification(`Rollover calculation complete! Active term reset to ${rolloverTargetName}`, 'success');
  };

  const activeCompFys = db.financialYears.filter(f => f.companyId === db.activeCompanyId);

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 py-4 px-6 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand / Title & App Name */}
        <div className="flex items-center gap-3">
          <div className="bg-indigo-650 text-white p-2.5 rounded-xl flex items-center justify-center shadow-sm">
            <Layers className="size-5.5" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-lg tracking-tight text-slate-800 leading-tight">LedgerPrime</h1>
            <p className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">Robust Double-Entry &amp; Inventory Suite</p>
          </div>
        </div>

        {/* Dynamic Selectors & Lock Switches */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          
          {/* Company Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs gap-2 shadow-sm">
            <Building2 className="text-slate-400 size-4 flex-shrink-0" />
            <div className="flex-1">
              <label className="block text-[8px] text-slate-400 uppercase font-sans font-bold tracking-wider">Company</label>
              <select 
                className="bg-transparent text-indigo-750 font-bold outline-none cursor-pointer max-w-[150px] truncate"
                value={db.activeCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
              >
                {db.companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white text-slate-800">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => setShowCompanyModal(true)}
              className="text-indigo-600 hover:text-indigo-800 p-0.5 ml-1 transition-colors"
              title="Configure New Company"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* Financial Year Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs gap-2 shadow-sm">
            <Calendar className="text-slate-400 size-4 flex-shrink-0" />
            <div className="flex-1">
              <label className="block text-[8px] text-slate-400 uppercase font-sans font-bold tracking-wider">Financial Year</label>
              <select 
                className="bg-transparent text-indigo-750 font-bold outline-none cursor-pointer"
                value={db.activeFyId}
                onChange={(e) => handleFyChange(e.target.value)}
              >
                {activeCompFys.map((f) => (
                  <option key={f.id} value={f.id} className="bg-white text-slate-800">
                    {f.name} {f.isLocked ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => setShowFyModal(true)}
              className="text-indigo-600 hover:text-indigo-800 p-0.5 ml-1 transition-colors"
              title="Add Financial Year Option"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* Period Lock state and Rollover Trigger */}
          <div className="col-span-2 flex items-center gap-1.5 justify-end sm:justify-start">
            <button
              onClick={handleToggleLockFy}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors border shadow-sm ${
                activeFy?.isLocked 
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
              title={activeFy?.isLocked ? "Unlock Period to enter transactions" : "Lock Period to freeze updates"}
            >
              {activeFy?.isLocked ? (
                <>
                  <Lock className="size-3.5 text-rose-500" />
                  <span>Period Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="size-3.5 text-emerald-500" />
                  <span>Period Unlocked</span>
                </>
              )}
            </button>

            {/* FY Rollover Function */}
            <button
              onClick={() => setShowRolloverModal(true)}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200/60 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              title="Perform Financial Year rollover and carry forward closing balances"
            >
              <RefreshCw className="size-3.5 text-indigo-600" />
              <span>Rollover FY</span>
            </button>
          </div>

        </div>

      </div>

      {/* Primary Tab Navigation */}
      <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-slate-100 flex items-center justify-start gap-1 overflow-x-auto text-sm no-print">
        {[
          { id: 'dashboard', name: 'Dashboard', icon: '📊' },
          { id: 'inventory', name: 'Inventory Master', icon: '📦' },
          { id: 'vouchers', name: 'Voucher Entry', icon: '📑' },
          { id: 'ledgers', name: 'Contacts & Ledgers', icon: '💰' },
          { id: 'reports', name: 'Reports Panel', icon: '📈' },
          { id: 'settings', name: 'Settings & Backups', icon: '⚙️' }
        ].map((tab) => (
          <button
            key={tab.id}
            id={`tab-btn-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold text-xs md:text-sm whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* 1. CREATE COMPANY MODAL */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-800">
            <h3 className="font-sans font-bold text-lg text-slate-900 mb-1">Create New Company</h3>
            <p className="text-slate-500 text-xs mb-4 leading-relaxed">Introduce a separate financial Entity. We automatically prepare primary templates and accounting ledgers.</p>
            
            <form onSubmit={handleCreateCompany} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Company legal Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Apex Global Ltd"
                  value={compName} 
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tax ID / GSTIN / Register No.</label>
                <input 
                  type="text" 
                  placeholder="e.g. 27AABCU1234F1Z8"
                  value={compGstin} 
                  onChange={(e) => setCompGstin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Currency Symbol</label>
                <select 
                  value={compCurrency} 
                  onChange={(e) => setCompCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="INR">₹ (INR - Indian Rupee)</option>
                  <option value="USD">$ (USD - US Dollars)</option>
                  <option value="EUR">€ (EUR - Euro) </option>
                  <option value="AED">د.إ (AED - UAE Dirham)</option>
                  <option value="GBP">£ (GBP - British Pound)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Office Address</label>
                <textarea 
                  rows={2}
                  placeholder="Street No, Industrial Block, Region"
                  value={compAddress} 
                  onChange={(e) => setCompAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCompanyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-colors cursor-pointer"
                >
                  Configure Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CREATE FINANCIAL YEAR MODAL */}
      {showFyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-slate-800">
            <h3 className="font-sans font-bold text-lg text-slate-900 mb-1">Add Financial Year Term</h3>
            <p className="text-slate-500 text-xs mb-4 leading-relaxed">Create a specific operational period limit. Vouchers must reside strictly inside these dates.</p>
            
            <form onSubmit={handleCreateFy} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Fiscal Year Label *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. FY 2027-28"
                  value={fyName} 
                  onChange={(e) => setFyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Start Date *</label>
                <input 
                  type="date" 
                  required
                  value={fyStart} 
                  onChange={(e) => setFyStart(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">End Date *</label>
                <input 
                  type="date" 
                  required
                  value={fyEnd} 
                  onChange={(e) => setFyEnd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowFyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-colors cursor-pointer"
                >
                  Save FY Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ROLLOVER MODAL */}
      {showRolloverModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-800">
            <h3 className="font-sans font-bold text-lg text-slate-900 mb-1 flex items-center gap-2">
              <RefreshCw className="size-5 text-indigo-600 animate-spin" />
              New Financial Year Rollover
            </h3>
            <p className="text-slate-500 text-xs mb-4 leading-relaxed">
              This triggers the closing rollover balance protocol. The active company's final **Closing Inventory** counts and 
              **Party Outstanding balances** will be securely formulated and passed downstream as initial **Opening values** for the subsequent term.
            </p>

            <form onSubmit={handleRolloverSubmit} className="space-y-4 text-xs font-sans">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-slate-700 shadow-inner">
                <p className="font-bold text-slate-800">⚡ Financial Impact Rules Applied:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 leading-relaxed font-sans">
                  <li>Previous Source Year will be automatically <strong>Frozen and Locked</strong>.</li>
                  <li>Inward logs are executed to Carry forward closing stock counts to the subsequent term.</li>
                  <li>Customer/Supplier ledger balance metrics are carried forward.</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Source FY period</label>
                  <select
                    value={rolloverSourceFyId}
                    onChange={(e) => setRolloverSourceFyId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800"
                  >
                    {activeCompFys.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">New Fiscal Term Label</label>
                  <input
                    type="text"
                    required
                    value={rolloverTargetName}
                    onChange={(e) => setRolloverTargetName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">New Start Date</label>
                  <input
                    type="date"
                    required
                    value={rolloverTargetStart}
                    onChange={(e) => setRolloverTargetStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">New End Date</label>
                  <input
                    type="date"
                    required
                    value={rolloverTargetEnd}
                    onChange={(e) => setRolloverTargetEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRolloverModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Begin Carry-Forward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </header>
  );
}
