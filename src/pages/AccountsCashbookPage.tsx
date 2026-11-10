import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  BookOpen, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Calendar, 
  FileSpreadsheet, 
  Filter,
  Printer,
  CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CashTransaction } from '../types';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';
import { AuthoritySignatureBlock } from '../components/AuthoritySignatureBlock';

export const AccountsCashbookPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Add Transaction Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState<string>(isBn ? 'সাধারণ দান-অনুদান' : 'General Donation');
  const [amount, setAmount] = useState<number>(1000);
  const [date, setDate] = useState<string>(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'bkash'>('cash');
  const [partyName, setPartyName] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Selected Voucher for Printing
  const [selectedVoucher, setSelectedVoucher] = useState<CashTransaction | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'cash_transactions'));
      const list: CashTransaction[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CashTransaction));
      list.sort((a, b) => (b.date > a.date ? 1 : (b.createdAt > a.createdAt ? 1 : -1)));
      setTransactions(list);
    } catch (err) {
      console.warn("Could not load cashbook transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const voucherNo = `${txType === 'income' ? 'INC' : 'EXP'}-${Date.now().toString().slice(-6)}`;
      const entry: Omit<CashTransaction, 'id'> = {
        voucherNo,
        type: txType,
        category,
        amount: Number(amount),
        date,
        paymentMethod,
        partyName: partyName.trim() || undefined,
        description: description.trim(),
        recordedBy: currentUser?.displayName || 'Cashier',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'cash_transactions'), entry);

      await logAudit({
        action: `Cash Transaction Added (${txType})`,
        module: 'Accounts & Cashbook',
        recordId: docRef.id,
        recordType: 'CashTransaction',
        performedBy: currentUser?.displayName || 'User',
        performedByRole: role || 'accountant',
        performedByUid: currentUser?.uid,
        newValue: entry,
        details: `ক্যাশ ভাউচার তৈরি: ${voucherNo}, ধরন: ${txType}, খাত: ${category}, টাকা: ৳${amount}`
      });

      setShowAddModal(false);
      setPartyName('');
      setDescription('');
      setSelectedVoucher({ id: docRef.id, ...entry });
      await loadTransactions();
    } catch (err: any) {
      alert((isBn ? 'লেনদেন সংরক্ষণে সমস্যা: ' : 'Failed to record transaction: ') + err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = filtered.map((tx, idx) => ({
      'SL': idx + 1,
      'ভাউচার নং': tx.voucherNo,
      'তারিখ': tx.date,
      'ধরন': tx.type === 'income' ? 'জমা (Income)' : 'খরচ (Expense)',
      'খাত / ক্যাটাগরি': tx.category,
      'টাকার পরিমাণ (৳)': tx.amount,
      'মাধ্যম': tx.paymentMethod,
      'গ্রহীতা / দাতা': tx.partyName || '-',
      'বিবরণ': tx.description,
      'এন্ট্রি কারী': tx.recordedBy
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cashbook');
    XLSX.writeFile(workbook, `JMNIM_Cashbook_${getTodayDateString()}.xlsx`);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const filtered = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchVoucher = tx.voucherNo?.toLowerCase().includes(q);
      const matchCat = tx.category?.toLowerCase().includes(q);
      const matchParty = tx.partyName?.toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      if (!matchVoucher && !matchCat && !matchParty && !matchDesc) return false;
    }
    return true;
  });

  const incomeCategories = [
    isBn ? 'সাধারণ দান-অনুদান' : 'General Donation',
    isBn ? 'শিক্ষার্থী বেতন' : 'Student Tuition',
    isBn ? 'নতুন ভর্তি ফি' : 'Admission Fee',
    isBn ? 'লিল্লাহ ও যাকাত ফান্ড' : 'Lillah & Zakat Fund',
    isBn ? 'ভবন নির্মাণ অনুদান' : 'Building Construction Fund',
    isBn ? 'অন্যান্য আয়' : 'Other Income'
  ];

  const expenseCategories = [
    isBn ? 'শিক্ষক ও স্টাফ বেতন' : 'Teacher & Staff Salary',
    isBn ? 'বিদ্যুৎ ও ইউটিলিটি বিল' : 'Electricity & Utility Bills',
    isBn ? 'খাবার ও মেস খরচ' : 'Food & Boarding Expense',
    isBn ? 'ভবন সংস্কার ও মেরামত' : 'Maintenance & Repairs',
    isBn ? 'আপ্যায়ন ও মেহমানদারি' : 'Hospitality & Refreshments',
    isBn ? 'দাওয়াতি ও মাহফিল খরচ' : 'Mahfil & Islamic Events',
    isBn ? 'অন্যান্য খরচ' : 'Other Expense'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'হিসাব ও ডিজিটাল ক্যাশ বহি (Cashbook)' : 'Accounts & Digital Cashbook'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'মাদরাসার দৈনন্দিন যাবতীয় আয়-ব্যয়, খাতওয়ারি রসিদ ও রিয়েলটাইম ক্যাশ ব্যালেন্স ট্র্যাকিং' 
              : 'Complete real-time accounting, income & expense ledger, and cash balance'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setTxType('income');
              setCategory(incomeCategories[0]);
              setShowAddModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{isBn ? 'জমা এন্ট্রি (Income)' : 'Add Income'}</span>
          </button>

          <button
            onClick={() => {
              setTxType('expense');
              setCategory(expenseCategories[0]);
              setShowAddModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{isBn ? 'খরচ এন্ট্রি (Expense)' : 'Add Expense'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isBn ? 'এক্সেল' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 block">{isBn ? 'মোট আদায় / জমা (Total Income)' : 'Total Income'}</span>
            <span className="text-xl font-bold text-emerald-900">{formatBDT(totalIncome, isBn)}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-700 block">{isBn ? 'মোট ব্যয় / খরচ (Total Expense)' : 'Total Expense'}</span>
            <span className="text-xl font-bold text-red-900">{formatBDT(totalExpense, isBn)}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-700 block">{isBn ? 'বর্তমান ক্যাশ ব্যালেন্স (Net Balance)' : 'Current Cash Balance'}</span>
            <span className={`text-xl font-bold ${netBalance >= 0 ? 'text-blue-900' : 'text-red-700'}`}>
              {formatBDT(netBalance, isBn)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            ৳
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'ভাউচার, খাত বা বিবরণ দিয়ে খুঁজুন...' : 'Search by voucher, category or desc...'}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">{isBn ? 'সকল লেনদেন (জমা ও খরচ)' : 'All Transactions'}</option>
            <option value="income">{isBn ? 'শুধুমাত্র জমা (Income)' : 'Only Income'}</option>
            <option value="expense">{isBn ? 'শুধুমাত্র খরচ (Expense)' : 'Only Expense'}</option>
          </select>
        </div>

        <div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">{isBn ? 'সকল খাত (All Categories)' : 'All Categories'}</option>
            {[...incomeCategories, ...expenseCategories].map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{isBn ? 'ভাউচার ও তারিখ' : 'Voucher & Date'}</th>
                <th className="py-3 px-3">{isBn ? 'খাত ও ধরন' : 'Category & Type'}</th>
                <th className="py-3 px-3">{isBn ? 'দাতা / গ্রহীতা ও বিবরণ' : 'Party & Description'}</th>
                <th className="py-3 px-3">{isBn ? 'মাধ্যম' : 'Method'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'পরিমাণ (৳)' : 'Amount'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'পদক্ষেপ' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {isBn ? 'লোড হচ্ছে...' : 'Loading...'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {isBn ? 'কোনো লেনদেন রেকর্ড পাওয়া যায়নি।' : 'No cashbook entries found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-mono font-bold text-slate-900">{tx.voucherNo}</p>
                      <p className="text-[11px] text-slate-400">{tx.date}</p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.type === 'income' ? (isBn ? 'জমা' : 'Income') : (isBn ? 'খরচ' : 'Expense')}
                        </span>
                        <span className="font-medium text-slate-800">{tx.category}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{tx.partyName || '-'}</p>
                      <p className="text-[11px] text-slate-500">{tx.description}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="capitalize text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-bold text-sm ${
                        tx.type === 'income' ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'}{formatBDT(tx.amount, isBn)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedVoucher(tx)}
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="ভাউচার দেখুন / প্রিন্ট"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>{txType === 'income' ? (isBn ? 'নতুন জমা এন্ট্রি (Income Voucher)' : 'Record Income') : (isBn ? 'নতুন খরচ এন্ট্রি (Expense Voucher)' : 'Record Expense')}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'খাত / ক্যাটাগরি' : 'Category'}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    {(txType === 'income' ? incomeCategories : expenseCategories).map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'টাকার পরিমাণ (৳)' : 'Amount'}</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'তারিখ' : 'Date'}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'পরিশোধের মাধ্যম' : 'Payment Method'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
                    <option value="bkash">বিকাশ (bKash)</option>
                    <option value="bank">ব্যাংক (Bank)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {txType === 'income' ? (isBn ? 'দাতার নাম (Payer Name)' : 'Donor / Payer Name') : (isBn ? 'গ্রহীতার নাম (Payee Name)' : 'Receiver / Payee Name')}
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder={isBn ? 'ব্যক্তি বা প্রতিষ্ঠানের নাম...' : 'Name...'}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{isBn ? 'বিস্তারিত বিবরণ' : 'Description'}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder={isBn ? 'লেনদেনের বিস্তারিত উদ্দেশ্য...' : 'Purpose of transaction...'}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-lg text-xs font-bold shadow-md transition ${
                    txType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isBn ? 'ভাউচার সংরক্ষণ করুন' : 'Save Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Voucher Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'ক্যাশ ভাউচার' : 'Cash Voucher'}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button onClick={() => setSelectedVoucher(null)} className="px-2 text-slate-400">✕</button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border rounded-xl space-y-3 text-xs print:bg-white print:border-none print:p-0">
              <div className="text-center border-b pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn ? settings.institutionName : settings.institutionNameEn}
                </h2>
                <p className="text-[11px] text-slate-500">{settings.address} • ফোন: {settings.phone}</p>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded font-bold text-[10px] ${
                  selectedVoucher.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedVoucher.type === 'income' ? (isBn ? 'জমা ভাউচার (Debit Voucher)' : 'Credit Voucher') : (isBn ? 'খরচ ভাউচার (Expense Voucher)' : 'Debit Voucher')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">ভাউচার নং:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedVoucher.voucherNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">তারিখ:</span>
                  <span className="font-medium text-slate-900">{selectedVoucher.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">খাত:</span>
                  <span className="font-bold text-blue-700">{selectedVoucher.category}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">মাধ্যম:</span>
                  <span className="font-medium text-slate-900 capitalize">{selectedVoucher.paymentMethod}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">দাতা / গ্রহীতা:</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.partyName || '-'}</span>
                </div>
                <div className="py-1 border-b text-slate-600">
                  <span className="block text-slate-500">বিবরণ:</span>
                  <span className="font-medium text-slate-900">{selectedVoucher.description}</span>
                </div>
                <div className="flex justify-between py-1 bg-slate-50 px-2 rounded">
                  <span className="font-bold text-slate-800">মোট টাকা:</span>
                  <span className="font-black text-slate-900 text-sm">{formatBDT(selectedVoucher.amount, isBn)}</span>
                </div>
              </div>

              <div className="pt-8 flex items-end justify-between text-slate-500 text-[10px]">
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'আদায়কারী / প্রস্তুতকারী' : 'Prepared By'}
                </div>
                <AuthoritySignatureBlock
                  customTitle={isBn ? 'অনুমোদনকারী (মুহতামিম / হিসাবরক্ষক)' : 'Authorized Signatory'}
                  className="scale-90 origin-bottom-right"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
