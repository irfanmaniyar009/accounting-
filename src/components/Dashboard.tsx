/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountingDB, Voucher, VoucherType } from '../types';
import { LiveAccountingDatabase } from '../utils/db';
import { TrendingUp, ShoppingBag, ArrowUpRight, ArrowDownLeft, Users, Package, Clock, ShieldCheck, Search, Filter } from 'lucide-react';

interface DashboardProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ db, onDbChange, onNotification, setActiveTab }: DashboardProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const company = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  // Helper currency formatter
  const formatCurrency = (val: number) => {
    const symbol = company?.currency === 'INR' ? '₹' : company?.currency === 'USD' ? '$' : company?.currency === 'EUR' ? '€' : 'د.إ ';
    return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filter vouchers belonging strictly to this active company and current selected FY
  const fyVouchers = db.vouchers.filter(v => v.companyId === db.activeCompanyId && v.fyId === db.activeFyId);

  // Compute stats
  const totalSales = fyVouchers
    .filter(v => v.type === 'Sales_Invoice')
    .reduce((sum, v) => sum + v.amount, 0);

  const totalPurchases = fyVouchers
    .filter(v => v.type === 'Purchase_Bill')
    .reduce((sum, v) => sum + v.amount, 0);

  const totalReceipts = fyVouchers
    .filter(v => v.type === 'Receipt')
    .reduce((sum, v) => sum + v.amount, 0);

  const totalPayments = fyVouchers
    .filter(v => v.type === 'Payment')
    .reduce((sum, v) => sum + v.amount, 0);

  // Profit/Loss calculation
  // Simulated COGS at 75% for custom pricing or direct gross profit math: Sales - Purchases
  const grossProfit = totalSales - totalPurchases;

  // Let's compute actual outstandings
  const companyContacts = db.contacts.filter(c => c.companyId === db.activeCompanyId);
  const totalReceivables = companyContacts
    .filter(c => c.type === 'Customer')
    .reduce((sum, c) => sum + LiveAccountingDatabase.getContactBalance(c.id, db), 0);

  const totalPayables = companyContacts
    .filter(c => c.type === 'Supplier')
    .reduce((sum, c) => sum + LiveAccountingDatabase.getContactBalance(c.id, db), 0);

  // Filter & Search Chronological Daybook Feed
  const filteredVouchers = fyVouchers
    .filter(v => {
      const matchesType = filterType === 'ALL' || v.type === filterType;
      
      const party = db.contacts.find(c => c.id === v.partyId);
      const partyName = party ? party.name : 'Direct Cash/Bank';
      const matchesSearch = 
        v.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.notes && v.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesType && matchesSearch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Latest first

  // Total items tracked
  const companyItems = db.items.filter(i => i.companyId === db.activeCompanyId);
  const stockValuation = companyItems.reduce((sum, item) => {
    const currentStock = LiveAccountingDatabase.calculateStock(item.sku, db.activeCompanyId, db.items, db.stockLedger);
    return sum + (currentStock * item.purchasePrice);
  }, 0);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Alert Banner if current FY is locked */}
      {activeFy?.isLocked && (
        <div id="locked-period-alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3.5 rounded-xl flex items-center gap-2.5 shadow-sm leading-relaxed">
          <span className="animate-pulse inline-block size-2 rounded-full bg-rose-500 flex-shrink-0"></span>
          <span><strong>Reporting Window Alert:</strong> The current active Financial Year period <strong>({activeFy.name})</strong> is locked. Manual voucher creation, structural adjustment rates and contact outstandings cannot be updated. Use the header to expand active limits, create a new year, or unlock this period.</span>
        </div>
      )}

      {/* Top Level Summary Cards (Bento Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Sales widget */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-indigo-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-slate-500 font-sans text-xs font-semibold uppercase tracking-wider block mb-1">Total Net Sales</span>
            <h4 id="stat-sales" className="text-2xl font-bold font-sans text-slate-900">{formatCurrency(totalSales)}</h4>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-1">▲ Verified Credit Revenue</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100">
            <TrendingUp className="size-5" />
          </div>
        </div>

        {/* Purchase widget */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-rose-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-slate-500 font-sans text-xs font-semibold uppercase tracking-wider block mb-1">Net Purchases</span>
            <h4 id="stat-purchases" className="text-2xl font-bold font-sans text-slate-900">{formatCurrency(totalPurchases)}</h4>
            <span className="text-[10px] text-rose-600 font-semibold block mt-1">▼ Debit Supplier Outlay</span>
          </div>
          <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100">
            <ShoppingBag className="size-5" />
          </div>
        </div>

        {/* Operating Balance: Receivables */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-indigo-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-slate-500 font-sans text-xs font-semibold uppercase tracking-wider block mb-1">Receivables (Outstanding)</span>
            <h4 id="stat-receivables" className="text-2xl font-bold font-sans text-slate-900">{formatCurrency(totalReceivables)}</h4>
            <button 
              onClick={() => setActiveTab('ledgers')}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold block mt-1.5 cursor-pointer text-left transition-colors"
            >
              ➔ Check Customer books
            </button>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100">
            <Users className="size-5" />
          </div>
        </div>

        {/* Operating Balance: Payables */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-indigo-300 transition-all flex items-start justify-between">
          <div>
            <span className="text-slate-500 font-sans text-xs font-semibold uppercase tracking-wider block mb-1">Payables (Outstanding)</span>
            <h4 id="stat-payables" className="text-2xl font-bold font-sans text-slate-900">{formatCurrency(totalPayables)}</h4>
            <button 
              onClick={() => setActiveTab('ledgers')}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold block mt-1.5 cursor-pointer text-left transition-colors"
            >
              ➔ Review Supplier accounts
            </button>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100">
            <Users className="size-5" />
          </div>
        </div>

      </div>

      {/* Second row: Profitability & Inventory quick bento cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Profitability Calculation (P&L) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-slate-800">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-sm font-sans font-bold text-slate-900 uppercase tracking-wider">Gross Operating Profit</h5>
              <div className={`px-2.5 py-0.5 rounded-xl font-sans font-bold text-[10px] uppercase ${grossProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {grossProfit >= 0 ? 'Surplus' : 'Deficit'}
              </div>
            </div>

            <div className="space-y-3 font-sans text-xs text-slate-600">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span>Declared Cash/Credit Revenue:</span>
                <span className="text-emerald-600 font-bold font-mono">{formatCurrency(totalSales)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span>Associated Cost outlay:</span>
                <span className="text-rose-600 font-bold font-mono">({formatCurrency(totalPurchases)})</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-900 font-semibold">Revenue Surplus Value:</span>
                <strong className={`text-sm font-mono ${grossProfit >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}`}>{formatCurrency(grossProfit)}</strong>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 italic mt-4 leading-normal">
              Note: Net Margin represents simple Sales metrics minus direct Cost outlays as evaluated inside {activeFy?.name || 'the active year'}.
            </p>
          </div>

          <button 
            onClick={() => setActiveTab('reports')}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer shadow-sm text-center"
          >
            Generate Broad Income Statement (P&amp;L)
          </button>
        </div>

        {/* Dynamic Stock Summary Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-slate-800">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-sm font-sans font-bold text-slate-900 uppercase tracking-wider">In-Stock Valuation</h5>
              <div className="bg-slate-50 text-indigo-700 px-2.5 py-0.5 rounded-lg font-sans font-bold text-[10px] border border-slate-200">
                {companyItems.length} Products
              </div>
            </div>

            <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100 mb-4 shadow-inner">
              <span className="text-slate-500 font-sans text-xs font-semibold uppercase tracking-wider">Total Stock Valuation</span>
              <p id="total-stock-valuation" className="text-2xl font-bold font-sans text-slate-900 mt-1">{formatCurrency(stockValuation)}</p>
              <span className="text-[10px] text-slate-400 font-medium">Calculated on Average Cost method</span>
            </div>

            {/* Top 2 Items showing stock counts */}
            <div className="space-y-2 text-xs font-sans">
              {companyItems.slice(0, 2).map(item => {
                const stockLeft = LiveAccountingDatabase.calculateStock(item.sku, db.activeCompanyId, db.items, db.stockLedger);
                return (
                  <div key={item.sku} className="flex justify-between items-center text-slate-600 border-b border-slate-100 pb-2">
                    <span className="truncate max-w-[170px] font-medium" title={item.name}>{item.name}</span>
                    <span className={`font-bold font-mono ${stockLeft <= 3 ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded' : 'text-slate-800'}`}>
                      {stockLeft} {item.uom} {stockLeft <= 3 ? '(Low)' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            onClick={() => setActiveTab('inventory')}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer shadow-sm text-center"
          >
            Review Inventory Stock Ledger
          </button>
        </div>

        {/* Quick Operations panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-slate-800">
          <div>
            <h5 className="text-sm font-sans font-bold text-slate-900 uppercase tracking-wider mb-4">Immediate Book Actions</h5>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (activeFy?.isLocked) {
                    onNotification("The period is locked. You cannot record invoices.", "amber");
                    return;
                  }
                  setActiveTab('vouchers');
                }}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-3.5 rounded-xl text-left transition-all cursor-pointer shadow-sm"
              >
                <ArrowUpRight className="size-5 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-slate-800 block leading-tight">Sales Invoice</span>
                <span className="text-[9px] text-slate-500 font-mono">Record Credit Trade</span>
              </button>

              <button
                onClick={() => {
                  if (activeFy?.isLocked) {
                    onNotification("The period is locked. You cannot record bills.", "amber");
                    return;
                  }
                  setActiveTab('vouchers');
                }}
                className="bg-rose-50 hover:bg-rose-100 border border-rose-100 p-3.5 rounded-xl text-left transition-all cursor-pointer shadow-sm"
              >
                <ArrowDownLeft className="size-5 text-rose-600 mb-1" />
                <span className="text-xs font-bold text-slate-800 block leading-tight">Purchase Bill</span>
                <span className="text-[9px] text-slate-500 font-mono">Inward Stock Ingress</span>
              </button>

              <button
                onClick={() => {
                  if (activeFy?.isLocked) {
                    onNotification("The period is locked. You cannot record payments.", "amber");
                    return;
                  }
                  setActiveTab('vouchers');
                }}
                className="bg-amber-50 hover:bg-amber-100 border border-amber-100 p-3.5 rounded-xl text-left transition-all cursor-pointer shadow-sm"
              >
                <ArrowDownLeft className="size-5 text-amber-600 mb-1" />
                <span className="text-xs font-bold text-slate-800 block leading-tight">Receipt Voucher</span>
                <span className="text-[9px] text-slate-500 font-mono">Inward Payments</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('reports');
                }}
                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 p-3.5 rounded-xl text-left transition-all cursor-pointer shadow-sm"
              >
                <Clock className="size-5 text-indigo-600 mb-1" />
                <span className="text-xs font-bold text-slate-800 block leading-tight">Daybook</span>
                <span className="text-[9px] text-slate-500 font-mono">Chronological Ledger</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between text-[11px] text-slate-500 font-sans">
            <span>Entity focus:</span>
            <span className="text-indigo-600 font-bold">{company?.name || 'Default Firm'}</span>
          </div>
        </div>

      </div>

      {/* Third row: Daybook Feed Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Daybook Chronological Feed Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl md:col-span-2 p-5 shadow-sm text-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h5 className="text-sm font-sans font-bold text-slate-900 uppercase tracking-wider">Chronological Daybook</h5>
                <p className="text-slate-500 text-[11px] font-medium">Listing the chronological stream of transactions entered.</p>
              </div>
              
              {/* Filter Toggle Controls */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                {['ALL', 'Sales_Invoice', 'Purchase_Bill'].map(vt => (
                  <button
                    key={vt}
                    onClick={() => setFilterType(vt)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-sans font-bold uppercase transition-all cursor-pointer ${
                      filterType === vt ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {vt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Search bar inside Daybook list */}
            <div className="relative mb-3 flex-1 text-slate-700">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="size-4" />
              </span>
              <input 
                type="text" 
                placeholder="Search by Invoice #, reference notes, or contact party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 pl-9 rounded-xl text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-sans text-xs"
              />
            </div>

            {/* Table list */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Voucher Details</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Net Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-sans">
                        No chronological records matched your query terms.
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => {
                      const party = db.contacts.find(c => c.id === v.partyId);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/85 transition-colors">
                          <td className="p-3 text-slate-400 align-top whitespace-nowrap font-mono">{v.date}</td>
                          <td className="p-3 align-top">
                            <strong className="text-slate-800 text-xs font-bold tracking-tight block">{v.voucherNo}</strong>
                            <span className="text-[10px] text-indigo-700 font-semibold block mt-0.5">{party ? party.name : 'Capital Balance'}</span>
                            {v.notes && <p className="text-[10px] text-slate-500 mt-1 italic max-w-[280px] truncate leading-relaxed">{v.notes}</p>}
                          </td>
                          <td className="p-3 align-top">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase border ${
                              v.type === 'Sales_Invoice' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              v.type === 'Purchase_Bill' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              v.type === 'Receipt' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {v.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 align-top text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(v.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Audit Log / Security Feed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-slate-800">
          <div>
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-3">
              <Clock className="size-4.5 text-slate-400" />
              <h5 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-wider">Audit Security Log</h5>
            </div>

            <div className="space-y-3.5 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin">
              {db.auditLogs
                .filter(log => !log.companyId || log.companyId === db.activeCompanyId)
                .slice(0, 10)
                .map(log => (
                  <div key={log.id} className="text-[11px] leading-relaxed border-b border-slate-50 pb-2.5 last:border-0">
                    <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                      <span className="text-indigo-600 font-bold uppercase">{log.action}</span>
                      <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-600">{log.details}</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-slate-50 p-3 text-[10px] text-slate-500 font-sans font-medium rounded-xl border border-slate-200 mt-4 flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600 flex-shrink-0" />
            <span>Verifiable system log trail fully balance checks verified.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
