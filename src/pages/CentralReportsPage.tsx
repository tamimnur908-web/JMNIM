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
  Award,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, MadrasaClass, FeePayment, CashTransaction, TeacherAttendanceEvent, Teacher, TeacherLeaveApplication, AttendanceSchedule } from '../types';
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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<TeacherLeaveApplication[]>([]);
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance Reporting State
  const [attSearch, setAttSearch] = useState('');
  const [attStatusFilter, setAttStatusFilter] = useState('all');
  const [attMonthFilter, setAttMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [attDayFilter, setAttDayFilter] = useState(getTodayDateString());
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [attViewMode, setAttViewMode] = useState<'logs' | 'leaves'>('logs');

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

        const tSnap = await getDocs(collection(db, 'teachers'));
        const tList: Teacher[] = [];
        tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as Teacher));
        setTeachers(tList);

        const lSnap = await getDocs(collection(db, 'teacher_leave_applications'));
        const lList: TeacherLeaveApplication[] = [];
        lSnap.forEach(d => lList.push({ id: d.id, ...d.data() } as TeacherLeaveApplication));
        setLeaveApplications(lList);

        const schSnap = await getDocs(collection(db, 'attendance_schedules'));
        const schList: AttendanceSchedule[] = [];
        schSnap.forEach(d => schList.push({ id: d.id, ...d.data() } as AttendanceSchedule));
        setSchedules(schList);
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
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-xs text-slate-800">{isBn ? 'শ্রেণিভিত্তিক শিক্ষার্থী ও ফি প্রাক্কলন' : 'Class-wise Demographics & Fee Projection'}</h3>
              <button
                onClick={handleExportStudents}
                className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold no-print shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBn ? 'এক্সেল ডাউনলোড' : 'Download'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
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

      {/* TAB 3: Faculty Attendance & Leave Reports */}
      {activeTab === 'attendance' && (() => {
        // Filter attendance events
        const filteredEvents = attendanceEvents.filter(ev => {
          if (selectedTeacherId !== 'all' && ev.teacherId !== selectedTeacherId) return false;
          if (attMonthFilter && !ev.date.startsWith(attMonthFilter)) return false;
          if (attStatusFilter !== 'all' && ev.status !== attStatusFilter) return false;
          if (attSearch.trim()) {
            const q = attSearch.toLowerCase();
            const mName = ev.teacherName?.toLowerCase().includes(q);
            const mId = ev.teacherId?.toLowerCase().includes(q);
            if (!mName && !mId) return false;
          }
          return true;
        });

        // Filter leave applications
        const filteredLeaves = leaveApplications.filter(lv => {
          if (selectedTeacherId !== 'all' && lv.teacherId !== selectedTeacherId) return false;
          if (attMonthFilter && !lv.startDate.startsWith(attMonthFilter) && !lv.endDate.startsWith(attMonthFilter)) return false;
          if (attSearch.trim()) {
            const q = attSearch.toLowerCase();
            const mName = lv.teacherName?.toLowerCase().includes(q);
            const mId = lv.teacherId?.toLowerCase().includes(q);
            if (!mName && !mId) return false;
          }
          return true;
        });

        // 1. Combined Faculty Attendance Excel
        const exportCombinedExcel = () => {
          if (filteredEvents.length === 0) {
            alert(isBn ? 'এক্সপোর্ট করার মতো কোনো তথ্য নেই।' : 'No attendance events to export.');
            return;
          }
          const rows = filteredEvents.map((ev, i) => ({
            'SL': i + 1,
            'Teacher ID': ev.teacherId,
            'Teacher Name': ev.teacherName,
            'Date': ev.date,
            'Schedule / Session': ev.scheduleName || 'General Session',
            'Event Type': ev.eventType === 'check_in' 
              ? `Check-In ${ev.intervalIndex !== undefined ? `(#${ev.intervalIndex + 1})` : ''}` 
              : `Check-Out ${ev.intervalIndex !== undefined ? `(#${ev.intervalIndex + 1})` : ''}`,
            'Time': ev.time,
            'Status': ev.status,
            'Distance (Meters)': ev.distanceMeters || 0,
            'Geofence': ev.isWithinGeofence ? 'Inside Campus' : 'Outside Campus',
            'Record Method': ev.isAutoCheckout ? 'System Auto Check-Out' : ev.isManualEntry ? `Admin (${ev.recordedBy || 'Admin'})` : 'Self GPS',
            'Reason / Notes / Justification': ev.correctionReason || ev.autoCheckoutReason || ev.notes || 'Normal'
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Combined_Faculty_Attendance');
          XLSX.writeFile(wb, `Combined_Teacher_Attendance_${attMonthFilter || getTodayDateString()}.xlsx`);
        };

        // 2. Individual Teacher Attendance Excel
        const exportIndividualExcel = () => {
          if (selectedTeacherId === 'all') {
            alert(isBn ? 'দয়া করে একজন শিক্ষক নির্বাচন করুন।' : 'Please select a specific teacher first.');
            return;
          }
          const teacherEvents = attendanceEvents.filter(ev => ev.teacherId === selectedTeacherId);
          if (teacherEvents.length === 0) {
            alert(isBn ? 'এই শিক্ষকের কোনো হাজিরার রেকর্ড পাওয়া যায়নি।' : 'No records found for this teacher.');
            return;
          }
          const tName = teacherEvents[0].teacherName || selectedTeacherId;
          const rows = teacherEvents.map((ev, i) => ({
            'SL': i + 1,
            'Date': ev.date,
            'Session': ev.scheduleName || 'General',
            'Event': ev.eventType === 'check_in' ? 'Check-In' : 'Check-Out',
            'Time': ev.time,
            'Status': ev.status,
            'Within Campus': ev.isWithinGeofence ? 'Yes' : 'No',
            'Distance': `${ev.distanceMeters || 0}m`,
            'Method': ev.isAutoCheckout ? 'Auto Check-Out' : ev.isManualEntry ? `Admin (${ev.recordedBy})` : 'Self GPS',
            'Audit Notes': ev.correctionReason || ev.autoCheckoutReason || ev.notes || '-'
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Attendance');
          XLSX.writeFile(wb, `Teacher_Attendance_${selectedTeacherId}_${tName}.xlsx`);
        };

        // 3. Daily Attendance Excel
        const exportDailyExcel = () => {
          const dayEvents = attendanceEvents.filter(ev => ev.date === attDayFilter);
          const dayLeaves = leaveApplications.filter(lv => lv.status === 'approved' && lv.startDate <= attDayFilter && lv.endDate >= attDayFilter);

          if (dayEvents.length === 0 && dayLeaves.length === 0) {
            alert(isBn ? `${attDayFilter} তারিখে কোনো রেকর্ড নেই।` : `No records found for ${attDayFilter}.`);
            return;
          }

          const rows: any[] = [];
          dayEvents.forEach(ev => {
            rows.push({
              'SL': rows.length + 1,
              'Teacher ID': ev.teacherId,
              'Teacher Name': ev.teacherName,
              'Date': ev.date,
              'Session': ev.scheduleName || 'General',
              'Event': ev.eventType === 'check_in' ? 'Check-In' : 'Check-Out',
              'Time': ev.time,
              'Status': ev.status,
              'Geofence': ev.isWithinGeofence ? 'Inside Campus' : 'Outside Campus',
              'Record Method': ev.isAutoCheckout ? 'System Auto Check-Out' : ev.isManualEntry ? `Admin (${ev.recordedBy})` : 'Self GPS',
              'Mandatory Leave Reason / Audit Note': ev.correctionReason || ev.autoCheckoutReason || ev.notes || 'Normal'
            });
          });

          dayLeaves.forEach(lv => {
            rows.push({
              'SL': rows.length + 1,
              'Teacher ID': lv.teacherId,
              'Teacher Name': lv.teacherName,
              'Date': attDayFilter,
              'Session': lv.specificSessionName || (lv.leaveScope === 'full_day' ? 'Full Day' : 'Partial Day'),
              'Event': 'Approved Leave (ছুটি)',
              'Time': 'N/A',
              'Status': 'leave',
              'Geofence': 'Campus N/A (On Leave)',
              'Record Method': `Leave Management (Approved by: ${lv.approvedBy || 'Admin'})`,
              'Mandatory Leave Reason / Audit Note': `[ছুটির কারণ]: ${lv.reason}`
            });
          });

          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Daily_Report');
          XLSX.writeFile(wb, `Daily_Attendance_Report_${attDayFilter}.xlsx`);
        };

        // 4. Monthly Attendance Excel
        const exportMonthlyExcel = () => {
          const monthEvents = attendanceEvents.filter(ev => ev.date.startsWith(attMonthFilter));
          if (monthEvents.length === 0) {
            alert(isBn ? `${attMonthFilter} মাসের কোনো রেকর্ড নেই।` : `No records found for month ${attMonthFilter}.`);
            return;
          }
          const rows = monthEvents.map((ev, i) => ({
            'SL': i + 1,
            'Teacher ID': ev.teacherId,
            'Teacher Name': ev.teacherName,
            'Date': ev.date,
            'Session': ev.scheduleName || 'General',
            'Event': ev.eventType === 'check_in' ? 'Check-In' : 'Check-Out',
            'Time': ev.time,
            'Status': ev.status,
            'Geofence': ev.isWithinGeofence ? 'Inside Campus' : 'Outside Campus',
            'Method': ev.isAutoCheckout ? 'System Auto Check-Out' : ev.isManualEntry ? `Admin (${ev.recordedBy})` : 'Self GPS',
            'Audit Notes': ev.correctionReason || ev.autoCheckoutReason || ev.notes || 'Normal'
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Monthly_Report');
          XLSX.writeFile(wb, `Monthly_Attendance_Report_${attMonthFilter}.xlsx`);
        };

        // 5. Comprehensive Leave Report (MANDATORY LEAVE REASON COLUMN)
        const exportComprehensiveLeaveExcel = () => {
          if (filteredLeaves.length === 0) {
            alert(isBn ? 'এক্সপোর্ট করার মতো কোনো ছুটির আবেদন নেই।' : 'No leave applications found to export.');
            return;
          }
          const rows = filteredLeaves.map((lv, i) => ({
            'SL': i + 1,
            'Teacher ID': lv.teacherId,
            'Teacher Name': lv.teacherName,
            'Leave Type': lv.leaveType,
            'Scope': lv.leaveScope,
            'Specific Session': lv.specificSessionName || '-',
            'Start Date': lv.startDate,
            'End Date': lv.endDate,
            'Total Days': lv.totalDays || 1,
            'Approval Status': lv.status,
            'Approved By': lv.approvedBy || '-',
            'Approved At': lv.approvedAt || '-',
            'Mandatory Detailed Leave Reason': lv.reason, // MANDATORY NON-EMPTY COLUMN
            'Admin Remarks / Notes': lv.approverRemarks || '-',
            'Application Date': lv.appliedAt ? lv.appliedAt.slice(0, 10) : '-'
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Faculty_Leave_Report');
          XLSX.writeFile(wb, `Faculty_Leave_Report_${attMonthFilter || getTodayDateString()}.xlsx`);
        };

        // 6. Teacher Leave History Excel
        const exportTeacherLeaveHistory = () => {
          if (selectedTeacherId === 'all') {
            alert(isBn ? 'দয়া করে একজন শিক্ষক নির্বাচন করুন।' : 'Please select a specific teacher first.');
            return;
          }
          const tLeaves = leaveApplications.filter(lv => lv.teacherId === selectedTeacherId);
          if (tLeaves.length === 0) {
            alert(isBn ? 'এই শিক্ষকের কোনো ছুটির ইতিহাস পাওয়া যায়নি।' : 'No leave history found for this teacher.');
            return;
          }
          const tName = tLeaves[0].teacherName || selectedTeacherId;
          const rows = tLeaves.map((lv, i) => ({
            'SL': i + 1,
            'Teacher ID': lv.teacherId,
            'Teacher Name': lv.teacherName,
            'Leave Type': lv.leaveType,
            'Scope': lv.leaveScope,
            'Specific Session': lv.specificSessionName || '-',
            'Start Date': lv.startDate,
            'End Date': lv.endDate,
            'Total Days': lv.totalDays || 1,
            'Status': lv.status,
            'Approved By': lv.approvedBy || '-',
            'Mandatory Leave Reason': lv.reason, // MANDATORY NON-EMPTY COLUMN
            'Admin Remarks': lv.approverRemarks || '-',
            'Applied Date': lv.appliedAt ? lv.appliedAt.slice(0, 10) : '-'
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Leave_History');
          XLSX.writeFile(wb, `Leave_History_${selectedTeacherId}_${tName}.xlsx`);
        };

        const totalFiltered = filteredEvents.length;
        const presentCount = filteredEvents.filter(e => e.status === 'present').length;
        const lateCount = filteredEvents.filter(e => e.status === 'late').length;
        const earlyLeaveCount = filteredEvents.filter(e => e.status === 'early_leave').length;
        const autoCheckoutCount = filteredEvents.filter(e => e.isAutoCheckout || e.status === 'auto_checkout').length;
        const approvedLeaveCount = filteredLeaves.filter(lv => lv.status === 'approved').length;

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
            {/* Header and Export Tools */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  {isBn ? 'শিক্ষক উপস্থিতি ও সেন্ট্রাল রিপোর্ট অ্যানালিটিক্স' : 'Faculty Attendance & Central Analytics'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isBn 
                    ? 'সম্মিলিত ও একক শিক্ষক হাজিরা, একাধিক সেশন, স্বয়ংক্রিয় চেক-আউট ও বাধ্যতামূলক ছুটির কারণসমৃদ্ধ পূর্ণাঙ্গ এক্সেল রিপোর্ট' 
                    : 'Combined & individual reports, multi-session tracking, auto check-out & comprehensive leave export with mandatory reasons.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportCombinedExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  title={isBn ? "সকল শিক্ষকের সম্মিলিত হাজিরা এক্সপোর্ট" : "Export combined attendance"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBn ? 'সম্মিলিত এক্সেল' : 'Combined Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={exportDailyExcel}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  title={isBn ? "দৈনিক হাজিরা এক্সপোর্ট" : "Daily Attendance Excel"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBn ? 'দৈনিক এক্সেল' : 'Daily Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={exportMonthlyExcel}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  title={isBn ? "মাসিক হাজিরা এক্সপোর্ট" : "Monthly Attendance Excel"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBn ? 'মাসিক এক্সেল' : 'Monthly Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={exportComprehensiveLeaveExcel}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  title={isBn ? "ছুটির পূর্ণাঙ্গ রিপোর্ট এক্সপোর্ট (বাধ্যতামূলক ছুটির কারণসহ)" : "Export leave report with mandatory reasons"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ছুটি রিপোর্ট এক্সেল' : 'Leave Report Excel'}</span>
                </button>

                {selectedTeacherId !== 'all' && (
                  <button
                    type="button"
                    onClick={exportIndividualExcel}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                    title={isBn ? "নির্বাচিত একক শিক্ষকের হাজিরা এক্সপোর্ট" : "Export selected teacher attendance"}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isBn ? 'একক শিক্ষক এক্সেল' : 'Individual Excel'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>
              </div>
            </div>

            {/* Metrics Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-500 font-semibold block">{isBn ? "মোট ইভেন্ট" : "Total Events"}</span>
                <span className="text-lg font-bold text-slate-900">{totalFiltered}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 font-semibold block">{isBn ? "অন-টাইম" : "On-Time"}</span>
                <span className="text-lg font-bold text-emerald-800">{presentCount}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <span className="text-[11px] text-amber-700 font-semibold block">{isBn ? "বিলম্ব (Late)" : "Late"}</span>
                <span className="text-lg font-bold text-amber-800">{lateCount}</span>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-center">
                <span className="text-[11px] text-orange-700 font-semibold block">{isBn ? "আগে প্রস্থান" : "Early Leave"}</span>
                <span className="text-lg font-bold text-orange-800">{earlyLeaveCount}</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
                <span className="text-[11px] text-purple-700 font-semibold block">{isBn ? "অটো চেক-আউট" : "Auto Check-Out"}</span>
                <span className="text-lg font-bold text-purple-800">{autoCheckoutCount}</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                <span className="text-[11px] text-blue-700 font-semibold block">{isBn ? "অনুমোদিত ছুটি" : "Approved Leave"}</span>
                <span className="text-lg font-bold text-blue-800">{approvedLeaveCount}</span>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setAttViewMode('logs')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  attViewMode === 'logs'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isBn ? 'হাজিরা ও সেশন লগ' : 'Attendance Logs'}
              </button>

              <button
                type="button"
                onClick={() => setAttViewMode('leaves')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  attViewMode === 'leaves'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isBn ? 'ছুটির আবেদন ও অনুমোদিত ছুটি' : 'Leave Records & Justifications'}
              </button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Teacher Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-600 font-semibold">{isBn ? "শিক্ষক:" : "Teacher:"}</span>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium max-w-[180px]"
                  >
                    <option value="all">{isBn ? "সকল শিক্ষক" : "All Teachers"}</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.teacherId}>
                        {t.fullName} ({t.teacherId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-600 font-semibold">{isBn ? "মাস:" : "Month:"}</span>
                  <input
                    type="month"
                    value={attMonthFilter}
                    onChange={(e) => setAttMonthFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                  </input>
                </div>

                {/* Day Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-600 font-semibold">{isBn ? "তারিখ:" : "Day:"}</span>
                  <input
                    type="date"
                    value={attDayFilter}
                    onChange={(e) => setAttDayFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                  </input>
                </div>

                {attViewMode === 'logs' && (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-600 font-semibold">{isBn ? "স্ট্যাটাস:" : "Status:"}</span>
                    <select
                      value={attStatusFilter}
                      onChange={(e) => setAttStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      <option value="all">{isBn ? "সকল স্ট্যাটাস" : "All Status"}</option>
                      <option value="present">{isBn ? "উপস্থিত (Present)" : "Present"}</option>
                      <option value="late">{isBn ? "বিলম্ব (Late)" : "Late"}</option>
                      <option value="early_leave">{isBn ? "আগে প্রস্থান (Early Leave)" : "Early Leave"}</option>
                      <option value="auto_checkout">{isBn ? "অটো চেক-আউট (Auto)" : "Auto Check-Out"}</option>
                      <option value="missed_checkout">{isBn ? "মিসড চেক-আউট" : "Missed Check-Out"}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={attSearch}
                  onChange={(e) => setAttSearch(e.target.value)}
                  placeholder={isBn ? "নাম বা আইডি খুঁজুন..." : "Search name or ID..."}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                />
              </div>
            </div>

            {/* Table: Logs View */}
            {attViewMode === 'logs' && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">{isBn ? "শিক্ষক" : "Teacher"}</th>
                      <th className="py-2.5 px-3">{isBn ? "সেশন ও শিডিউল" : "Session & Schedule"}</th>
                      <th className="py-2.5 px-3">{isBn ? "তারিখ ও সময়" : "Date & Time"}</th>
                      <th className="py-2.5 px-3">{isBn ? "ইভেন্ট" : "Event"}</th>
                      <th className="py-2.5 px-3">{isBn ? "দূরত্ব ও জিপিএস" : "Distance & GPS"}</th>
                      <th className="py-2.5 px-3">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                      <th className="py-2.5 px-3">{isBn ? "রেকর্ড মাধ্যম" : "Record Method"}</th>
                      <th className="py-2.5 px-3">{isBn ? "মন্তব্য / অডিট" : "Notes / Reason"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          {isBn ? "কোনো উপস্থিতির রেকর্ড পাওয়া যায়নি।" : "No attendance events found."}
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((ev, idx) => (
                        <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>{ev.teacherName}</div>
                            <div className="text-[10px] text-blue-600 font-mono font-medium">{ev.teacherId}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">{ev.scheduleName || 'General'}</span>
                            {ev.intervalIndex !== undefined && (
                              <span className="text-[10px] text-slate-400 font-mono">ইন্টারভাল #{ev.intervalIndex + 1}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono">
                            <div>{ev.date}</div>
                            <div className="text-[10px] text-slate-400">{ev.time}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.eventType === 'check_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                              {ev.eventType === 'check_in' ? (isBn ? 'চেক-ইন' : 'Check In') : (isBn ? 'চেক-আউট' : 'Check Out')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {ev.isAutoCheckout ? (
                              <span className="text-slate-400 text-[10px] italic">{isBn ? "জিপিএস প্রযোজ্য নয়" : "GPS N/A"}</span>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span>{ev.distanceMeters || 0} মি.</span>
                                {ev.isWithinGeofence ? (
                                  <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded font-bold">ক্যাম্পাসে</span>
                                ) : (
                                  <span className="text-[9px] text-red-700 bg-red-50 px-1 rounded font-bold">বাইরে</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ev.status === 'late' ? 'bg-amber-100 text-amber-800' :
                              ev.status === 'early_leave' ? 'bg-orange-100 text-orange-800' :
                              ev.status === 'auto_checkout' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                              ev.status === 'missed_checkout' ? 'bg-red-100 text-red-800 border border-red-200' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {ev.status === 'late' ? (isBn ? 'বিলম্ব' : 'Late') :
                               ev.status === 'early_leave' ? (isBn ? 'আগে প্রস্থান' : 'Early Leave') :
                               ev.status === 'auto_checkout' ? (isBn ? 'অটো চেক-আউট' : 'Auto Check-Out') :
                               ev.status === 'missed_checkout' ? (isBn ? 'মিসড চেক-আউট' : 'Missed Check-Out') :
                               (isBn ? 'অন-টাইম' : 'On-Time')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {ev.isAutoCheckout ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                {isBn ? "সিস্টেম অটো" : "Auto System"}
                              </span>
                            ) : ev.isManualEntry ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                {isBn ? `অ্যাডমিন: ${ev.recordedBy || 'Admin'}` : `Admin: ${ev.recordedBy}`}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {isBn ? "সেলফ জিপিএস" : "Self GPS"}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs truncate" title={ev.correctionReason || ev.autoCheckoutReason || ev.notes}>
                            {ev.correctionReason || ev.autoCheckoutReason || ev.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table: Leaves View */}
            {attViewMode === 'leaves' && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">{isBn ? "শিক্ষক" : "Teacher"}</th>
                      <th className="py-2.5 px-3">{isBn ? "ছুটির ধরন" : "Leave Type"}</th>
                      <th className="py-2.5 px-3">{isBn ? "ব্যাপ্তি ও সেশন" : "Scope & Session"}</th>
                      <th className="py-2.5 px-3">{isBn ? "সময়কাল" : "Duration"}</th>
                      <th className="py-2.5 px-3">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                      <th className="py-2.5 px-3">{isBn ? "বাধ্যতামূলক ছুটির কারণ (Mandatory Reason)" : "Mandatory Leave Reason"}</th>
                      <th className="py-2.5 px-3">{isBn ? "অনুমোদনকারী ও মন্তব্য" : "Approver Remarks"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          {isBn ? "কোনো ছুটির রেকর্ড পাওয়া যায়নি।" : "No leave records found."}
                        </td>
                      </tr>
                    ) : (
                      filteredLeaves.map((lv, idx) => (
                        <tr key={lv.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>{lv.teacherName}</div>
                            <div className="text-[10px] text-purple-600 font-mono font-medium">{lv.teacherId}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              {lv.leaveType === 'illness' ? 'অসুস্থতা' :
                               lv.leaveType === 'medical' ? 'চিকিৎসা' :
                               lv.leaveType === 'personal' ? 'ব্যক্তিগত' :
                               lv.leaveType === 'family_emergency' ? 'পারিবারিক জরুরি' : 'অন্যান্য'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">
                              {lv.leaveScope === 'full_day' ? 'পূর্ণ দিবস' : lv.leaveScope === 'partial_day' ? 'আংশিক দিবস' : 'নির্দিষ্ট সেশন'}
                            </span>
                            {lv.specificSessionName && (
                              <span className="text-[10px] text-slate-400 font-medium">{lv.specificSessionName}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                            <div>{lv.startDate} থেকে {lv.endDate}</div>
                            <div className="text-[10px] text-slate-400 font-bold">{lv.totalDays} দিন</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              lv.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                              lv.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {lv.status === 'approved' ? (isBn ? 'অনুমোদিত' : 'Approved') :
                               lv.status === 'rejected' ? (isBn ? 'প্রত্যাখ্যাত' : 'Rejected') :
                               (isBn ? 'অপেক্ষমাণ' : 'Pending')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-sm">
                            <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px] font-medium whitespace-pre-wrap">
                              {lv.reason}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            <div className="font-semibold text-slate-800">{lv.approvedBy || '—'}</div>
                            <div className="text-[10px] text-slate-400 italic">{lv.approverRemarks || 'মন্তব্য নেই'}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
