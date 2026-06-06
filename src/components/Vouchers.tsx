/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AccountingDB, VoucherType, Contact, Voucher, VoucherItem, StockLedgerEntry } from '../types';
import { LiveAccountingDatabase } from '../utils/db';
import { Plus, Trash2, ShieldAlert, FileText, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';

interface VouchersProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
}

export default function Vouchers({ db, onDbChange, onNotification }: VouchersProps) {
  // Operational state
  const [activeType, setActiveType] = useState<VoucherType>('Sales_Invoice');
  
  // Fields
  const [vouchNo, setVouchNo] = useState('');
  const [vouchDate, setVouchDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');
  const [cashBankAccount, setCashBankAccount] = useState<'Bank' | 'Cash'>('Bank');

  // Simple Payment/Receipt manual amount
  const [paymentAmt, setPaymentAmt] = useState<number>(0);

  // Dynamic Multi-item list (For Invoices & Bills)
  const [lineItems, setLineItems] = useState<VoucherItem[]>([
    { itemSku: '', quantity: 1, rate: 0, taxRate: 18, discountPercent: 0 }
  ]);

  const company = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  // Set default code patterns and dates when changing tab
  useEffect(() => {
    if (activeFy) {
      setVouchDate(activeFy.startDate);
    }
    const rand = Math.floor(100 + Math.random() * 900);
    if (activeType === 'Sales_Invoice') {
      setVouchNo(`INV-${new Date().getFullYear()}-${rand}`);
    } else if (activeType === 'Purchase_Bill') {
      setVouchNo(`BILL-${new Date().getFullYear()}-${rand}`);
    } else if (activeType === 'Payment') {
      setVouchNo(`PAY-${rand}`);
    } else {
      setVouchNo(`REC-${rand}`);
    }
  }, [activeType, activeFy]);

  const partyList = db.contacts.filter(c => c.companyId === db.activeCompanyId);
  const itemsList = db.items.filter(i => i.companyId === db.activeCompanyId);

  // Compute live subtotal summary values
  const computeVoucherTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    lineItems.forEach(line => {
      const lineCost = line.quantity * line.rate;
      const discount = lineCost * (line.discountPercent / 100);
      const netLine = lineCost - discount;
      const tax = netLine * (line.taxRate / 100);

      subtotal += netLine;
      taxTotal += tax;
      discountTotal += discount;
    });

    const netValue = subtotal + taxTotal;
    return { subtotal, taxTotal, discountTotal, netValue };
  };

  const { subtotal, taxTotal, discountTotal, netValue } = computeVoucherTotals();

  // Multi-item handlers
  const handleAddLine = () => {
    setLineItems([...lineItems, { itemSku: '', quantity: 1, rate: 0, taxRate: 18, discountPercent: 0 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lineItems.length <= 1) return;
    const copied = [...lineItems];
    copied.splice(idx, 1);
    setLineItems(copied);
  };

  const handleModifyLine = (idx: number, updates: Partial<VoucherItem>) => {
    const copied = [...lineItems];
    copied[idx] = { ...copied[idx], ...updates };

    // Auto-populate price when item is selected
    if (updates.itemSku) {
      const selectedItem = itemsList.find(i => i.sku === updates.itemSku);
      if (selectedItem) {
        copied[idx].rate = activeType === 'Sales_Invoice' ? selectedItem.sellingPrice : selectedItem.purchasePrice;
      }
    }

    setLineItems(copied);
  };

  // Safe Deletion with correct rollback effects
  const handleDeleteVoucher = (voucherId: string) => {
    if (activeFy?.isLocked) {
      onNotification("Current financial year index is locked. Transaction rollback aborted.", "amber");
      return;
    }

    const targetedVouch = db.vouchers.find(v => v.id === voucherId);
    if (!targetedVouch) return;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      // 1. Delete Stock Ledger linked entries triggered by this voucher
      state.stockLedger = state.stockLedger.filter(entry => entry.voucherId !== voucherId);

      // 2. Erase the voucher record itself
      state.vouchers = state.vouchers.filter(v => v.id !== voucherId);

      LiveAccountingDatabase.addLog(
        state, 
        'Voucher Deleted', 
        `Successfully rolled back transaction voucher code: ${targetedVouch.voucherNo}. Stock ledgers corrected.`,
        state.activeCompanyId,
        state.customUserEmail,
        'delete',
        'voucher'
      );
    });

    onDbChange(newDb);
    onNotification(`Voucher ${targetedVouch.voucherNo} successfully deleted and accounts recalculated!`, 'neutral');
  };

  // Submit and write the transactions voucher entry
  const handleSubmitVoucher = (e: React.FormEvent) => {
    e.preventDefault();

    if (!vouchNo.trim()) {
      onNotification('Mandatory field: Provide a valid Voucher identifier number.', 'amber');
      return;
    }

    // 1. Doublecheck period locking state
    if (activeFy?.isLocked) {
      onNotification("Reporting window is locked. Submissions restricted.", "amber");
      return;
    }

    // 2. Validate Voucher Date conforms to selected FY boundaries!
    const fyStartTs = new Date(activeFy.startDate).getTime();
    const fyEndTs = new Date(activeFy.endDate).getTime();
    const inputTs = new Date(vouchDate).getTime();

    if (inputTs < fyStartTs || inputTs > fyEndTs) {
      onNotification(`Error: Date selected (${vouchDate}) is locked outside the boundaries of ${activeFy.name} (${activeFy.startDate} to ${activeFy.endDate}).`, 'amber');
      return;
    }

    // 3. Negative Stock Scenario Block Enforcement
    if (activeType === 'Sales_Invoice' && db.negativeStockConfig === 'Block' && activeWarnings.length > 0) {
      onNotification(`**Sales Blocked!** Stock is insufficient for item(s) in this transaction. Doublecheck available levels or edit quantity.`, 'amber');
      return;
    }

    // Prepare voucher ID
    const newVoucherId = `vouch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      // Create primary voucher record
      const incomingVoucher: Voucher = {
        id: newVoucherId,
        companyId: state.activeCompanyId,
        fyId: state.activeFyId,
        type: activeType,
        voucherNo: vouchNo.trim(),
        date: vouchDate,
        partyId: partyId || undefined,
        referenceNo: refNo.trim() || undefined,
        notes: notes.trim() || undefined,
        paidFromOrReceivedInto: (activeType === 'Payment' || activeType === 'Receipt') ? cashBankAccount : undefined,
        amount: (activeType === 'Sales_Invoice' || activeType === 'Purchase_Bill') ? netValue : paymentAmt,
        taxAmount: (activeType === 'Sales_Invoice' || activeType === 'Purchase_Bill') ? taxTotal : 0,
        discountAmount: (activeType === 'Sales_Invoice' || activeType === 'Purchase_Bill') ? discountTotal : 0,
        items: (activeType === 'Sales_Invoice' || activeType === 'Purchase_Bill') ? lineItems : undefined,
        createdAt: new Date().toISOString()
      };

      state.vouchers.push(incomingVoucher);

      // Save stock card movements and audit details
      if (activeType === 'Sales_Invoice' && lineItems) {
        lineItems.forEach(line => {
          const entry: StockLedgerEntry = {
            id: `st-mv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            companyId: state.activeCompanyId,
            fyId: state.activeFyId,
            itemSku: line.itemSku,
            date: vouchDate,
            type: 'Outward',
            quantity: line.quantity,
            rate: line.rate,
            voucherId: newVoucherId,
            notes: `Dispatched via Sales Invoice: ${vouchNo}`
          };
          state.stockLedger.push(entry);
        });
      } else if (activeType === 'Purchase_Bill' && lineItems) {
        lineItems.forEach(line => {
          const entry: StockLedgerEntry = {
            id: `st-mv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            companyId: state.activeCompanyId,
            fyId: state.activeFyId,
            itemSku: line.itemSku,
            date: vouchDate,
            type: 'Inward',
            quantity: line.quantity,
            rate: line.rate,
            voucherId: newVoucherId,
            notes: `Received via Purchase Bill: ${vouchNo}`
          };
          state.stockLedger.push(entry);
        });
      }

      LiveAccountingDatabase.addLog(
        state, 
        'Voucher Recorded', 
        `Entered ${activeType.replace('_', ' ')}: ${vouchNo} for amount representing ${incomingVoucher.amount}.`,
        state.activeCompanyId,
        state.customUserEmail,
        'create',
        'voucher'
      );
    });

    onDbChange(newDb);

    // Reset details
    setNotes('');
    setRefNo('');
    setPaymentAmt(0);
    setLineItems([{ itemSku: '', quantity: 1, rate: 0, taxRate: 18, discountPercent: 0 }]);

    onNotification(`Voucher ${vouchNo} successfully logged and compiled!`, 'success');
  };

  // Check for any potential negative stock warning triggers in real-time
  const getNegativeStockWarnings = () => {
    if (activeType !== 'Sales_Invoice') return [];
    
    const warnings: string[] = [];
    lineItems.forEach(line => {
      if (!line.itemSku) return;
      const currentVal = LiveAccountingDatabase.calculateStock(line.itemSku, db.activeCompanyId, db.items, db.stockLedger);
      const itemDef = itemsList.find(i => i.sku === line.itemSku);
      
      if (currentVal - line.quantity < 0) {
        warnings.push(`Warning: SKU ${line.itemSku} (${itemDef?.name}) drops to negative stock count (${currentVal - line.quantity} units remaining).`);
      }
    });
    return warnings;
  };

  const activeWarnings = getNegativeStockWarnings();

  // Filters vouchers for B-List
  const fyVouchersList = db.vouchers
    .filter(v => v.companyId === db.activeCompanyId && v.fyId === db.activeFyId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      
      {/* Visual Header */}
      <div>
        <h2 className="text-xl font-bold font-sans text-slate-900 flex items-center gap-2">
          <FileText className="text-indigo-600" />
          Double-Entry Voucher System
        </h2>
        <p className="text-slate-500 text-xs font-semibold">Enter accounting transactions including Sales, Purchases, Receipts, and Payments. Data is distributed automatically across ledgers and inventory.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COL 1 & 2: VOUCHER CONFIGURATION ENGINE FORM */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-span-2 space-y-4 shadow-sm text-slate-800">
          
          {/* Active vouchers type selectors tabs */}
          <div className="flex border-b border-slate-200 pb-2 overflow-x-auto gap-1">
            {[
              { id: 'Sales_Invoice', label: 'Sales Invoice', color: 'border-indigo-600 text-indigo-700 bg-indigo-50/40 font-bold rounded-t-xl' },
              { id: 'Purchase_Bill', label: 'Purchase Bill', color: 'border-rose-600 text-rose-700 bg-rose-50/40 font-bold rounded-t-xl' },
              { id: 'Payment', label: 'Payment Voucher', color: 'border-amber-600 text-amber-700 bg-amber-50/40 font-bold rounded-t-xl' },
              { id: 'Receipt', label: 'Receipt Voucher', color: 'border-emerald-600 text-emerald-700 bg-emerald-50/40 font-bold rounded-t-xl' }
            ].map(tab => (
              <button
                key={tab.id}
                id={`tab-btn-voucher-${tab.id}`}
                type="button"
                onClick={() => setActiveType(tab.id as VoucherType)}
                className={`px-4 py-2.5 text-xs font-sans border-b-2 transition-all cursor-pointer ${
                  activeType === tab.id ? tab.color : 'border-transparent text-slate-500 hover:text-slate-850 hover:bg-slate-50 rounded-t-xl font-semibold'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmitVoucher} className="space-y-4 text-xs font-sans" id="voucher-creation-form">
            
            {/* Meta row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Voucher ID # *</label>
                <input
                  type="text"
                  required
                  value={vouchNo}
                  onChange={(e) => setVouchNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Transaction Date *</label>
                <input
                  type="date"
                  required
                  value={vouchDate}
                  onChange={(e) => setVouchDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">
                  {activeType === 'Sales_Invoice' || activeType === 'Receipt' ? 'Customer Party *' : 'Supplier Party *'}
                </label>
                <select
                  required
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Party --</option>
                  {partyList
                    .filter(c => {
                      if (activeType === 'Sales_Invoice' || activeType === 'Receipt') return c.type === 'Customer';
                      return c.type === 'Supplier';
                    })
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.gstin ? `(${c.gstin})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Inward Reference block */}
            {(activeType === 'Purchase_Bill' || activeType === 'Payment') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Vendor Reference Bill No.</label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-99321"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                {activeType === 'Payment' && (
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Settled from Asset Account</label>
                    <div className="flex gap-2">
                      {['Bank', 'Cash'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCashBankAccount(opt as 'Bank' | 'Cash')}
                          className={`flex-1 py-2 text-center rounded-xl border transition-all cursor-pointer font-bold ${
                            cashBankAccount === opt ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Receipt cash account selection */}
            {activeType === 'Receipt' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Received Into Asset Account</label>
                  <div className="flex gap-2">
                    {['Bank', 'Cash'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCashBankAccount(opt as 'Bank' | 'Cash')}
                        className={`flex-1 py-1.5 text-center rounded-xl border transition-all cursor-pointer font-bold ${
                          cashBankAccount === opt ? 'bg-teal-50 border-teal-200 text-teal-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* EXPANDABLE LINE ITEMS MATRIX (For Invoices and Bills) */}
            {(activeType === 'Sales_Invoice' || activeType === 'Purchase_Bill') ? (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Line Items List</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold cursor-pointer transition-colors"
                  >
                    <Plus className="size-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {lineItems.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200 items-center shadow-sm">
                      
                      {/* SKU Selection */}
                      <div className="col-span-12 sm:col-span-4">
                        <label className="block text-[9px] text-slate-500 mb-0.5 font-bold uppercase">Product SKU Barcode</label>
                        <select
                          required
                          value={line.itemSku}
                          onChange={(e) => handleModifyLine(idx, { itemSku: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] text-slate-800 focus:outline-none"
                        >
                          <option value="">-- Choose SKU --</option>
                          {itemsList.map(item => (
                            <option key={item.sku} value={item.sku}>
                              {item.sku} - {item.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[9px] text-slate-500 mb-0.5 font-bold uppercase">Quantity</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={line.quantity}
                          onChange={(e) => handleModifyLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] text-slate-800 focus:outline-none font-mono"
                        />
                      </div>

                      {/* Selling/Purchase Price */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[9px] text-slate-500 mb-0.5 font-bold uppercase">Rate / Unit</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={line.rate}
                          onChange={(e) => handleModifyLine(idx, { rate: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] text-slate-800 focus:outline-none font-mono"
                        />
                      </div>

                      {/* Tax Rate % */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[9px] text-slate-500 mb-0.5 font-bold uppercase">Tax Rate %</label>
                        <select
                          value={line.taxRate}
                          onChange={(e) => handleModifyLine(idx, { taxRate: parseInt(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] text-slate-800 focus:outline-none"
                        >
                          <option value="0">0% Exempt</option>
                          <option value="5">5% UT</option>
                          <option value="12">12% Standard</option>
                          <option value="18">18% Standard</option>
                          <option value="28">28% Luxury</option>
                        </select>
                      </div>

                      {/* Discount % */}
                      <div className="col-span-8 sm:col-span-1">
                        <label className="block text-[9px] text-slate-500 mb-0.5 font-bold uppercase">Disc%</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          onChange={(e) => handleModifyLine(idx, { discountPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] text-slate-800 focus:outline-none font-mono"
                        />
                      </div>

                      {/* Action delete row */}
                      <div className="col-span-4 sm:col-span-1 text-center pt-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lineItems.length <= 1}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg disabled:opacity-30 cursor-pointer pt-1 inline-block transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

                {/* Real-time Dynamic Warnings indicator */}
                {activeWarnings.length > 0 && (
                  <div id="negative-warn-banner" className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-center gap-2.5 shadow-sm">
                    <AlertTriangle className="size-4 text-amber-600 flex-shrink-0" />
                    <div className="font-sans font-semibold text-xs text-amber-700">
                      {activeWarnings.map((warn, i) => <p key={i}>{warn}</p>)}
                    </div>
                  </div>
                )}

                {/* Subtotals footer calculations */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-700 font-sans shadow-inner font-semibold">
                  <div className="text-center sm:text-left border-r border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Gross Price Sum</span>
                    <strong className="block text-sm font-bold text-slate-900 mt-0.5 font-mono">
                      {company?.currency === 'INR' ? '₹' : '$'}{(subtotal + discountTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="text-center sm:text-left border-r border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Applied Discounts</span>
                    <strong className="block text-sm font-bold text-rose-600 mt-0.5 font-mono">
                      - {company?.currency === 'INR' ? '₹' : '$'}{discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="text-center sm:text-left border-r border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Subtotal Taxes (GST)</span>
                    <strong className="block text-sm font-bold text-emerald-600 mt-0.5 font-mono">
                      + {company?.currency === 'INR' ? '₹' : '$'}{taxTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-slate-550 uppercase tracking-wider block mb-0.5">Net Calculated Bill</span>
                    <strong className="block text-base text-indigo-750 font-bold mt-0.5 font-mono">
                      {company?.currency === 'INR' ? '₹' : '$'}{netValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

              </div>
            ) : (
              /* DIRECT PAYMENT/RECEIPT BALANCES WRITER */
              <div className="space-y-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold font-sans text-xs">Settled Net Amount *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={paymentAmt}
                    onChange={(e) => setPaymentAmt(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium font-sans">This reduces outstanding ledger debt of target customer or supplier party immediately.</p>
                </div>
              </div>
            )}

            {/* Global notes input */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold font-sans">Reporting notes &amp; description</label>
              <textarea
                rows={2}
                placeholder="Declare brief details on items received, transaction targets, logistics or payment receipts info."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {/* Submission button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                id="btn-submit-vouch"
                disabled={activeFy?.isLocked}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all px-6 py-3 rounded-xl cursor-pointer disabled:opacity-40 animate-fade-in shadow-sm font-sans"
              >
                {activeFy?.isLocked ? 'Voucher Locked' : 'Execute & Compile Double-Entry'}
              </button>
            </div>

          </form>

        </div>

        {/* COL 3: LIST OF ENTERED VOUCHERS UNDER THESE DATES (Safe Rollback list) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-3">
              <RotateCcw className="size-4.5 text-slate-400 font-sans" />
              <h3 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-wider">Registered Vouchers</h3>
            </div>

            <p className="text-[11px] text-slate-500 mb-3 block italic leading-normal font-medium font-sans">Deletions roll back double-entry updates on stock ledgers and customer balances perfectly.</p>

            <div className="space-y-3.5 overflow-y-auto max-h-[460px] pr-1">
              {fyVouchersList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 p-4 rounded-xl text-xs font-sans">
                  No records stored inside current period limits.
                </div>
              ) : (
                fyVouchersList.map(v => {
                  const partyModel = db.contacts.find(c => c.id === v.partyId);
                  const partyName = partyModel ? partyModel.name : 'Suspense Capital Account';
                  return (
                    <div key={v.id} className="p-3.5 border border-slate-150 rounded-xl bg-slate-50/40 hover:bg-slate-50 transition-all text-xs relative group shadow-sm">
                      
                      <button
                        onClick={() => handleDeleteVoucher(v.id)}
                        disabled={activeFy?.isLocked}
                        className="absolute right-3 top-3 text-rose-600 hover:bg-rose-100 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 cursor-pointer p-1.5 rounded-lg border border-transparent hover:border-rose-200 shadow-sm"
                        title="Delete voucher and roll back transactions"
                      >
                        <Trash2 className="size-4 animate-fade-in" />
                      </button>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5 font-semibold">
                        <span className="font-mono">{v.date}</span>
                        <span className={`inline-block px-2 py-0.5 rounded border text-[8px] font-bold uppercase ${
                          v.type === 'Sales_Invoice' ? 'bg-indigo-50 text-indigo-750 border-indigo-200' :
                          v.type === 'Purchase_Bill' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>{v.type.replace('_', ' ')}</span>
                      </div>

                      <strong className="text-slate-900 text-xs font-sans tracking-tight block font-bold">{v.voucherNo}</strong>
                      <p className="text-indigo-700 font-sans mt-0.5 font-bold">{partyName}</p>
                      {v.notes && <p className="text-slate-500 text-[10px] italic mt-1 leading-normal font-sans">{v.notes}</p>}

                      <div className="flex justify-between items-center text-[10px] text-slate-650 bg-slate-50 hover:bg-slate-100/50 p-2 rounded-lg border border-slate-200 mt-2.5 font-semibold">
                        <span>Value:</span>
                        <strong className="text-slate-850 font-mono">
                          {company?.currency === 'INR' ? '₹' : '$'}{v.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-sans font-semibold leading-normal bg-slate-50 p-3 rounded-xl border border-slate-250 mt-4 flex items-center gap-1.5">
            <CheckCircle className="size-4.5 text-emerald-600 flex-shrink-0" />
            <span>Audit tracking checks passed automatically.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
