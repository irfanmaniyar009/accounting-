/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountingDB, Company, FinancialYear, Item, Contact, Voucher, StockLedgerEntry, AuditLog } from '../types';

const STORAGE_KEY = 'accounting_ledger_persistent_db_v1';

// Seed initial date helpers
const today = new Date();
const currentYearStr = today.getFullYear().toString();
const nextYearStr = (today.getFullYear() + 1).toString();
const prevYearStr = (today.getFullYear() - 1).toString();

const seedCompanies: Company[] = [
  {
    id: 'comp-apex',
    name: 'Apex Global Enterprises',
    gstin: '27AABCU1234F1Z8',
    address: 'Suite 405, Technopark Boulevard, Mumbai',
    currency: 'INR',
    createdAt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'comp-sterling',
    name: 'Sterling Creative Agency',
    gstin: '07AAACS5678Q2ZC',
    address: '88 Creative Lane, New Delhi',
    currency: 'USD',
    createdAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const seedFYs: FinancialYear[] = [
  {
    id: 'fy-apex-25-26',
    companyId: 'comp-apex',
    name: `FY 2025-26`,
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    isLocked: true,
  },
  {
    id: 'fy-apex-26-27',
    companyId: 'comp-apex',
    name: `FY 2026-27`,
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isLocked: false,
  },
  {
    id: 'fy-sterling-26-27',
    companyId: 'comp-sterling',
    name: `FY 2026-27`,
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isLocked: false,
  }
];

const seedItems: Item[] = [
  {
    sku: 'SKU-LAP-PRO',
    companyId: 'comp-apex',
    name: 'MacBook Pro 14 Inch M3',
    uom: 'Pcs',
    sellingPrice: 169000,
    purchasePrice: 145000,
    openingStock: 10,
    createdAt: '2026-04-02T10:00:00Z',
  },
  {
    sku: 'SKU-MON-4K',
    companyId: 'comp-apex',
    name: 'LG UltraFine 27 Inch 4K Display',
    uom: 'Pcs',
    sellingPrice: 42000,
    purchasePrice: 31000,
    openingStock: 15,
    createdAt: '2026-04-02T10:30:00Z',
  },
  {
    sku: 'SKU-KEY-MX',
    companyId: 'comp-apex',
    name: 'Logitech MX Keys Keyboard',
    uom: 'Pcs',
    sellingPrice: 12500,
    purchasePrice: 9500,
    openingStock: 30,
    createdAt: '2026-04-03T11:00:00Z',
  },
  {
    sku: 'SKU-CRE-DES',
    companyId: 'comp-sterling',
    name: 'Premium Design Subscription Guide',
    uom: 'Box',
    sellingPrice: 1500,
    purchasePrice: 800,
    openingStock: 50,
    createdAt: '2026-04-05T09:00:00Z',
  }
];

const seedContacts: Contact[] = [
  {
    id: 'con-cust-alpha',
    companyId: 'comp-apex',
    name: 'Alpha Systems Inc.',
    type: 'Customer',
    phone: '9876543210',
    email: 'billing@alphasystems.com',
    address: 'Industrial Area Phase 2, Pune',
    gstin: '27AABCA5555A1Z2',
    openingBalance: 45000, // Debit (Outstanding receivable from Customer)
    createdAt: '2026-04-01T09:00:00Z',
  },
  {
    id: 'con-cust-gamma',
    companyId: 'comp-apex',
    name: 'Gamma Tech Labs Ltd',
    type: 'Customer',
    phone: '9888123456',
    email: 'accounts@gammatech.io',
    address: 'Hitech Techpark, Hyderabad',
    gstin: '36AABCG9999K1ZB',
    openingBalance: 0,
    createdAt: '2026-04-01T09:30:00Z',
  },
  {
    id: 'con-supp-intel',
    companyId: 'comp-apex',
    name: 'Intellect Distribution Co.',
    type: 'Supplier',
    phone: '9111222333',
    email: 'sales@intellectdist.com',
    address: 'Electronics Wholesale Market, Mumbai',
    gstin: '27AABCI1111S1ZO',
    openingBalance: 85000, // Credit (Outstanding payable to Supplier)
    createdAt: '2026-04-01T10:00:00Z',
  }
];

const seedVouchers: Voucher[] = [
  {
    id: 'vouch-sales-1',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    type: 'Sales_Invoice',
    voucherNo: 'INV/2026-27/001',
    date: '2026-04-10',
    partyId: 'con-cust-alpha',
    items: [
      { itemSku: 'SKU-LAP-PRO', quantity: 2, rate: 169000, taxRate: 18, discountPercent: 5 },
      { itemSku: 'SKU-KEY-MX', quantity: 3, rate: 12500, taxRate: 18, discountPercent: 0 }
    ],
    amount: 423148, // (2*160550)*1.18 + (3*12500)*1.18 = 321100*1.18 + 37500*1.18 = 378898 + 44250 = 423148
    taxAmount: 64548,
    discountAmount: 16900,
    notes: 'Sold MacBook and keyboards for developers.',
    createdAt: '2026-04-10T14:30:00Z'
  },
  {
    id: 'vouch-purc-1',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    type: 'Purchase_Bill',
    voucherNo: 'BILL-4569',
    date: '2026-04-15',
    partyId: 'con-supp-intel',
    items: [
      { itemSku: 'SKU-MON-4K', quantity: 5, rate: 31000, taxRate: 18, discountPercent: 0 }
    ],
    amount: 182900, // 5 * 31000 = 155000 + 18% tax (27900) = 182900
    taxAmount: 27900,
    discountAmount: 0,
    notes: 'Inward supply of 4K display monitors.',
    createdAt: '2026-04-15T11:15:00Z'
  },
  {
    id: 'vouch-pay-1',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    type: 'Payment',
    voucherNo: 'PAY/001',
    date: '2026-04-20',
    partyId: 'con-supp-intel',
    amount: 50000,
    taxAmount: 0,
    discountAmount: 0,
    paidFromOrReceivedInto: 'Bank',
    notes: 'Partial payment against outstanding older balances.',
    createdAt: '2026-04-20T16:00:00Z'
  },
  {
    id: 'vouch-rec-1',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    type: 'Receipt',
    voucherNo: 'REC/001',
    date: '2026-04-25',
    partyId: 'con-cust-alpha',
    amount: 100000,
    taxAmount: 0,
    discountAmount: 0,
    paidFromOrReceivedInto: 'Bank',
    notes: 'Received advance amount from Alpha Systems.',
    createdAt: '2026-04-25T12:00:00Z'
  }
];

const seedStockLedger: StockLedgerEntry[] = [
  // Apex Enterprise initial values
  {
    id: 'st-apex-1',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    itemSku: 'SKU-LAP-PRO',
    date: '2026-04-10',
    type: 'Outward',
    quantity: 2,
    rate: 169000,
    voucherId: 'vouch-sales-1',
    notes: 'Sold via Invoice: INV/2026-27/001'
  },
  {
    id: 'st-apex-2',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    itemSku: 'SKU-KEY-MX',
    date: '2026-04-10',
    type: 'Outward',
    quantity: 3,
    rate: 12500,
    voucherId: 'vouch-sales-1',
    notes: 'Sold via Invoice: INV/2026-27/001'
  },
  {
    id: 'st-apex-3',
    companyId: 'comp-apex',
    fyId: 'fy-apex-26-27',
    itemSku: 'SKU-MON-4K',
    date: '2026-04-15',
    type: 'Inward',
    quantity: 5,
    rate: 31000,
    voucherId: 'vouch-purc-1',
    notes: 'Inward purchase bill BILL-4569'
  }
];

const seedLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-04-01T09:00:00Z',
    action: 'Database Initialized',
    details: 'Initial system database configuration and seed data loads successfully.',
    user: 'system',
    actionType: 'system',
    entityAffected: 'system'
  },
  {
    id: 'log-2',
    timestamp: '2026-04-10T14:30:00Z',
    action: 'Voucher Created',
    details: 'Sales Invoice INV/2026-27/001 created for customer Alpha Systems Inc.',
    companyId: 'comp-apex',
    user: 'irfanmaniyar009@gmail.com',
    actionType: 'create',
    entityAffected: 'voucher'
  },
  {
    id: 'log-3',
    timestamp: '2026-04-15T11:15:00Z',
    action: 'Voucher Created',
    details: 'Purchase Bill BILL-4569 from Intellect Distribution Co. entered.',
    companyId: 'comp-apex',
    user: 'irfanmaniyar009@gmail.com',
    actionType: 'create',
    entityAffected: 'voucher'
  }
];

export const initialDBState: AccountingDB = {
  companies: seedCompanies,
  financialYears: seedFYs,
  items: seedItems,
  stockLedger: seedStockLedger,
  contacts: seedContacts,
  vouchers: seedVouchers,
  auditLogs: seedLogs,
  activeCompanyId: 'comp-apex',
  activeFyId: 'fy-apex-26-27',
  negativeStockConfig: 'Warning',
  customUserEmail: 'irfanmaniyar009@gmail.com'
};

// Main operational utility class
export class LiveAccountingDatabase {
  private static loadState(): AccountingDB {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        // Basic schema checks
        if (parsed && Array.isArray(parsed.companies) && parsed.activeCompanyId) {
          // Backward compatibility check
          if (!parsed.negativeStockConfig) {
            parsed.negativeStockConfig = 'Warning';
          }
          if (!parsed.customUserEmail) {
            parsed.customUserEmail = 'irfanmaniyar009@gmail.com';
          }
          return parsed as AccountingDB;
        }
      }
    } catch (e) {
      console.error("Failed to load Accounting Database state from storage", e);
    }
    // Set first time
    LiveAccountingDatabase.saveState(initialDBState);
    return initialDBState;
  }

  private static saveState(state: AccountingDB) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to persist Accounting Database state to storage", e);
    }
  }

  // Pure functions for retrieval
  public static getDB(): AccountingDB {
    return this.loadState();
  }

  public static updateDB(updater: (db: AccountingDB) => void): AccountingDB {
    const db = this.loadState();
    updater(db);
    this.saveState(db);
    return db;
  }

  public static addLog(
    db: AccountingDB,
    action: string,
    details: string,
    companyId?: string,
    user?: string,
    actionType?: 'create' | 'update' | 'delete' | 'system',
    entityAffected?: 'voucher' | 'item' | 'contact' | 'company' | 'financial_year' | 'backup' | 'system'
  ) {
    const activeUser = user || db.customUserEmail || 'irfanmaniyar009@gmail.com';
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      companyId: companyId || db.activeCompanyId,
      user: activeUser,
      actionType: actionType || 'system',
      entityAffected: entityAffected || 'system'
    };
    db.auditLogs.unshift(newLog); // Prepend to show latest first
  }

  // Stock utility
  public static calculateStock(sku: string, companyId: string, itemsList: Item[], ledgerList: StockLedgerEntry[]): number {
    const item = itemsList.find(i => i.sku === sku && i.companyId === companyId);
    if (!item) return 0;
    
    const openingStock = item.openingStock;
    const inward = ledgerList
      .filter(l => l.itemSku === sku && l.companyId === companyId && l.type === 'Inward')
      .reduce((sum, entry) => sum + entry.quantity, 0);

    const outward = ledgerList
      .filter(l => l.itemSku === sku && l.companyId === companyId && l.type === 'Outward')
      .reduce((sum, entry) => sum + entry.quantity, 0);

    const adjustmentIn = ledgerList
      .filter(l => l.itemSku === sku && l.companyId === companyId && l.type === 'Adjustment' && l.quantity > 0)
      .reduce((sum, entry) => sum + entry.quantity, 0);

    const adjustmentOut = ledgerList
      .filter(l => l.itemSku === sku && l.companyId === companyId && l.type === 'Adjustment' && l.quantity < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.quantity), 0);

    return (openingStock + inward + adjustmentIn) - (outward + adjustmentOut);
  }

  // Calculate and aggregate Contact balance dynamically
  public static getContactBalance(contactId: string, db: AccountingDB): number {
    const contact = db.contacts.find(c => c.id === contactId);
    if (!contact) return 0;

    let balance = contact.openingBalance;

    // Filter vouchers of this company
    const relatedVouchers = db.vouchers.filter(v => v.partyId === contactId && v.companyId === contact.companyId);

    relatedVouchers.forEach(v => {
      // For Customer Contacts
      if (contact.type === 'Customer') {
        if (v.type === 'Sales_Invoice') {
          balance += v.amount; // Customer owes more
        } else if (v.type === 'Receipt') {
          balance -= v.amount; // Customer paid off
        }
      } 
      // For Supplier Contacts
      else {
        if (v.type === 'Purchase_Bill') {
          balance += v.amount; // We owe supplier more
        } else if (v.type === 'Payment') {
          balance -= v.amount; // We paid off supplier
        }
      }
    });

    return balance;
  }
}
