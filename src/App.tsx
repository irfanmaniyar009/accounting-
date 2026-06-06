/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AccountingDB } from './types';
import { LiveAccountingDatabase } from './utils/db';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Vouchers from './components/Vouchers';
import PartyLedgers from './components/PartyLedgers';
import Reports from './components/Reports';
import SettingsPanel from './components/SettingsPanel';
import { Sparkles, Calendar, Receipt, FileSpreadsheet, ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';

interface Toast {
  msg: string;
  type: 'success' | 'amber' | 'neutral';
  id: number;
}

export default function App() {
  const [db, setDb] = useState<AccountingDB | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Load state on mount
  useEffect(() => {
    const freshDb = LiveAccountingDatabase.getDB();
    setDb(freshDb);
  }, []);

  const handleDbChange = (newDb: AccountingDB) => {
    setDb(newDb);
  };

  // Helper trigger for sleek notices
  const triggerNotification = (msg: string, type: 'success' | 'amber' | 'neutral') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { msg, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  if (!db) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 font-sans text-sm">
        <div className="space-y-3 text-center">
          <div className="animate-spin inline-block size-8 border-2 border-indigo-600 border-t-transparent rounded-full mb-1"></div>
          <p className="font-semibold text-slate-700">Mounting Ledgers & Accrual Registers...</p>
        </div>
      </div>
    );
  }

  const activeCompany = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between">
      
      {/* Visual Header */}
      <Header 
        db={db} 
        onDbChange={handleDbChange} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onNotification={triggerNotification} 
      />

      {/* Main dashboard body wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20 animate-fade-in focus-mode-body">
        
        {/* Render Tab Screens dynamically */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            db={db} 
            onDbChange={handleDbChange} 
            onNotification={triggerNotification} 
            setActiveTab={setActiveTab} 
          />
        )}

        {activeTab === 'inventory' && (
          <Inventory 
            db={db} 
            onDbChange={handleDbChange} 
            onNotification={triggerNotification} 
          />
        )}

        {activeTab === 'vouchers' && (
          <Vouchers 
            db={db} 
            onDbChange={handleDbChange} 
            onNotification={triggerNotification} 
          />
        )}

        {activeTab === 'ledgers' && (
          <PartyLedgers 
            db={db} 
            onDbChange={handleDbChange} 
            onNotification={triggerNotification} 
          />
        )}

        {activeTab === 'reports' && (
          <Reports 
            db={db} 
            onDbChange={handleDbChange} 
            onNotification={triggerNotification} 
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel 
            db={db} 
            onDbChange={handleDbChange} 
            onNotification={triggerNotification} 
          />
        )}

      </main>

      {/* Corporate professional footer */}
      <footer className="no-print bg-white border-t border-slate-200 text-center py-4 px-6 text-slate-500 text-[11px] font-sans mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 LedgerPrime Suite. All transaction balances mathematically balanced and verified.</p>
          <div className="flex items-center gap-3 text-slate-500">
            <span>Focus Active Firm: <strong className="text-indigo-600 font-semibold">{activeCompany?.name}</strong></span>
            <span>Period: <strong className="text-indigo-600 font-semibold">{activeFy?.name}</strong></span>
          </div>
        </div>
      </footer>

      {/* FLOATING TOASTS FLOATER NOTIFICATION CHANNELS */}
      <div id="toast-floater-container" className="fixed bottom-5 right-5 space-y-2 z-50 text-xs font-mono max-w-[290px] no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3.5 rounded-lg border shadow-md flex items-start gap-2 animate-slide-in ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              toast.type === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {toast.type === 'amber' && <AlertTriangle className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />}
            <p className="flex-1" dangerouslySetInnerHTML={{ __html: toast.msg }}></p>
          </div>
        ))}
      </div>

    </div>
  );
}
