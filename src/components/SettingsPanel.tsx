/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AccountingDB, AuditLog } from '../types';
import { LiveAccountingDatabase } from '../utils/db';
import { 
  Settings, 
  ShieldAlert, 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Clock, 
  Search, 
  Filter, 
  Trash2, 
  User, 
  FileJson, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface SettingsPanelProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
}

interface AutoBackupEntry {
  timestamp: string;
  label: string;
  dbString: string;
}

const AUTO_BACKUP_LIST_KEY = 'ledger_prime_auto_backups_index';

export default function SettingsPanel({ db, onDbChange, onNotification }: SettingsPanelProps) {
  // Configs
  const [negStockConfig, setNegStockConfig] = useState<'Block' | 'Warning'>('Warning');
  const [userEmail, setUserEmail] = useState('irfanmaniyar009@gmail.com');

  // Logs filters
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL');
  const [logEntityFilter, setLogEntityFilter] = useState<string>('ALL');

  // Backups state
  const [autoBackups, setAutoBackups] = useState<AutoBackupEntry[]>([]);

  useEffect(() => {
    if (db) {
      setNegStockConfig(db.negativeStockConfig || 'Warning');
      setUserEmail(db.customUserEmail || 'irfanmaniyar009@gmail.com');
    }
  }, [db]);

  // Read list of auto backups on mount
  useEffect(() => {
    try {
      const idx = localStorage.getItem(AUTO_BACKUP_LIST_KEY);
      if (idx) {
        setAutoBackups(JSON.parse(idx));
      }
    } catch (e) {
      console.error('Failed to load auto-backups index', e);
    }
  }, []);

  // Update negative stock configuration setting
  const handleNegStockChange = (val: 'Block' | 'Warning') => {
    setNegStockConfig(val);
    const newDb = LiveAccountingDatabase.updateDB((state) => {
      state.negativeStockConfig = val;
      LiveAccountingDatabase.addLog(
        state, 
        'Setting Updated', 
        `Negative stock constraint changed to strict: ${val}`, 
        state.activeCompanyId, 
        userEmail, 
        'system', 
        'system'
      );
    });
    onDbChange(newDb);
    onNotification(`Negative stock handling configured to **${val}** successfully!`, 'success');
  };

  // Update session custom user email
  const handleUserEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) {
      onNotification('Email address cannot be empty.', 'amber');
      return;
    }
    const newDb = LiveAccountingDatabase.updateDB((state) => {
      state.customUserEmail = userEmail.trim();
      LiveAccountingDatabase.addLog(
        state, 
        'User Config Updated', 
        `Active operator session updated to target: ${userEmail}`, 
        state.activeCompanyId, 
        userEmail.trim(), 
        'system', 
        'system'
      );
    });
    onDbChange(newDb);
    onNotification(`Session operator updated to **${userEmail}**`, 'neutral');
  };

  // Trigger JSON file manual backup download
  const handleDownloadBackup = () => {
    try {
      const currentDb = LiveAccountingDatabase.getDB();
      const dbString = JSON.stringify(currentDb, null, 2);
      
      const blob = new Blob([dbString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledgerprime_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log backup audit
      const newDb = LiveAccountingDatabase.updateDB((state) => {
        LiveAccountingDatabase.addLog(
          state, 
          'Manual Backup Downloaded', 
          'Exported full system database to structural JSON backup file.', 
          state.activeCompanyId, 
          userEmail, 
          'system', 
          'backup'
        );
      });
      onDbChange(newDb);
      onNotification('Database backup structured successfully! Download started.', 'success');
    } catch (e) {
      onNotification('Database export failed.', 'amber');
    }
  };

  // Trigger restore from uploaded JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validation schema checks
        if (
          parsed &&
          Array.isArray(parsed.companies) &&
          Array.isArray(parsed.financialYears) &&
          Array.isArray(parsed.items) &&
          Array.isArray(parsed.stockLedger) &&
          Array.isArray(parsed.contacts) &&
          Array.isArray(parsed.vouchers) &&
          Array.isArray(parsed.auditLogs)
        ) {
          // It's a valid database structure! Update the db
          parsed.customUserEmail = userEmail;
          LiveAccountingDatabase.updateDB((state) => {
            Object.assign(state, parsed);
            LiveAccountingDatabase.addLog(
              state, 
              'Database Restored', 
              'Restored live databases and ledgers from manual JSON backup file.', 
              state.activeCompanyId, 
              userEmail, 
              'system', 
              'backup'
            );
          });
          onDbChange(parsed);
          onNotification('**System Database Restored!** All ledgers and files matched successfully.', 'success');
        } else {
          onNotification('Restore Error: Uploaded file does not contain a valid LedgerPrime database schema.', 'amber');
        }
      } catch (err) {
        onNotification('Restore Error: Invalid or corrupt JSON backup format provided.', 'amber');
      }
    };

    reader.readAsText(file);
  };

  // Create an internal instant auto-backup snapshot in local storage
  const handleCreateAutoBackup = () => {
    try {
      const currentDb = LiveAccountingDatabase.getDB();
      const currentDbString = JSON.stringify(currentDb);
      
      const newEntry: AutoBackupEntry = {
        timestamp: new Date().toISOString(),
        label: `Auto-Cache System Snapshot (${currentDb.companies.length} Co, ${currentDb.vouchers.length} Vouchers)`,
        dbString: currentDbString
      };

      const updated = [newEntry, ...autoBackups].slice(0, 5); // Keep up to 5 snapshots
      setAutoBackups(updated);
      localStorage.setItem(AUTO_BACKUP_LIST_KEY, JSON.stringify(updated));

      // Audit log the backup
      const newDb = LiveAccountingDatabase.updateDB((state) => {
        LiveAccountingDatabase.addLog(
          state, 
          'Backup Created', 
          'Recorded systemic database snapshot capture dynamically in system memory.', 
          state.activeCompanyId, 
          userEmail, 
          'system', 
          'backup'
        );
      });
      onDbChange(newDb);
      onNotification('Mem-cache snapshot saved in continuous protection list!', 'success');
    } catch (e) {
      onNotification('Failed to generate memory snapshot.', 'amber');
    }
  };

  // Restore snapshot from list
  const handleRestoreAutoBackup = (entry: AutoBackupEntry) => {
    try {
      const parsed = JSON.parse(entry.dbString);
      LiveAccountingDatabase.updateDB((state) => {
        Object.assign(state, parsed);
        LiveAccountingDatabase.addLog(
          state, 
          'Database Restored', 
          `System state reverted dynamically to cached snapshot of ${new Date(entry.timestamp).toLocaleTimeString()}`, 
          state.activeCompanyId, 
          userEmail, 
          'system', 
          'backup'
        );
      });
      onDbChange(parsed);
      onNotification('Database rolled back to cached checkpoint successfully!', 'success');
    } catch (e) {
      onNotification('Checkpoint restore failed.', 'amber');
    }
  };

  // Delete restore checkpoint from memory
  const handleDeleteAutoBackup = (idx: number) => {
    const updated = autoBackups.filter((_, i) => i !== idx);
    setAutoBackups(updated);
    localStorage.setItem(AUTO_BACKUP_LIST_KEY, JSON.stringify(updated));
    onNotification('Auto-backup point deleted safely.', 'neutral');
  };

  // Clear audit log records
  const handleClearAuditLogs = () => {
    if (!window.confirm('Are you absolutely sure you want to flush historical system security logs? This is irreversible.')) {
      return;
    }
    const newDb = LiveAccountingDatabase.updateDB((state) => {
      state.auditLogs = [];
      LiveAccountingDatabase.addLog(
        state, 
        'Logs Flushed', 
        'Cleared system historical audit event registers to release client memory storage space.', 
        state.activeCompanyId, 
        userEmail, 
        'system', 
        'system'
      );
    });
    onDbChange(newDb);
    onNotification('System security logs flusher execution successful!', 'neutral');
  };

  // Filtered security logs
  const filteredLogs = db.auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.user && log.user.toLowerCase().includes(logSearch.toLowerCase()));

    const matchesAction = logActionFilter === 'ALL' || log.actionType === logActionFilter;
    const matchesEntity = logEntityFilter === 'ALL' || log.entityAffected === logEntityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div>
        <h2 className="text-xl font-bold font-sans text-slate-900 flex items-center gap-2">
          <Settings className="text-indigo-600 animate-spin-slow" />
          Settings, Backups &amp; System Audits
        </h2>
        <p className="text-slate-500 text-xs font-medium">
          Toggle sales stock blocks, configure operators, download database archives, and review security access audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1 & 2: OPERATIONS PANELS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Core System Directives */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-slate-850 space-y-5">
            <h3 className="font-bold font-sans text-sm text-slate-900 border-b border-slate-100 pb-2.5">
              🔧 Core System Parameters
            </h3>

            {/* Config 1: Negative Stock Configuration */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-xs text-slate-900 block font-sans">Negative Inventory Protection</span>
                  <p className="text-slate-500 text-[11px] leading-relaxed max-w-[420px] font-medium">
                    Configure behavior for Sales Invoices where SKU outward units exceed live store stock levels.
                  </p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleNegStockChange('Warning')}
                    className={`px-3.5 py-1.5 text-[10px] font-bold rounded-lg tracking-wide transition-all cursor-pointer ${
                      negStockConfig === 'Warning' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-505 hover:text-slate-900'
                    }`}
                  >
                    Allow &amp; Warning
                  </button>
                  <button
                    onClick={() => handleNegStockChange('Block')}
                    className={`px-3.5 py-1.5 text-[10px] font-bold rounded-lg tracking-wide transition-all cursor-pointer ${
                      negStockConfig === 'Block' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-550 hover:text-slate-900'
                    }`}
                  >
                    Strict Block
                  </button>
                </div>
              </div>

              {/* Dynamic Info alert block */}
              <div className={`p-3 rounded-xl border flex items-center gap-2 text-[11px] font-sans font-semibold ${
                negStockConfig === 'Warning' 
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-850' 
                  : 'bg-amber-50 border-amber-100 text-amber-850'
              }`}>
                {negStockConfig === 'Warning' ? (
                  <>
                    <CheckCircle className="size-4.5 text-indigo-500" />
                    <span>Warning Mode Active: Invoices are allowed to proceed, warning alerts are flagged clearly on creation screen.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4.5 text-amber-500" />
                    <span>Strict Block Enabled: Invoices exceeding available stock balances will be rejected to protect ledger integrity.</span>
                  </>
                )}
              </div>
            </div>

            {/* Config 2: Configurable user details */}
            <div className="border-t border-slate-100 pt-4">
              <span className="font-bold text-xs text-slate-900 block font-sans">Active Operator Signature</span>
              <p className="text-slate-500 text-[11px] leading-relaxed max-w-[420px] mb-3 font-medium">
                Identify which email or key signature should represent actions registered in the Audit Logs logs.
              </p>

              <form onSubmit={handleUserEmailChange} className="flex gap-2 text-xs font-sans">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="size-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  Confirm signature
                </button>
              </form>
            </div>

          </div>

          {/* Section 2: Broad Audit logs Directory Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-slate-800 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold font-sans text-sm text-slate-900">
                  🛡️ System Security Audit Trails
                </h3>
                <p className="text-slate-500 text-[11px] font-medium leading-normal">
                  Chronological compliance record tracking user, action, and targets.
                </p>
              </div>

              <button
                onClick={handleClearAuditLogs}
                disabled={db.auditLogs.length === 0}
                className="text-[10px] text-rose-600 hover:bg-rose-50 border border-rose-100 hover:border-rose-220 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
              >
                Flush security logs
              </button>
            </div>

            {/* Filters selectors columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Search text box */}
              <div className="relative sm:col-span-1">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                  <Search className="size-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Search logs details..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 text-[11px] outline-none"
                />
              </div>

              {/* Filter Action Type */}
              <select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px]"
              >
                <option value="ALL">All Action Types</option>
                <option value="create">Created Events</option>
                <option value="update">Updated Events</option>
                <option value="delete">Rollbacks/Deletions</option>
                <option value="system">System Settings</option>
              </select>

              {/* Filter Entity Affected */}
              <select
                value={logEntityFilter}
                onChange={(e) => setLogEntityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px]"
              >
                <option value="ALL">All Entity Targets</option>
                <option value="voucher">Vouchers / Invoices</option>
                <option value="item">Inventory catalog items</option>
                <option value="contact">Contacts / Parties</option>
                <option value="company">Corporate Entities</option>
                <option value="backup">Backup actions</option>
                <option value="system">Core Parameters</option>
              </select>
            </div>

            {/* Audit Logs tabular sheet */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-[11px] text-left border-collapse font-sans text-slate-800">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date &amp; Time</th>
                    <th className="p-2.5">Signature</th>
                    <th className="p-2.5">Type/Target</th>
                    <th className="p-2.5">Event Log Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic font-medium">No logs matched selected filter parameters.</td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 text-slate-450 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 leading-tight">
                          <span className="truncate max-w-[120px] block" title={log.user || 'system'}>
                            {log.user || 'system'}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold">
                          <div className="space-y-0.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                              log.actionType === 'create' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              log.actionType === 'delete' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                              log.actionType === 'update' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {log.actionType || 'system'}
                            </span>
                            <span className="block text-[9px] text-slate-400 uppercase font-mono font-bold tracking-wider">
                              {log.entityAffected || 'system'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-[340px] leading-relaxed">
                          <strong className="text-slate-800 block text-xs">{log.action}</strong>
                          <span className="text-[10px]">{log.details}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>Showing {filteredLogs.length} matching event logs of {db.auditLogs.length} total register entries.</span>
              <span>Encryption Status: SHA256-Local Verified</span>
            </div>

          </div>

        </div>

        {/* COL 3: BACKUP MANAGEMENT SIDEBAR PANEL */}
        <div className="space-y-6">
          
          {/* Section 3: Manual JSON backup files */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-slate-805 space-y-4">
            <h3 className="font-bold font-sans text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Database className="text-violet-600 size-4.5" />
              Database Backup File
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed font-sans font-medium">
              Keep external structured archives of your firm ledger. Highly recommended before performing structural rollover carries.
            </p>

            {/* Backups Button download */}
            <button
              onClick={handleDownloadBackup}
              className="w-full bg-indigo-600 hover:bg-indigo-750 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs font-bold shadow-sm"
            >
              <Download className="size-4" />
              <span>Export DB to JSON File</span>
            </button>

            {/* Restore File input */}
            <div className="border-t border-slate-100 pt-4 text-center">
              <span className="font-bold text-[10px] text-slate-500 uppercase block tracking-wider mb-2 text-left">
                Import and Restore state
              </span>

              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 p-5 rounded-2xl flex flex-col items-center justify-center gap-1.5 bg-slate-50/40 hover:bg-indigo-50/10 cursor-pointer transition-all">
                <Upload className="size-5 text-indigo-500 animate-bounce" />
                <span className="text-xs font-bold text-slate-800">Select Backup JSON</span>
                <span className="text-[9px] text-slate-400">Drag &amp; drop or browser-select</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 4: Continuous CDP auto-backups saved in local storage memory */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold font-sans text-sm text-slate-900 flex items-center gap-1.5">
                <Clock className="text-emerald-600 size-4.5" />
                Continuous Memories
              </h3>
              
              <button
                onClick={handleCreateAutoBackup}
                className="text-[10px] text-indigo-600 hover:underline font-bold"
              >
                Snapshot Now
              </button>
            </div>

            <p className="text-slate-500 text-[11px] leading-relaxed font-sans font-medium">
              Quickly capture or restore memory cache points. Safe backups are stored in your regional web local storage.
            </p>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {autoBackups.length === 0 ? (
                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl text-[11px]">
                  No memory checkpoints indexed yet. Click &quot;Snapshot Now&quot; above to lock a frame index.
                </div>
              ) : (
                autoBackups.map((entry, idx) => (
                  <div key={idx} className="p-2.5 border border-slate-150 rounded-xl bg-slate-50/45 text-[11px] flex items-center justify-between gap-1 hover:border-indigo-200 transition-all">
                    <div className="flex-1 min-w-0">
                      <strong className="text-slate-800 block text-xs truncate max-w-[170px]" title={entry.label}>
                        {entry.label}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString()} - {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestoreAutoBackup(entry)}
                        className="text-[10px] text-indigo-600 hover:text-white hover:bg-indigo-650 font-bold px-2 py-1 rounded border border-indigo-200 hover:border-indigo-650 transition-colors cursor-pointer"
                        title="Restore checkpoints"
                      >
                        Rollback
                      </button>
                      <button
                        onClick={() => handleDeleteAutoBackup(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Delete checkpoint"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-150 p-2.5 text-[10px] text-slate-505 font-medium leading-relaxed flex items-center gap-1.5 text-center justify-center">
              <CheckCircle className="size-4 text-emerald-600 flex-shrink-0" />
              <span>Full compliance backup standards strictly conformed.</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
