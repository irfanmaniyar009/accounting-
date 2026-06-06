/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Company {
  id: string;
  name: string;
  gstin: string; // Tax ID
  address: string;
  currency: string; // e.g. "USD", "INR", "EUR", "AED"
  createdAt: string;
}

export interface FinancialYear {
  id: string;
  companyId: string;
  name: string; // e.g. "2024-2025"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isLocked: boolean;
}

export type UOM = 'Pcs' | 'Kgs' | 'Ltr' | 'Box' | 'Mtr';

export interface Item {
  sku: string; // Primary SKU/Barcode ID
  companyId: string;
  name: string;
  uom: UOM;
  sellingPrice: number;
  purchasePrice: number;
  openingStock: number;
  createdAt: string;
}

export interface StockLedgerEntry {
  id: string;
  companyId: string;
  fyId: string;
  itemSku: string;
  date: string; // YYYY-MM-DD
  type: 'Inward' | 'Outward' | 'Adjustment';
  quantity: number; // always positive in storage
  rate: number;
  voucherId?: string; // If auto-triggered by voucher
  notes?: string;
}

export type ContactType = 'Customer' | 'Supplier';

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  type: ContactType;
  phone: string;
  email: string;
  address: string;
  gstin?: string;
  openingBalance: number; // positive = debit (receivable) for customer, credit (payable) for supplier
  createdAt: string;
}

export type VoucherType = 'Sales_Invoice' | 'Purchase_Bill' | 'Payment' | 'Receipt';

export interface VoucherItem {
  itemSku: string;
  quantity: number;
  rate: number;
  taxRate: number; // percentage (e.g. 18 for 18%)
  discountPercent: number; // percentage (e.g. 5 for 5%)
}

export interface Voucher {
  id: string;
  companyId: string;
  fyId: string;
  type: VoucherType;
  voucherNo: string; // User-input or auto-generated
  date: string; // YYYY-MM-DD
  partyId?: string; // Contact ID (Customer or Supplier)
  referenceNo?: string; // e.g. original bill no
  items?: VoucherItem[]; // Only for Sales_Invoice & Purchase_Bill
  amount: number; // Net amount (including taxes, discount)
  taxAmount: number; // Sub-total of tax
  discountAmount: number; // Sub-total of discount
  paidFromOrReceivedInto?: 'Bank' | 'Cash'; // For Payment / Receipt or immediate settlements
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  companyId?: string;
  user?: string;               // User who performed the action
  actionType?: 'create' | 'update' | 'delete' | 'system'; // Action type performed
  entityAffected?: 'voucher' | 'item' | 'contact' | 'company' | 'financial_year' | 'backup' | 'system'; // Entity affected
}

export interface AccountingDB {
  companies: Company[];
  financialYears: FinancialYear[];
  items: Item[];
  stockLedger: StockLedgerEntry[];
  contacts: Contact[];
  vouchers: Voucher[];
  auditLogs: AuditLog[];
  activeCompanyId: string;
  activeFyId: string;
  negativeStockConfig?: 'Block' | 'Warning'; // Managing dynamic negative stock logic ('Block' or 'Warning')
  customUserEmail?: string; // Configurable current session user
}
