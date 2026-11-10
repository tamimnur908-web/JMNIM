import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Wallet, 
  PlusCircle, 
  Printer, 
  CheckCircle, 
  Calendar, 
  Search, 
  FileSpreadsheet,
  ArrowDownRight,
  CreditCard
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher, SalaryPayment, SalaryAdvance } from '../types';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const TeacherSalaryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Payment Form
  const [baseSalary, setBaseSalary] = useState<number>(12000);
  const [allowances, setAllowances] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'bkash'>('cash');
  const [remarks, setRemarks] = useState('');

  // Payslip Modal
  const [selectedPayslip, setSelectedPayslip] = useState<SalaryPayment | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Teachers
      const tSnap = await getDocs(collection(db, 'teachers'));
      const tList: Teacher[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as Teacher));
      setTeachers(tList);

      // 2. Payments for selected month
      const pSnap = await getDocs(query(collection(db, 'salary_payments'), where('month', '==', selectedMonth)));
      const pList: SalaryPayment[] = [];
      pSnap.forEach(d => pList.push({ id: d.id, ...d.data() } as SalaryPayment));
      setPayments(pList);
    } catch (err) {
      console.warn("Could not load salary data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const payableTotal = baseSalary + allowances + bonus - advanceDeduction - otherDeduction;

  const handleOpenPayModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setBaseSalary(teacher.baseSalary || 12000);
    setAllowances(0);
    setBonus(0);
    setAdvanceDeduction(0);
    setOtherDeduction(0);
    setRemarks('');
    setIsPayModalOpen(true);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    try {
      const voucherNumber = `SAL-${selectedMonth}-${Date.now().toString().slice(-4)}`;
      const today = getTodayDateString();

      const paymentRecord: Omit<SalaryPayment, 'id'> = {
        voucherNumber,
        teacherId: selectedTeacher.teacherId,
        teacherName: selectedTeacher.fullName,
        month: selectedMonth,
        baseSalary: Number(baseSalary),
        allowances: Number(allowances),
        bonus: Number(bonus),
        advanceDeduction: Number(advanceDeduction),
        otherDeduction: Number(otherDeduction),
        attendanceDeduction: 0,
        payableAmount: payableTotal,
        paidAmount: payableTotal,
        balanceDue: 0,
        paymentDate: today,
        paymentMethod,
        preparedBy: currentUser?.displayName || 'Accountant',
        remarks,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'salary_payments'), paymentRecord);

      // Link to cashbook as Expense automatically
      await addDoc(collection(db, 'cash_transactions'), {
        voucherNo: `VCH-${voucherNumber}`,
        type: 'expense',
        category: isBn ? 'শিক্ষক বেতন' : 'Teacher Salary',
        amount: payableTotal,
        date: today,
        paymentMethod,
        partyName: selectedTeacher.fullName,
        description: `${selectedTeacher.fullName} (${selectedTeacher.teacherId}) - ${selectedMonth} মাসের বেতন পরিশোধ`,
        recordedBy: currentUser?.displayName || 'Accountant',
        linkedPaymentId: voucherNumber,
        createdAt: new Date().toISOString()
      });

      // Audit Log
      await logAudit({
        action: 'Teacher Salary Paid',
        module: 'Teacher Salary & Payroll',
        recordId: docRef.id,
        recordType: 'SalaryPayment',
        performedBy: currentUser?.displayName || 'User',
        performedByRole: role || 'accountant',
        performedByUid: currentUser?.uid,
        newValue: paymentRecord,
        details: `${selectedTeacher.fullName}-এর ${selectedMonth} মাসের বেতন প্রদান (ভাউচার: ${voucherNumber}, মোট: ৳${payableTotal})`
      });

      setIsPayModalOpen(false);
      setSelectedPayslip({ id: docRef.id, ...paymentRecord });
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'বেতন পরিশোধে সমস্যা: ' : 'Failed to pay salary: ') + err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = teachers.map((t, idx) => {
      const payment = payments.find(p => p.teacherId === t.teacherId);
      return {
        'SL': idx + 1,
        'শিক্ষক আইডি': t.teacherId,
        'নাম': t.fullName,
        'পদবি ও বিভাগ': `${t.designation} (${t.department || ''})`,
        'মূল বেতন (৳)': t.baseSalary,
        'প্রদত্ত ভাতা': payment?.allowances || 0,
        'বোনাস': payment?.bonus || 0,
        'কর্তন': (payment?.advanceDeduction || 0) + (payment?.otherDeduction || 0),
        'পরিশোধিত টাকা (৳)': payment?.paidAmount || 0,
        'স্ট্যাটাস': payment ? 'পরিশোধিত' : 'বকেয়া / অপরিশোধিত',
        'ভাউচার নং': payment?.voucherNumber || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary');
    XLSX.writeFile(workbook, `JMNIM_Salary_${selectedMonth}.xlsx`);
  };

  const totalPaidSum = payments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'শিক্ষক বেতন ও পে-রোল ব্যবস্থাপনা' : 'Teacher Salary & Payroll Management'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'মাসিক বেতন হিসাব, ভাতা, বোনাস ও কর্তন সমন্বয় এবং স্বয়ংক্রিয় ক্যাশ বহি লিংক' 
              : 'Monthly payroll calculation, payslips, advance deductions, and cashbook integration'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isBn ? 'এক্সেল' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block">{isBn ? 'মোট শিক্ষক সংখ্যা' : 'Total Teachers'}</span>
          <span className="text-xl font-bold text-slate-900">{teachers.length} {isBn ? 'জন' : ''}</span>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-xs text-emerald-700 block">{isBn ? 'চলতি মাসে প্রদত্ত বেতন' : 'Paid This Month'}</span>
          <span className="text-xl font-bold text-emerald-800">{formatBDT(totalPaidSum, isBn)}</span>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs text-amber-700 block">{isBn ? 'বেতন সম্পন্ন হয়েছে' : 'Payroll Completed'}</span>
          <span className="text-xl font-bold text-amber-900">{payments.length} / {teachers.length} {isBn ? 'জন' : ''}</span>
        </div>
      </div>

      {/* Teachers Salary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{isBn ? 'শিক্ষক আইডি ও নাম' : 'Teacher ID & Name'}</th>
                <th className="py-3 px-3">{isBn ? 'পদবি ও বিভাগ' : 'Designation & Dept'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'মূল বেতন' : 'Base Salary'}</th>
                <th className="py-3 px-3 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                <th className="py-3 px-3">{isBn ? 'পরিশোধের বিবরণ' : 'Payment Info'}</th>
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
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {isBn ? 'কোনো শিক্ষক নিবন্ধিত নেই।' : 'No teachers registered.'}
                  </td>
                </tr>
              ) : (
                teachers.map((teacher, idx) => {
                  const payment = payments.find(p => p.teacherId === teacher.teacherId);
                  const isPaid = Boolean(payment);

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{teacher.fullName}</p>
                        <p className="text-[10px] text-blue-600 font-mono">{teacher.teacherId}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-slate-800">{teacher.designation}</p>
                        <p className="text-[10px] text-slate-400">{teacher.department}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {formatBDT(teacher.baseSalary || 0, isBn)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isPaid ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ {isBn ? 'পরিশোধিত' : 'Paid'}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {isBn ? 'অপরিশোধিত' : 'Due'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {payment ? (
                          <div className="text-[11px] text-slate-600">
                            <p className="font-bold text-emerald-700">{formatBDT(payment.paidAmount, isBn)} ({payment.paymentMethod})</p>
                            <p className="text-[10px] text-slate-400 font-mono">{payment.voucherNumber}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isPaid && payment ? (
                          <button
                            onClick={() => setSelectedPayslip(payment)}
                            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg ml-auto"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{isBn ? 'পে-স্লিপ' : 'Payslip'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenPayModal(teacher)}
                            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg ml-auto shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{isBn ? 'বেতন প্রদান' : 'Pay Salary'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Salary Modal */}
      {isPayModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'শিক্ষক বেতন পরিশোধ ফর্ম' : 'Pay Teacher Salary'}</span>
              </h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p><b>{isBn ? 'শিক্ষক:' : 'Teacher:'}</b> {selectedTeacher.fullName} ({selectedTeacher.teacherId})</p>
                <p><b>{isBn ? 'মাস:' : 'Month:'}</b> <span className="font-bold text-blue-700">{selectedMonth}</span></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'মূল বেতন (৳)' : 'Base Salary'}</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'ভাতা (House/Medical) ৳' : 'Allowances'}</label>
                  <input
                    type="number"
                    value={allowances}
                    onChange={(e) => setAllowances(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'বোনাস ৳' : 'Bonus'}</label>
                  <input
                    type="number"
                    value={bonus}
                    onChange={(e) => setBonus(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-emerald-700 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'অগ্রিম কর্তন ৳' : 'Advance Deduction'}</label>
                  <input
                    type="number"
                    value={advanceDeduction}
                    onChange={(e) => setAdvanceDeduction(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-red-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'অন্যান্য কর্তন ৳' : 'Other Deduction'}</label>
                  <input
                    type="number"
                    value={otherDeduction}
                    onChange={(e) => setOtherDeduction(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-red-600"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-xs">{isBn ? 'সর্বমোট প্রদেয় বেতন (Net Payable):' : 'Net Payable Salary:'}</span>
                <span className="text-lg font-black">{formatBDT(payableTotal, isBn)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'পরিশোধ মাধ্যম' : 'Payment Method'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white"
                  >
                    <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
                    <option value="bank">{isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'}</option>
                    <option value="bkash">বিকাশ (bKash)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Remarks'}</label>
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
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md"
                >
                  {isBn ? 'বেতন পরিশোধ নিশ্চিত করুন' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payslip Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'শিক্ষক বেতন পে-স্লিপ' : 'Salary Payslip'}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button onClick={() => setSelectedPayslip(null)} className="px-2 text-slate-400">✕</button>
              </div>
            </div>

            {/* Printable Payslip Body */}
            <div className="p-4 bg-slate-50 border rounded-xl space-y-3 text-xs print:bg-white print:border-none print:p-0">
              <div className="text-center border-b pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn ? settings.institutionName : settings.institutionNameEn}
                </h2>
                <p className="text-[11px] text-slate-500">{settings.address} • ফোন: {settings.phone}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px]">
                  {isBn ? 'বেতন রশিদ ও পে-স্লিপ' : 'Salary Payment Voucher'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">ভাউচার নং:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedPayslip.voucherNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">পরিশোধের মাস:</span>
                  <span className="font-bold text-blue-700">{selectedPayslip.month}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">শিক্ষকের নাম ও আইডি:</span>
                  <span className="font-bold text-slate-900">{selectedPayslip.teacherName} ({selectedPayslip.teacherId})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">পরিশোধের তারিখ ও মাধ্যম:</span>
                  <span className="font-medium text-slate-900">{selectedPayslip.paymentDate} ({selectedPayslip.paymentMethod})</span>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-200 text-left text-xs bg-white">
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">মূল বেতন (Base Salary):</td>
                    <td className="p-2 text-right font-bold">{formatBDT(selectedPayslip.baseSalary, isBn)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">ভাতা ও বোনাস (Allowances & Bonus):</td>
                    <td className="p-2 text-right font-bold text-emerald-700">+{formatBDT(selectedPayslip.allowances + selectedPayslip.bonus, isBn)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">অগ্রিম ও অন্যান্য কর্তন (Deductions):</td>
                    <td className="p-2 text-right font-bold text-red-600">-{formatBDT(selectedPayslip.advanceDeduction + selectedPayslip.otherDeduction, isBn)}</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-2">মোট পরিশোধিত টাকা (Net Paid):</td>
                    <td className="p-2 text-right text-emerald-800 text-sm">{formatBDT(selectedPayslip.paidAmount, isBn)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-8 flex justify-between text-slate-500 text-[10px]">
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'শিক্ষকের স্বাক্ষর' : 'Teacher Signature'}
                </div>
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'মুহতামিম / হিসাবরক্ষক' : 'Authorized Signature'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
