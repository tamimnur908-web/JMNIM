import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Receipt, 
  PlusCircle, 
  Printer, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FeePayment, Student, MadrasaClass } from '../types';
import { fetchClasses } from '../utils/classManager';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const FeeManagementPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterDueOnly, setFilterDueOnly] = useState(false);

  // Add Fee Payment Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FeePayment | null>(null);

  // Form
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [feeType, setFeeType] = useState(isBn ? 'মাসিক বেতন (Monthly Tuition)' : 'Monthly Tuition');
  const [month, setMonth] = useState('নভেম্বর ২০২৪');
  const [amount, setAmount] = useState(1500);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(1500);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [remarks, setRemarks] = useState('');

  // Reversal Modal
  const [reversalTarget, setReversalTarget] = useState<FeePayment | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const cls = await fetchClasses();
      setClasses(cls);

      const sSnap = await getDocs(query(collection(db, 'students'), where('isArchived', '!=', true)));
      const sList: Student[] = [];
      sSnap.forEach(d => sList.push({ id: d.id, ...d.data() } as Student));
      setStudents(sList);

      const pSnap = await getDocs(collection(db, 'fee_payments'));
      const pList: FeePayment[] = [];
      pSnap.forEach(d => pList.push({ id: d.id, ...d.data() } as FeePayment));
      pList.sort((a, b) => (b.paymentDate > a.paymentDate ? 1 : (b.createdAt > a.createdAt ? 1 : -1)));
      setPayments(pList);
    } catch (err) {
      console.warn("Could not load fee data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When student selection changes in modal, auto-fill class & monthly fee
  const handleStudentSelect = (sId: string) => {
    setSelectedStudentId(sId);
    const found = students.find(s => s.studentId === sId);
    if (found) {
      const fee = found.monthlyFee || 1500;
      setAmount(fee);
      setDiscount(0);
      setPaidAmount(fee);
    }
  };

  const netPayable = Math.max(0, Number(amount) - Number(discount));
  const dueAmount = Math.max(0, netPayable - Number(paidAmount));

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const foundStudent = students.find(s => s.studentId === selectedStudentId);
    if (!foundStudent) {
      alert(isBn ? 'অনুগ্রহ করে শিক্ষার্থী নির্বাচন করুন।' : 'Please select a student.');
      return;
    }

    const receiptNum = `REC-${Date.now().toString().slice(-6)}`;
    const today = getTodayDateString();

    const record: Omit<FeePayment, 'id'> = {
      receiptNumber: receiptNum,
      studentId: foundStudent.studentId,
      studentName: foundStudent.fullName,
      classId: foundStudent.classId,
      className: foundStudent.className,
      residentialCategory: foundStudent.residentialCategory,
      feeType,
      month,
      amount: Number(amount),
      discount: Number(discount),
      fine: 0,
      netAmount: netPayable,
      paidAmount: Number(paidAmount),
      dueAmount,
      paymentDate: today,
      paymentMethod,
      collectorName: currentUser?.displayName || 'Cashier',
      remarks,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'fee_payments'), record);

      // Automatically record in cashbook if paidAmount > 0
      if (Number(paidAmount) > 0) {
        await addDoc(collection(db, 'cash_transactions'), {
          voucherNo: `VCH-${receiptNum}`,
          type: 'income',
          category: isBn ? 'শিক্ষার্থী ফি' : 'Student Tuition',
          amount: Number(paidAmount),
          date: today,
          paymentMethod,
          partyName: foundStudent.fullName,
          description: `ফি আদায়: ${foundStudent.fullName} (${foundStudent.studentId}) - ${feeType} (${month})`,
          recordedBy: currentUser?.displayName || 'Cashier',
          linkedPaymentId: receiptNum,
          createdAt: new Date().toISOString()
        });
      }

      await logAudit({
        action: 'Fee Payment Collected',
        module: 'Fee Management',
        recordId: docRef.id,
        recordType: 'FeePayment',
        performedBy: currentUser?.displayName || 'User',
        performedByRole: role || 'accountant',
        performedByUid: currentUser?.uid,
        newValue: record,
        details: `রসিদ নং: ${receiptNum}, শিক্ষার্থী: ${foundStudent.fullName} (${foundStudent.studentId}), আদায়: ৳${paidAmount}, বকেয়া: ৳${dueAmount}`
      });

      setShowAddModal(false);
      setSelectedReceipt({ id: docRef.id, ...record });
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'ফি সংরক্ষণে ত্রুটি: ' : 'Failed to save fee: ') + err.message);
    }
  };

  // Reversal Handler
  const handleConfirmReversal = async () => {
    if (!reversalTarget || !reversalReason.trim()) return;
    try {
      await updateDoc(doc(db, 'fee_payments', reversalTarget.id), {
        isReversed: true,
        reversedReason: reversalReason.trim(),
        reversedBy: currentUser?.displayName || 'Admin',
        reversedAt: new Date().toISOString()
      });

      await logAudit({
        action: 'Fee Payment Reversed',
        module: 'Fee Management',
        recordId: reversalTarget.id,
        recordType: 'FeePayment',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        reason: reversalReason.trim(),
        details: `মানি রসিদ বাতিল/রিভার্স: ${reversalTarget.receiptNumber}, শিক্ষার্থী: ${reversalTarget.studentName}, পরিমাণ: ৳${reversalTarget.paidAmount}`
      });

      setReversalTarget(null);
      setReversalReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = filteredPayments.map((p, idx) => ({
      'SL': idx + 1,
      'রসিদ নং': p.receiptNumber,
      'শিক্ষার্থী আইডি': p.studentId,
      'নাম': p.studentName,
      'শ্রেণি': p.className,
      'ফি বিবরণ': p.feeType,
      'মাস': p.month || '-',
      'মোট ধার্য': p.amount,
      'ছাড়': p.discount,
      'পরিশোধিত টাকা': p.paidAmount,
      'বকেয়া': p.dueAmount,
      'মাধ্যম': p.paymentMethod,
      'তারিখ': p.paymentDate,
      'অবস্থা': p.isReversed ? 'বাতিলকৃত' : (p.dueAmount > 0 ? 'বকেয়াযুক্ত' : 'পরিশোধিত')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fee_Collections');
    XLSX.writeFile(wb, `JMNIM_Fee_Receipts_${getTodayDateString()}.xlsx`);
  };

  const filteredPayments = payments.filter(p => {
    if (filterClassId !== 'all' && p.classId !== filterClassId) return false;
    if (filterDueOnly && (p.dueAmount || 0) <= 0) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchRec = p.receiptNumber?.toLowerCase().includes(q);
      const matchName = p.studentName?.toLowerCase().includes(q);
      const matchId = p.studentId?.toLowerCase().includes(q);
      if (!matchRec && !matchName && !matchId) return false;
    }
    return true;
  });

  const totalPaidSum = filteredPayments.filter(p => !p.isReversed).reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalDueSum = filteredPayments.filter(p => !p.isReversed).reduce((sum, p) => sum + (p.dueAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'ফি কালেকশন ও মানি রসিদ' : 'Fee Collection & Money Receipts'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'শিক্ষার্থীদের মাসিক বেতন ও অন্যান্য ফি আদায়, রসিদ মুদ্রণ ও বকেয়া হিসাব' 
              : 'Student tuition collection, printable money receipts, and outstanding dues'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (students.length > 0) {
                handleStudentSelect(students[0].studentId);
              }
              setShowAddModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isBn ? 'ফি আদায় (নতুন রসিদ)' : 'Collect Fee'}</span>
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
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-xs text-emerald-700 block">{isBn ? 'আদায়কৃত মোট ফি' : 'Total Paid Fees'}</span>
          <span className="text-xl font-bold text-emerald-900">{formatBDT(totalPaidSum, isBn)}</span>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs text-amber-700 block">{isBn ? 'মোট অপরিশোধিত বকেয়া' : 'Total Due Fees'}</span>
          <span className="text-xl font-bold text-amber-900">{formatBDT(totalDueSum, isBn)}</span>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
          <span className="text-xs text-blue-700 block">{isBn ? 'মোট রসিদ সংখ্যা' : 'Total Receipts'}</span>
          <span className="text-xl font-bold text-blue-900">{filteredPayments.length} {isBn ? 'টি' : ''}</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'রসিদ নং, শিক্ষার্থী আইডি বা নাম...' : 'Search receipt, ID or name...'}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">{isBn ? 'সকল শ্রেণি / জামাত' : 'All Classes'}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filterDueOnly}
              onChange={(e) => setFilterDueOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>{isBn ? 'শুধুমাত্র বকেয়াযুক্ত রসিদ দেখান' : 'Show Outstanding Dues Only'}</span>
          </label>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{isBn ? 'রসিদ নং ও তারিখ' : 'Receipt & Date'}</th>
                <th className="py-3 px-3">{isBn ? 'শিক্ষার্থী ও শ্রেণি' : 'Student & Class'}</th>
                <th className="py-3 px-3">{isBn ? 'ফি বিবরণ ও মাস' : 'Fee Type & Month'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'আদায়কৃত টাকা' : 'Paid Amount'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'বকেয়া' : 'Due'}</th>
                <th className="py-3 px-3 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'পদক্ষেপ' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {isBn ? 'লোড হচ্ছে...' : 'Loading...'}
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {isBn ? 'কোনো ফি আদায়ের রেকর্ড পাওয়া যায়নি।' : 'No fee records found.'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p, idx) => (
                  <tr key={p.id} className={`hover:bg-slate-50 transition ${p.isReversed ? 'bg-red-50/40 opacity-70' : ''}`}>
                    <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-mono font-bold text-blue-700">{p.receiptNumber}</p>
                      <p className="text-[10px] text-slate-400">{p.paymentDate}</p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{p.studentName}</p>
                      <p className="text-[10px] text-slate-500">{p.className} ({p.studentId})</p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-800">{p.feeType}</p>
                      {p.month && <span className="text-[10px] text-slate-400">{p.month}</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">
                      {formatBDT(p.paidAmount, isBn)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-700">
                      {p.dueAmount > 0 ? formatBDT(p.dueAmount, isBn) : '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {p.isReversed ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                          {isBn ? 'বাতিলকৃত' : 'Reversed'}
                        </span>
                      ) : p.dueAmount > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {isBn ? 'আংশিক বকেয়া' : 'Partial Due'}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {isBn ? 'পরিশোধিত' : 'Fully Paid'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setSelectedReceipt(p)}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="রসিদ দেখুন / প্রিন্ট"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {!p.isReversed && (isSuperAdmin || role === 'admin') && (
                          <button
                            onClick={() => {
                              setReversalTarget(p);
                              setReversalReason('');
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="রসিদ বাতিল / রিভার্স"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Fee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'নতুন ফি আদায় রসিদ' : 'New Fee Collection Receipt'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{isBn ? 'শিক্ষার্থী নির্বাচন করুন *' : 'Select Student *'}</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white font-semibold"
                  required
                >
                  <option value="">{isBn ? '-- শিক্ষার্থী বাছাই করুন --' : '-- Choose Student --'}</option>
                  {students.map(s => (
                    <option key={s.id} value={s.studentId}>
                      {s.fullName} ({s.studentId}) - {s.className} [রোল: {s.roll}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'ফি এর খাত' : 'Fee Type'}</label>
                  <input
                    type="text"
                    value={feeType}
                    onChange={(e) => setFeeType(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'পরিশোধের মাস' : 'Month'}</label>
                  <input
                    type="text"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'মোট ফি (৳)' : 'Fee Amount'}</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'ছাড় (Discount) ৳' : 'Discount'}</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'আদায়কৃত টাকা (Paid) ৳' : 'Paid Amount'}</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold text-emerald-700"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between font-bold text-xs">
                <span>{isBn ? 'নিট বকেয়া (Remaining Due):' : 'Remaining Due:'}</span>
                <span className={dueAmount > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                  {formatBDT(dueAmount, isBn)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'পরিশোধের মাধ্যম' : 'Payment Method'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white"
                  >
                    <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
                    <option value="bkash">বিকাশ (bKash)</option>
                    <option value="nagad">নগদ (Nagad)</option>
                    <option value="bank">ব্যাংক (Bank)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'মন্তব্য' : 'Remarks'}</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="নোট..."
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
                >
                  {isBn ? 'রসিদ সংরক্ষণ ও প্রিন্ট' : 'Save & Print Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'মানি রসিদ' : 'Money Receipt'}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button onClick={() => setSelectedReceipt(null)} className="px-2 text-slate-400">✕</button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border rounded-xl space-y-3 text-xs print:bg-white print:border-none print:p-0">
              <div className="text-center border-b pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn ? settings.institutionName : settings.institutionNameEn}
                </h2>
                <p className="text-[11px] text-slate-500">{settings.address} • ফোন: {settings.phone}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                  {isBn ? 'শিক্ষার্থী ফি মানি রসিদ' : 'Fee Money Receipt'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">রসিদ নং:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedReceipt.receiptNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">তারিখ:</span>
                  <span className="font-medium text-slate-900">{selectedReceipt.paymentDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">শিক্ষার্থীর নাম:</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">শিক্ষার্থী আইডি ও শ্রেণি:</span>
                  <span className="font-medium text-slate-900">{selectedReceipt.studentId} ({selectedReceipt.className})</span>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-200 text-left text-xs bg-white">
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">ফি বিবরণ ও মাস:</td>
                    <td className="p-2 text-right font-bold">{selectedReceipt.feeType} ({selectedReceipt.month})</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">নির্ধারিত মোট ফি:</td>
                    <td className="p-2 text-right">{formatBDT(selectedReceipt.amount, isBn)}</td>
                  </tr>
                  {selectedReceipt.discount > 0 && (
                    <tr className="border-b text-emerald-700">
                      <td className="p-2 font-medium">ছাড় (Discount):</td>
                      <td className="p-2 text-right">-{formatBDT(selectedReceipt.discount, isBn)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-2">আদায়কৃত টাকা (Paid):</td>
                    <td className="p-2 text-right text-emerald-800 text-sm">
                      {formatBDT(selectedReceipt.paidAmount, isBn)} ({selectedReceipt.paymentMethod})
                    </td>
                  </tr>
                  {selectedReceipt.dueAmount > 0 && (
                    <tr className="text-amber-800 font-bold bg-amber-50">
                      <td className="p-2">অবশিষ্ট বকেয়া (Due):</td>
                      <td className="p-2 text-right">{formatBDT(selectedReceipt.dueAmount, isBn)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="pt-8 flex justify-between text-slate-500 text-[10px]">
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'অভিভাবকের স্বাক্ষর' : 'Payer Signature'}
                </div>
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'আদায়কারীর স্বাক্ষর' : 'Cashier Signature'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border-2 border-red-500">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-slate-900">{isBn ? 'মানি রসিদ বাতিল ও রিভার্স নিশ্চিতকরণ' : 'Confirm Receipt Reversal'}</h3>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <p><b>রসিদ নং:</b> {reversalTarget.receiptNumber}</p>
              <p><b>শিক্ষার্থী:</b> {reversalTarget.studentName} ({reversalTarget.studentId})</p>
              <p><b>টাকার পরিমাণ:</b> {formatBDT(reversalTarget.paidAmount, isBn)}</p>
            </div>

            <div>
              <label className="block font-bold text-xs text-slate-700 mb-1">
                {isBn ? 'বাতিলের সুনির্দিষ্ট কারণ (অডিট ট্রেইল) *' : 'Reason for reversal *'}
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={2}
                placeholder={isBn ? 'যেমন: ভুল এন্ট্রি / দ্বৈত রসিদ...' : 'Reason...'}
                className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t text-xs">
              <button
                type="button"
                onClick={() => setReversalTarget(null)}
                className="px-4 py-2 border rounded-lg"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
              >
                {isBn ? 'রসিদ বাতিল নিশ্চিত করুন' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
