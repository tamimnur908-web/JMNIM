import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Users, 
  Receipt, 
  CalendarCheck, 
  BookOpen,
  PieChart,
  TrendingUp,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, MadrasaClass, FeePayment, CashTransaction, TeacherAttendanceEvent } from '../types';
import { fetchClasses } from '../utils/classManager';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';

export const CentralReportsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<'students' | 'finance' | 'attendance'>('students');
  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [attendanceEvents, setAttendanceEvents] = useState<TeacherAttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        const cls = await fetchClasses();
        setClasses(cls);

        const sSnap = await getDocs(collection(db, 'students'));
        const sList: Student[] = [];
        sSnap.forEach(d => sList.push({ id: d.id, ...d.data() } as Student));
        setStudents(sList);

        const pSnap = await getDocs(collection(db, 'fee_payments'));
        const pList: FeePayment[] = [];
        pSnap.forEach(d => pList.push({ id: d.id, ...d.data() } as FeePayment));
        setPayments(pList);

        const cSnap = await getDocs(collection(db, 'cash_transactions'));
        const cList: CashTransaction[] = [];
        cSnap.forEach(d => cList.push({ id: d.id, ...d.data() } as CashTransaction));
        setCashTransactions(cList);

        const aSnap = await getDocs(collection(db, 'teacher_attendance_events'));
        const aList: TeacherAttendanceEvent[] = [];
        aSnap.forEach(d => aList.push({ id: d.id, ...d.data() } as TeacherAttendanceEvent));
        setAttendanceEvents(aList);
      } catch (err) {
        console.warn("Could not load reporting data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  // Student Metrics
  const activeStudents = students.filter(s => !s.isArchived);
  const residentialStudents = activeStudents.filter(s => s.residentialCategory === 'residential');
  const nonResidentialStudents = activeStudents.filter(s => s.residentialCategory === 'non_residential');
  const daycareStudents = activeStudents.filter(s => s.residentialCategory === 'day_care');

  const totalMonthlyFeeExpected = activeStudents.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);

  // Financial Metrics
  const totalIncome = cashTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = cashTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  // Fee Collection Metrics
  const totalFeeCollected = payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalFeeDue = payments.reduce((sum, p) => sum + (p.dueAmount || 0), 0);

  // Export Reports
  const handleExportStudents = () => {
    const rows = activeStudents.map((s, idx) => ({
      'SL': idx + 1,
      'আইডি': s.studentId,
      'নাম': s.fullName,
      'শ্রেণি': s.className,
      'শাখা': s.sectionName || '-',
      'রোল': s.roll,
      'আবাসিক ধরন': s.residentialCategory,
      'মাসিক বেতন': s.monthlyFee,
      'অভিভাবকের নাম': s.guardianName,
      'ফোন': s.guardianPhone
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student_Demographics');
    XLSX.writeFile(wb, `JMNIM_Student_Report_${getTodayDateString()}.xlsx`);
  };

  const handleExportFinancial = () => {
    const rows = cashTransactions.map((tx, idx) => ({
      'SL': idx + 1,
      'ভাউচার নং': tx.voucherNo,
      'তারিখ': tx.date,
      'ধরন': tx.type,
      'খাত': tx.category,
      'পরিমাণ': tx.amount,
      'মাধ্যম': tx.paymentMethod,
      'বিবরণ': tx.description
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial_Ledger');
    XLSX.writeFile(wb, `JMNIM_Finance_Report_${getTodayDateString()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'সেন্ট্রাল অ্যানালিটিক্স ও প্রাতিষ্ঠানিক রিপোর্ট' : 'Central Analytics & Institutional Reports'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'মাদরাসার শিক্ষার্থী জনমিতি, অর্থনৈতিক পারফরম্যান্স ও হাজিরা পরিসংখ্যান সংক্রান্ত পূর্ণাঙ্গ প্রতিবেদন' 
              : 'Holistic central reporting for students, finance, and attendance statistics'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>{isBn ? 'প্রিন্ট রিপোর্ট' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 no-print">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'students'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isBn ? 'শিক্ষার্থী ও শ্রেণি রিপোর্ট' : 'Student Demographics'}</span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'finance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isBn ? 'আর্থিক বিবরণী ও ক্যাশ বহি' : 'Financial Statement'}</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'attendance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>{isBn ? 'শিক্ষক হাজিরা ও জিপিএস বিশ্লেষণ' : 'Attendance Summary'}</span>
        </button>
      </div>

      {/* TAB 1: Student Demographics */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">{isBn ? 'মোট সক্রিয় শিক্ষার্থী' : 'Active Students'}</span>
              <span className="text-xl font-bold text-slate-900">{activeStudents.length} {isBn ? 'জন' : ''}</span>
            </div>
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 shadow-sm">
              <span className="text-xs text-indigo-700 block">{isBn ? 'আবাসিক শিক্ষার্থী' : 'Residential'}</span>
              <span className="text-xl font-bold text-indigo-900">{residentialStudents.length} {isBn ? 'জন' : ''}</span>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
              <span className="text-xs text-emerald-700 block">{isBn ? 'অনাবাসিক শিক্ষার্থী' : 'Non-Residential'}</span>
              <span className="text-xl font-bold text-emerald-900">{nonResidentialStudents.length} {isBn ? 'জন' : ''}</span>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
              <span className="text-xs text-amber-700 block">{isBn ? 'ডে-কেয়ার শিক্ষার্থী' : 'Day-care'}</span>
              <span className="text-xl font-bold text-amber-900">{daycareStudents.length} {isBn ? 'জন' : ''}</span>
            </div>
          </div>

          {/* Class-wise Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800">{isBn ? 'শ্রেণিভিত্তিক শিক্ষার্থী ও ফি প্রাক্কলন' : 'Class-wise Demographics & Fee Projection'}</h3>
              <button
                onClick={handleExportStudents}
                className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold no-print"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBn ? 'এক্সেল ডাউনলোড' : 'Download'}</span>
              </button>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">{isBn ? 'শ্রেণি / জামাত' : 'Class'}</th>
                  <th className="py-3 px-3 text-center">{isBn ? 'আবাসিক' : 'Residential'}</th>
                  <th className="py-3 px-3 text-center">{isBn ? 'অনাবাসিক' : 'Non-Residential'}</th>
                  <th className="py-3 px-3 text-center">{isBn ? 'ডে-কেয়ার' : 'Day-care'}</th>
                  <th className="py-3 px-3 text-center">{isBn ? 'সর্বমোট ছাত্র' : 'Total'}</th>
                  <th className="py-3 px-3 text-right">{isBn ? 'মাসিক সম্ভাব্য ফি' : 'Expected Fee'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls, idx) => {
                  const classStudents = activeStudents.filter(s => s.classId === cls.id);
                  const res = classStudents.filter(s => s.residentialCategory === 'residential').length;
                  const nonRes = classStudents.filter(s => s.residentialCategory === 'non_residential').length;
                  const dc = classStudents.filter(s => s.residentialCategory === 'day_care').length;
                  const expFee = classStudents.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);

                  return (
                    <tr key={cls.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{cls.name}</td>
                      <td className="py-3 px-3 text-center">{res}</td>
                      <td className="py-3 px-3 text-center">{nonRes}</td>
                      <td className="py-3 px-3 text-center">{dc}</td>
                      <td className="py-3 px-3 text-center font-bold text-blue-700">{classStudents.length}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">{formatBDT(expFee, isBn)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t">
                  <td colSpan={2} className="py-3 px-3">মোট (Total):</td>
                  <td className="py-3 px-3 text-center">{residentialStudents.length}</td>
                  <td className="py-3 px-3 text-center">{nonResidentialStudents.length}</td>
                  <td className="py-3 px-3 text-center">{daycareStudents.length}</td>
                  <td className="py-3 px-3 text-center text-blue-700">{activeStudents.length}</td>
                  <td className="py-3 px-3 text-right text-emerald-800">{formatBDT(totalMonthlyFeeExpected, isBn)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Financial Statement */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
              <span className="text-xs text-emerald-700 block">{isBn ? 'সর্বমোট সংগৃহীত আয় (Income)' : 'Total Income'}</span>
              <span className="text-xl font-bold text-emerald-900">{formatBDT(totalIncome, isBn)}</span>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
              <span className="text-xs text-red-700 block">{isBn ? 'সর্বমোট ব্যয় (Expense)' : 'Total Expense'}</span>
              <span className="text-xl font-bold text-red-900">{formatBDT(totalExpense, isBn)}</span>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
              <span className="text-xs text-blue-700 block">{isBn ? 'চলতি উদ্বৃত্ত ক্যাশ (Net Balance)' : 'Net Cash Surplus'}</span>
              <span className="text-xl font-bold text-blue-900">{formatBDT(netBalance, isBn)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-xs text-slate-800">{isBn ? 'সর্বশেষ লেনদেনসমূহ' : 'Recent Transactions'}</h3>
              <button
                onClick={handleExportFinancial}
                className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold no-print"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBn ? 'এক্সেল ডাউনলোড' : 'Download'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-3">ভাউচার</th>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">খাত</th>
                    <th className="py-2.5 px-3">বিবরণ</th>
                    <th className="py-2.5 px-3 text-right">টাকা (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashTransactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-700">{tx.voucherNo}</td>
                      <td className="py-2 px-3 text-slate-500">{tx.date}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{tx.category}</td>
                      <td className="py-2 px-3 text-slate-600">{tx.description}</td>
                      <td className={`py-2 px-3 text-right font-bold ${tx.type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatBDT(tx.amount, isBn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Attendance Summary */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="border-b pb-3">
            <h3 className="font-bold text-xs text-slate-800">
              {isBn ? 'শিক্ষক উপস্থিতি ও জিপিএস মেট্রিক্স সারসংক্ষেপ' : 'Faculty Attendance & GPS Log Summary'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isBn ? `সিস্টেমে মোট ${attendanceEvents.length} টি ডিজিটাল উপস্থিতি রেকর্ড অন্তর্ভুক্ত রয়েছে।` : `Total ${attendanceEvents.length} attendance events recorded.`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border">
              <span className="text-xs text-slate-500 block">মোট এন্ট্রি</span>
              <span className="text-xl font-bold text-slate-900">{attendanceEvents.length}</span>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-700 block">অন-টাইম উপস্থিতি</span>
              <span className="text-xl font-bold text-emerald-800">
                {attendanceEvents.filter(e => e.status === 'present').length}
              </span>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-xs text-amber-700 block">বিলম্বিত উপস্থিতি</span>
              <span className="text-xl font-bold text-amber-800">
                {attendanceEvents.filter(e => e.status === 'late').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
