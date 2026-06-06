/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountingDB, Item, Contact, Voucher } from '../types';
import { LiveAccountingDatabase } from '../utils/db';
import { Printer, Download, BookOpen, BarChart3, Archive, UserCheck, CalendarDays } from 'lucide-react';

interface ReportsProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
}

type ReportSubTab = 'Daybook' | 'Profit_Loss' | 'Stock_Summary' | 'Ledger_Statement';

export default function Reports({ db, onDbChange, onNotification }: ReportsProps) {
  const [subTab, setSubTab] = useState<ReportSubTab>('Daybook');

  // Specific ledger party selection
  const [selectedPartyId, setSelectedPartyId] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const company = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  const formatCurrency = (val: number) => {
    const symbol = company?.currency === 'INR' ? '₹' : company?.currency === 'USD' ? '$' : '€';
    return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const companyVouchers = db.vouchers.filter(v => v.companyId === db.activeCompanyId && v.fyId === db.activeFyId);
  const companyItems = db.items.filter(item => item.companyId === db.activeCompanyId);
  const companyContacts = db.contacts.filter(contact => contact.companyId === db.activeCompanyId);

  // Filter vouchers by date range if provided
  const getFilteredVouchers = (vouchersList: Voucher[]) => {
    return vouchersList.filter(v => {
      if (startDate && new Date(v.date) < new Date(startDate)) return false;
      if (endDate && new Date(v.date) > new Date(endDate)) return false;
      return true;
    });
  };

  const filteredVouchers = getFilteredVouchers(companyVouchers);

  // Executing print format helper
  const handlePrint = () => {
    window.print();
    onNotification("Preparing printable report statement layout...", "neutral");
  };

  // Safe Excel/CSV Download helper string compilation and execution
  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (subTab === 'Daybook') {
      csvContent += "Date,Voucher No,Type,Party Ledger Name,Net Value,Notes\n";
      filteredVouchers.forEach(v => {
        const party = companyContacts.find(c => c.id === v.partyId);
        const partyName = party ? party.name : 'Suspense direct';
        csvContent += `"${v.date}","${v.voucherNo}","${v.type}","${partyName}",${v.amount},"${v.notes || ''}"\n`;
      });
    } else if (subTab === 'Profit_Loss') {
      const salesVal = filteredVouchers.filter(v => v.type === 'Sales_Invoice').reduce((sum, v) => sum + v.amount, 0);
      const purchVal = filteredVouchers.filter(v => v.type === 'Purchase_Bill').reduce((sum, v) => sum + v.amount, 0);
      csvContent += `Profit & Loss Statement for ${company?.name} - ${activeFy?.name}\n`;
      csvContent += `Core Sales Revenues,${salesVal}\n`;
      csvContent += `Cost of Goods Sold (COGS),${purchVal}\n`;
      csvContent += `Gross Operating Margin,${salesVal - purchVal}\n`;
    } else if (subTab === 'Stock_Summary') {
      csvContent += "Item SKU,Item Description,Pack UOM,Purchase Price,Retail Price,Units in Store,Inventory Valuation\n";
      companyItems.forEach(item => {
        const stockLeft = LiveAccountingDatabase.calculateStock(item.sku, db.activeCompanyId, db.items, db.stockLedger);
        csvContent += `"${item.sku}","${item.name}","${item.uom}",${item.purchasePrice},${item.sellingPrice},${stockLeft},${stockLeft * item.purchasePrice}\n`;
      });
    } else if (subTab === 'Ledger_Statement') {
      const party = companyContacts.find(c => c.id === selectedPartyId);
      if (!party) {
        onNotification("Please select a target ledger to compile export files.", "amber");
        return;
      }
      csvContent += `Ledger Account Statement for ${party.name}\n`;
      csvContent += "Date,Voucher No,Voucher Type,Debit (Client Owes),Credit (Payments/Supplier We Owe),Running Bal\n";
      
      let running = party.openingBalance;
      csvContent += `Initial,Opening,Balance,${party.type === 'Customer' ? running : 0},${party.type === 'Supplier' ? running : 0},${running}\n`;

      const partyVouchers = companyVouchers.filter(v => v.partyId === selectedPartyId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      partyVouchers.forEach(v => {
        let dbValue = 0;
        let crValue = 0;
        if (party.type === 'Customer') {
          if (v.type === 'Sales_Invoice') {
            dbValue = v.amount;
            running += v.amount;
          } else if (v.type === 'Receipt') {
            crValue = v.amount;
            running -= v.amount;
          }
        } else {
          if (v.type === 'Purchase_Bill') {
            crValue = v.amount;
            running += v.amount;
          } else if (v.type === 'Payment') {
            dbValue = v.amount;
            running -= v.amount;
          }
        }
        csvContent += `"${v.date}","${v.voucherNo}","${v.type}",${dbValue},${crValue},${running}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${company?.name.replace(/ /g, '_')}_${subTab}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onNotification("Dynamic sheet generated and file download triggered!", "success");
  };

  return (
    <div className="space-y-6">
      
      {/* Visual top head bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" />
            Dynamic Reporting Engine
          </h2>
          <p className="text-slate-500 text-xs font-medium">Access tax compliance lists, stock valuation reports, general ledger balances, and corporate P&L Statements.</p>
        </div>

        {/* Global Toolbar and Export controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 text-xs rounded-xl font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
            title="Print report layout"
          >
            <Printer className="size-3.5" />
            <span>Print Report</span>
          </button>
          
          <button
            onClick={handleDownloadCSV}
            className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs rounded-xl font-bold transition-all cursor-pointer shadow-sm"
            title="Download report data as CSV file"
          >
            <Download className="size-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Primary reporting subtabs navigation */}
      <div className="grid grid-cols-2 md:flex bg-slate-50 border border-slate-200 p-1.5 rounded-2xl gap-1.5 shadow-sm text-slate-800">
        {[
          { id: 'Daybook', label: 'Company Daybook', icon: BookOpen },
          { id: 'Profit_Loss', label: 'Profit & Loss (P&L)', icon: BarChart3 },
          { id: 'Stock_Summary', label: 'Inventory Valuation', icon: Archive },
          { id: 'Ledger_Statement', label: 'Party Ledgers Report', icon: UserCheck }
        ].map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
               key={tab.id}
               id={`subtab-${tab.id}`}
               onClick={() => setSubTab(tab.id as ReportSubTab)}
               className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-sans font-bold tracking-tight transition-all cursor-pointer ${
                 subTab === tab.id 
                   ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                   : 'text-slate-500 hover:text-indigo-650 hover:bg-white/65'
               }`}
            >
              <IconComponent className="size-4 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-wrap items-center gap-3 text-xs font-sans text-slate-805 shadow-sm font-semibold">
        <div className="flex items-center gap-1.5 text-slate-500">
          <CalendarDays className="size-4.5 text-indigo-600" />
          <span>Report Dates Filter bounds:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="date"
            placeholder="Start"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 outline-none focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
          />
          <span className="text-slate-400 font-medium font-sans">to</span>
          <input
            type="date"
            placeholder="End"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 outline-none focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
          />
        </div>

        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-indigo-600 hover:underline font-sans ml-auto cursor-pointer font-bold text-[11px]"
          >
            Clear Date Bounds Filtering
          </button>
        )}
      </div>

      {/* REPORT CONTENT VIEW BOX AREA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm printable-section text-slate-800" id="printable-report-area">
        
        {/* Printable Letterhead */}
        <div className="border-b border-slate-200 pb-5 mb-5 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
          <div>
            <h3 className="font-sans font-bold text-slate-900 text-base leading-tight uppercase tracking-wider">{company?.name}</h3>
            <p className="text-[10px] font-sans text-slate-500 leading-normal max-w-[340px] mt-0.5 font-semibold">{company?.address}</p>
            {company?.gstin && <p className="text-[10px] font-sans text-emerald-700 font-bold mt-1">Tax Registration No: {company?.gstin}</p>}
          </div>

          <div className="text-center sm:text-right font-sans text-xs text-slate-500 font-semibold leading-relaxed">
            <span className="text-indigo-600 uppercase tracking-wider font-bold block mb-1">Financial Period Record</span>
            <p>Active Year Index: <strong className="text-slate-800">{activeFy?.name}</strong></p>
            <p className="text-[10px] text-slate-450 font-medium">Date Span: {activeFy?.startDate} to {activeFy?.endDate}</p>
          </div>
        </div>

        {/* 1. DAYBOOK VIEW PANEL */}
        {subTab === 'Daybook' && (() => {
          return (
            <div className="space-y-4">
              <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400 border-b border-slate-150 pb-2 mb-2">Chronological Daybook Feed</h4>
              
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-xs text-slate-850 text-left border-collapse font-sans">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Voucher Detail</th>
                      <th className="p-3">Voucher Type</th>
                      <th className="p-3">Party Ledger Name</th>
                      <th className="p-3 text-right">Settled Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-405 font-medium">No chronological daybook transactions logged in these dates criteria.</td>
                      </tr>
                    ) : (
                      filteredVouchers.map(v => {
                        const party = companyContacts.find(c => c.id === v.partyId);
                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-slate-500 font-mono">{v.date}</td>
                            <td className="p-3">
                              <span className="font-bold text-slate-900 block text-sm">{v.voucherNo}</span>
                              {v.notes && <span className="text-[10px] text-slate-500 leading-tight italic block mt-0.5">{v.notes}</span>}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded border text-[8px] font-bold uppercase ${
                                v.type === 'Sales_Invoice' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                v.type === 'Purchase_Bill' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-605 border-slate-200'
                              }`}>{v.type.replace('_', ' ')}</span>
                            </td>
                            <td className="p-3 text-slate-700 font-bold">{party ? party.name : 'Suspense direct'}</td>
                            <td className="p-3 text-right font-bold text-slate-900 font-mono">{formatCurrency(v.amount)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* 2. PROFIT & LOSS VIEW PANEL */}
        {subTab === 'Profit_Loss' && (() => {
          const salesVouchers = filteredVouchers.filter(v => v.type === 'Sales_Invoice');
          const purchaseVouchers = filteredVouchers.filter(v => v.type === 'Purchase_Bill');

          const salesRev = salesVouchers.reduce((sum, v) => sum + v.amount, 0);
          const rawCOGS = purchaseVouchers.reduce((sum, v) => sum + v.amount, 0);

          const totalGP = salesRev - rawCOGS;

          return (
            <div className="space-y-6">
              <div className="border-b border-slate-155 pb-2">
                <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400">Income &amp; Expenditures Statement</h4>
                <p className="text-[10px] text-slate-500 italic mt-0.5 font-medium">Calculated chronologically for active filtered ranges.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
                {/* 1. Revenues side */}
                <div className="space-y-3.5 border-r border-slate-200 pr-4">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Trading incomes</span>
                  <div className="flex justify-between border-b border-slate-100 pb-2.5 font-sans">
                    <span className="font-semibold text-slate-700">Core Credit Sales Invoices</span>
                    <span className="text-slate-900 font-bold font-mono text-sm">{formatCurrency(salesRev)}</span>
                  </div>
                  
                  {/* Ledger details list */}
                  <div className="pl-3 space-y-2 text-[11px] text-slate-500 font-semibold font-sans">
                    {salesVouchers.length === 0 ? (
                      <p className="italic font-medium">No invoices generated.</p>
                    ) : (
                      salesVouchers.map(v => (
                        <div key={v.id} className="flex justify-between font-mono font-medium">
                          <span className="font-sans text-slate-600">{v.voucherNo} ({v.date})</span>
                          <span className="text-slate-800">{formatCurrency(v.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Expenditure and Cost side */}
                <div className="space-y-3.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Cost outlay / expenditures</span>
                  <div className="flex justify-between border-b border-slate-100 pb-2.5">
                    <span className="font-semibold text-slate-700 font-sans">Direct Cost of Materials (Purchases)</span>
                    <span className="text-slate-900 font-bold font-mono text-sm">({formatCurrency(rawCOGS)})</span>
                  </div>

                  {/* Purchase details list */}
                  <div className="pl-3 space-y-2 text-[11px] text-slate-500 font-semibold font-sans">
                    {purchaseVouchers.length === 0 ? (
                      <p className="italic font-medium">No purchase bills entered.</p>
                    ) : (
                      purchaseVouchers.map(v => (
                        <div key={v.id} className="flex justify-between font-mono font-medium">
                          <span className="font-sans text-slate-600">{v.voucherNo} ({v.date})</span>
                          <span className="text-slate-800">{formatCurrency(v.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* GP Summary footers */}
              <div className="border-t border-slate-150 pt-5 mt-4 group">
                <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl flex items-center justify-between text-xs font-sans">
                  <div>
                    <span className="text-slate-500 font-bold uppercase block text-[9px] tracking-wider mb-0.5">Gross Margin Balance</span>
                    <strong id="final-profit-loss" className={`text-xl font-bold tracking-tight font-mono ${totalGP >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                      {formatCurrency(totalGP)}
                    </strong>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-xl text-[10px] border font-bold ${
                    totalGP >= 0 ? 'bg-indigo-50 text-indigo-750 border-indigo-200 shadow-sm' : 'bg-rose-50 text-rose-750 border-rose-200 shadow-sm'
                  }`}>
                    {totalGP >= 0 ? 'Surplus Operatings Balanced' : 'Direct Margin Outfall'}
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* 3. INVENTORY VALUATION PANEL */}
        {subTab === 'Stock_Summary' && (() => {
          let valuationTotal = 0;

          return (
            <div className="space-y-4">
              <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400 border-b border-slate-150 pb-2 mb-2">Inventory Stock Valuation Table</h4>
              
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-xs text-slate-850 text-left border-collapse font-sans">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">SKU Barcode</th>
                      <th className="p-3">Product Description</th>
                      <th className="p-3">Units UOM</th>
                      <th className="p-3 text-right">Inward Cost Price</th>
                      <th className="p-3 text-right">Total Units Left</th>
                      <th className="p-3 text-right">Asset Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companyItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-405 font-medium">No catalog products tracked in database.</td>
                      </tr>
                    ) : (
                      companyItems.map(item => {
                        const stockAmt = LiveAccountingDatabase.calculateStock(item.sku, db.activeCompanyId, db.items, db.stockLedger);
                        const assetVal = stockAmt * item.purchasePrice;
                        valuationTotal += assetVal;

                        return (
                          <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-indigo-700 font-bold font-mono">{item.sku}</td>
                            <td className="p-3 text-slate-900 font-bold">{item.name}</td>
                            <td className="p-3 text-slate-500 font-medium font-sans">{item.uom}</td>
                            <td className="p-3 text-right text-slate-700 font-mono">{formatCurrency(item.purchasePrice)}</td>
                            <td className="p-3 text-right text-slate-900 font-bold font-mono">{stockAmt} {item.uom}</td>
                            <td className="p-3 text-right font-bold text-slate-900 font-mono">{formatCurrency(assetVal)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Stock Asset card */}
              <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl flex items-center justify-between text-xs font-sans mt-4 font-semibold shadow-inner">
                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Net Catalog Asset Inventory Valuation</span>
                <strong className="text-base text-indigo-750 font-bold font-mono">{formatCurrency(valuationTotal)}</strong>
              </div>
            </div>
          );
        })()}

        {/* 4. PARTY LEDGER ACCOUNT STATEMENTS PANEL */}
        {subTab === 'Ledger_Statement' && (() => {
          const selectedParty = companyContacts.find(c => c.id === selectedPartyId);

          // Chronological ledgers data builder
          const getLedgerHistory = () => {
            if (!selectedParty) return { history: [], final: 0 };

            let runningSum = selectedParty.openingBalance;

            const vouchersList = companyVouchers
              .filter(v => v.partyId === selectedPartyId)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const historyRows = vouchersList.map(v => {
              let debitIn = 0;
              let creditOut = 0;

              if (selectedParty.type === 'Customer') {
                if (v.type === 'Sales_Invoice') {
                  debitIn = v.amount;
                  runningSum += v.amount;
                } else if (v.type === 'Receipt') {
                  creditOut = v.amount;
                  runningSum -= v.amount;
                }
              } else {
                if (v.type === 'Purchase_Bill') {
                  creditOut = v.amount;
                  runningSum += v.amount;
                } else if (v.type === 'Payment') {
                  debitIn = v.amount;
                  runningSum -= v.amount;
                }
              }

              return {
                date: v.date,
                vNo: v.voucherNo,
                type: v.type,
                notes: v.notes || 'No description write-on',
                debit: debitIn,
                credit: creditOut,
                balance: runningSum
              };
            });

            return { history: historyRows, final: runningSum };
          };

          const { history, final } = getLedgerHistory();

          return (
            <div className="space-y-4 font-sans">
              
              {/* Party selection tools */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3 text-xs text-slate-700 mb-4 no-print shadow-inner font-semibold">
                <span>Select Target Party Account Ledger:</span>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[220px]"
                >
                  <option value="">-- Choose Party Contact --</option>
                  {companyContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              {selectedParty ? (
                <div className="space-y-4">
                  {/* Account overview banner */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold leading-relaxed shadow-sm">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Party profile description</span>
                      <strong className="text-base text-slate-900 font-bold mb-0.5 block">{selectedParty.name}</strong>
                      <span className="text-[10px] text-slate-500 font-semibold font-mono">GST: {selectedParty.gstin || 'Unregistered Exempt'} | Phone: {selectedParty.phone}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Running Outstanding Balance</span>
                      <strong className="text-lg text-indigo-750 font-bold font-mono">{formatCurrency(final)}</strong>
                    </div>
                  </div>

                  {/* Statements ledger grid list */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table className="w-full text-xs text-slate-850 text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Voucher Ref ID</th>
                          <th className="p-3">Transaction Description notes</th>
                          <th className="p-3 text-right">Debit Balance (Dr)</th>
                          <th className="p-3 text-right">Credit Balance (Cr)</th>
                          <th className="p-3 text-right">Moving Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        
                        {/* Initial Opening Balance row */}
                        <tr className="bg-slate-50 font-bold">
                          <td className="p-3 text-slate-400 font-mono">-</td>
                          <td className="p-3 text-indigo-700 font-sans uppercase text-[10px]">Opening Balance</td>
                          <td className="p-3 text-slate-500 italic font-sans font-semibold">Carried forward initial ledger outstanding parameters.</td>
                          <td className="p-3 text-right font-mono">{selectedParty.type === 'Customer' ? formatCurrency(selectedParty.openingBalance) : '-'}</td>
                          <td className="p-3 text-right font-mono">{selectedParty.type === 'Supplier' ? formatCurrency(selectedParty.openingBalance) : '-'}</td>
                          <td className="p-3 text-right text-slate-900 font-mono">{formatCurrency(selectedParty.openingBalance)}</td>
                        </tr>

                        {history.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-405 font-medium italic font-sans">No transactional changes logged for this client contact in this selected active year period.</td>
                          </tr>
                        ) : (
                          history.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 text-slate-500 font-mono">{row.date}</td>
                              <td className="p-3">
                                <span className="font-bold text-slate-900 block text-sm font-sans">{row.vNo}</span>
                                <span className="text-[9px] text-slate-500 font-bold uppercase font-sans">{row.type.replace('_', ' ')}</span>
                              </td>
                              <td className="p-3 text-slate-650 font-sans font-medium">{row.notes}</td>
                              <td className="p-3 text-right text-slate-700 font-mono">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                              <td className="p-3 text-right text-slate-700 font-mono">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                              <td className="p-3 text-right font-bold text-slate-900 font-mono">{formatCurrency(row.balance)}</td>
                            </tr>
                          ))
                        )}

                      </tbody>
                    </table>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-slate-450 italic font-sans text-xs border border-dashed border-slate-200 p-8 rounded-xl font-medium">
                  Please select any party contact from selector to compile ledger account statement ledger logs.
                </div>
              )}

            </div>
          );
        })()}

      </div>

    </div>
  );
}
