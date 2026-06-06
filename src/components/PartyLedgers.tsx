/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountingDB, Contact, ContactType } from '../types';
import { LiveAccountingDatabase } from '../utils/db';
import { Search, Plus, UserCheck, PhoneCall, Mail, MapPin } from 'lucide-react';

interface PartyLedgersProps {
  db: AccountingDB;
  onDbChange: (newDb: AccountingDB) => void;
  onNotification: (msg: string, type: 'success' | 'amber' | 'neutral') => void;
}

export default function PartyLedgers({ db, onDbChange, onNotification }: PartyLedgersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'Customer' | 'Supplier' | 'ALL'>('ALL');

  // New Contact form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [conName, setConName] = useState('');
  const [conType, setConType] = useState<ContactType>('Customer');
  const [conPhone, setConPhone] = useState('');
  const [conEmail, setConEmail] = useState('');
  const [conAddress, setConAddress] = useState('');
  const [conGstin, setConGstin] = useState('');
  const [conOpening, setConOpening] = useState<number>(0);

  const company = db.companies.find(c => c.id === db.activeCompanyId) || db.companies[0];
  const activeFy = db.financialYears.find(f => f.id === db.activeFyId) || db.financialYears[0];

  const formatCurrency = (val: number) => {
    const symbol = company?.currency === 'INR' ? '₹' : company?.currency === 'USD' ? '$' : '€';
    return `${symbol}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Safe Contact creation
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conName.trim()) {
      onNotification('Please fill all mandatory variables.', 'amber');
      return;
    }

    const newContactId = `con-${Date.now()}`;

    const newDb = LiveAccountingDatabase.updateDB((state) => {
      const contact: Contact = {
        id: newContactId,
        companyId: state.activeCompanyId,
        name: conName.trim(),
        type: conType,
        phone: conPhone.trim() || 'N/A',
        email: conEmail.trim() || 'N/A',
        address: conAddress.trim() || 'N/A',
        gstin: conGstin.trim().toUpperCase() || undefined,
        openingBalance: conOpening || 0,
        createdAt: new Date().toISOString()
      };

      state.contacts.push(contact);
      LiveAccountingDatabase.addLog(
        state, 
        'Contact Registered', 
        `Added party contact: ${conName} as a ${conType} with initial opening of ${conOpening}`,
        state.activeCompanyId,
        state.customUserEmail,
        'create',
        'contact'
      );
    });

    onDbChange(newDb);
    setShowCreateModal(false);

    // Reset fields
    setConName('');
    setConType('Customer');
    setConPhone('');
    setConEmail('');
    setConAddress('');
    setConGstin('');
    setConOpening(0);

    onNotification(`Contact account for ${conName} created!`, 'success');
  };

  // Filter contacts by Company
  const companyContacts = db.contacts.filter(c => c.companyId === db.activeCompanyId);

  const filteredContacts = companyContacts.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedTypeFilter === 'ALL' || c.type === selectedTypeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 flex items-center gap-2">
            <UserCheck className="text-indigo-600" />
            Contacts Directory &amp; Party Ledgers
          </h2>
          <p className="text-slate-500 text-xs font-medium">Manage Customers and Suppliers accounts. Track outstanding balances and outstanding statement updates dynamically.</p>
        </div>

        <button
          onClick={() => {
            if (activeFy?.isLocked) {
              onNotification("The current financial period is locked. Contact creation disabled.", "amber");
              return;
            }
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4.5 py-2.5 text-xs rounded-xl transition-all cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <Plus className="size-4" />
          <span>Register New Contact</span>
        </button>
      </div>

      {/* Main card panel containing Directory Filter and Listing */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm text-slate-800">
        
        {/* Dynamic Toolbar filters columns */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Contacts in real-time */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="size-4" />
            </span>
            <input
              type="text"
              placeholder="Search directory by contact name, phone digits, or email address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 text-xs text-slate-850 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-sans transition-all"
            />
          </div>

          {/* Type filters tabs */}
          <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl gap-1">
            {[
              { id: 'ALL', label: 'All Contacts' },
              { id: 'Customer', label: 'Customers' },
              { id: 'Supplier', label: 'Suppliers' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTypeFilter(tab.id as 'Customer' | 'Supplier' | 'ALL')}
                className={`px-4 py-1.5 text-[10px] font-sans tracking-wide font-bold rounded-lg transition-all cursor-pointer ${
                  selectedTypeFilter === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-indigo-650'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Directory Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContacts.length === 0 ? (
            <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-12 text-slate-400 border border-dashed border-slate-200 p-8 rounded-xl font-sans text-xs">
              No contacts matched your selected filters or search terms.
            </div>
          ) : (
            filteredContacts.map(contact => {
              const outstanding = LiveAccountingDatabase.getContactBalance(contact.id, db);
              return (
                <div key={contact.id} className="bg-slate-50/40 border border-slate-150 p-4.5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-indigo-300 hover:bg-slate-50/80 hover:shadow-sm transition-all focus-mode-card">
                  
                  {/* Card head layout */}
                  <div>
                    <div className="flex justify-between items-start mb-2.5">
                      <span className={`inline-block px-2 py-0.5 text-[8px] font-bold tracking-wider rounded border ${
                        contact.type === 'Customer' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {contact.type}
                      </span>
                      {contact.gstin && (
                        <span className="text-[9px] text-slate-500 font-mono tracking-wider text-right block font-semibold" title="Tax Registration ID">
                          GST: {contact.gstin}
                        </span>
                      )}
                    </div>

                    <h4 className="font-sans font-bold text-slate-950 text-sm tracking-tight leading-snug mb-3">{contact.name}</h4>

                    {/* Contact communication details lines */}
                    <div className="space-y-2 text-[11px] font-sans text-slate-500 font-medium">
                      <div className="flex items-center gap-2 hover:text-slate-800 transition-colors">
                        <PhoneCall className="size-3.5 text-slate-400 flex-shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 hover:text-slate-800 transition-colors">
                        <Mail className="size-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-[190px]">{contact.email}</span>
                      </div>
                      <div className="flex items-start gap-2 hover:text-slate-800 transition-colors">
                        <MapPin className="size-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">{contact.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic outstanding balance block */}
                  <div className="pt-3 border-t border-slate-200/85 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-450 uppercase font-sans font-bold tracking-wider block">Outstanding Due</span>
                      <strong id={`balance-${contact.id}`} className={`text-base font-sans tracking-tight font-bold font-mono ${
                        contact.type === 'Customer'
                          ? (outstanding > 0 ? 'text-indigo-700 font-bold' : 'text-slate-500')
                          : (outstanding > 0 ? 'text-rose-700 font-bold' : 'text-slate-500')
                      }`}>
                        {formatCurrency(outstanding)}
                      </strong>
                    </div>

                    <div className="text-right text-[10px] font-sans text-slate-450 italic font-medium">
                      {contact.type === 'Customer' 
                        ? (outstanding >= 0 ? '[Receivable]' : '[Advance Receipt]')
                        : (outstanding >= 0 ? '[Payable]' : '[Debit Settlement]')
                      }
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* CREATE CONTACT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-slate-800">
            <h3 className="font-sans font-bold text-lg text-slate-900 mb-1.5">Create Party Account</h3>
            <p className="text-slate-500 text-xs font-medium mb-4 leading-normal">Introduce custom clients or vendors into your firm ledger directory. Prepared with standard outstandings variables.</p>
            
            <form onSubmit={handleCreateContact} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-600 mb-1 font-semibold">Company / Party Full Name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Acme Tech Solutions"
                    value={conName} 
                    onChange={(e) => setConName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Contact Type *</label>
                  <select
                    value={conType}
                    onChange={(e) => setConType(e.target.value as ContactType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Tax ID / GSTIN</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 27AABCA..."
                    value={conGstin} 
                    onChange={(e) => setConGstin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +91 900..."
                    value={conPhone} 
                    onChange={(e) => setConPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="accounts@acme.com"
                    value={conEmail} 
                    onChange={(e) => setConEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Initial Opening Outstanding Balance</label>
                <input 
                  type="number" 
                  value={conOpening} 
                  onChange={(e) => setConOpening(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 font-bold focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block font-medium">Receivable amount for customers, payable amount to suppliers.</span>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Postal Address</label>
                <textarea 
                  rows={2}
                  placeholder="Street Block, City, Postcode"
                  value={conAddress} 
                  onChange={(e) => setConAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-all cursor-pointer shadow-sm animate-fade-in"
                >
                  Confirm Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
