import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Wallet, 
  Printer, 
  CheckCircle2, 
  Calendar, 
  Search, 
  FileSpreadsheet,
  CreditCard,
  BellRing,
  Clock,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  UserX,
  FileCheck2,
  Send,
  Eye,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher, SalaryPayment } from '../types';
import { formatBDT, formatNumber, getTodayDateString, formatSalaryMonth, formatDate } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';
import { SalaryReceiptModal } from '../components/SalaryReceiptModal';
import { TeacherAcknowledgmentModal } from '../components/TeacherAcknowledgmentModal';

export const TeacherSalaryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role, userProfile, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  // Role permissions
  const isAccountantOrAdmin = isSuperAdmin || role === 'admin' || role === 'principal' || role === 'accountant';
  const isTeacherOnly = role === 'teacher' && !isSuperAdmin;

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [teacherPayments, setTeacherPayments] = useState<SalaryPayment[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Admin View / Teacher View Toggle (for Admins who are also teachers)
  const [activeTab, setActiveTab] = useState<'admin_payroll' | 'my_salary'>(
    isTeacherOnly ? 'my_salary' : 'admin_payroll'
  );

  // Admin table filter
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'pending' | 'acknowledged' | 'due'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Pay Salary Form State
  const [payMonth, setPayMonth] = useState<string>(selectedMonth);
  const [baseSalary, setBaseSalary] = useState<number>(12000);
  const [allowances, setAllowances] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'bkash'>('cash');
  const [remarks, setRemarks] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Modals
  const [selectedPayslip, setSelectedPayslip] = useState<SalaryPayment | null>(null);
  const [acknowledgingPayment, setAcknowledgingPayment] = useState<SalaryPayment | null>(null);

  // Reminder feedback state
  const [reminderSendingId, setReminderSendingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Find linked teacher for the currently logged-in user
  const myLinkedTeacher = teachers.find(t => 
    (t.userId && currentUser?.uid && t.userId === currentUser.uid) ||
    (userProfile?.teacherDocId && t.id === userProfile.teacherDocId) ||
    (userProfile?.teacherId && t.teacherId === userProfile.teacherId) ||
    (currentUser?.email && t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
    (userProfile?.phoneNumber && t.phone && t.phone.replace(/\D/g, '') === userProfile.phoneNumber.replace(/\D/g, ''))
  );

  // Auto-redirect teacher-only role to personal view
  useEffect(() => {
    if (isTeacherOnly) {
      setActiveTab('my_salary');
    }
  }, [isTeacherOnly]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Teachers
      const tSnap = await getDocs(collection(db, 'teachers'));
      const tList: Teacher[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as Teacher));
      setTeachers(tList);

      // 2. Load Users (to resolve teacher UIDs if missing on teacher document)
      let uList: any[] = [];
      if (isAccountantOrAdmin) {
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          uSnap.forEach(d => uList.push({ id: d.id, ...d.data() }));
          setAllUsers(uList);
        } catch (e) {
          // Users list might be restricted by rules
        }
      }

      // 3. Payments for Admin View (All payments for selected month)
      if (isAccountantOrAdmin) {
        const pSnap = await getDocs(query(collection(db, 'salary_payments'), where('month', '==', selectedMonth)));
        const pList: SalaryPayment[] = [];
        pSnap.forEach(d => pList.push({ id: d.id, ...d.data() } as SalaryPayment));
        setPayments(pList);
      }

      // 4. Payments for Teacher's Personal View
      // Determine effective teacher ID for logged in user
      const effectiveTeacher = tList.find(t => 
        (t.userId && currentUser?.uid && t.userId === currentUser.uid) ||
        (userProfile?.teacherDocId && t.id === userProfile.teacherDocId) ||
        (userProfile?.teacherId && t.teacherId === userProfile.teacherId) ||
        (currentUser?.email && t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (userProfile?.phoneNumber && t.phone && t.phone.replace(/\D/g, '') === userProfile.phoneNumber.replace(/\D/g, ''))
      );

      if (effectiveTeacher) {
        const mySnap = await getDocs(
          query(collection(db, 'salary_payments'), where('teacherId', '==', effectiveTeacher.teacherId))
        );
        const myList: SalaryPayment[] = [];
        mySnap.forEach(d => myList.push({ id: d.id, ...d.data() } as SalaryPayment));
        myList.sort((a, b) => (b.month > a.month ? 1 : -1));
        setTeacherPayments(myList);

        // Check if there's a deep-linked salary payment ID from a notification
        const openPaymentId = sessionStorage.getItem('open_salary_payment_id');
        if (openPaymentId) {
          sessionStorage.removeItem('open_salary_payment_id');
          const matched = myList.find(p => p.id === openPaymentId);
          if (matched) {
            if (matched.acknowledgmentStatus === 'pending') {
              setAcknowledgingPayment(matched);
            } else {
              setSelectedPayslip(matched);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not load salary data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, currentUser?.uid]);

  // Net payable calculation formula
  const payableTotal = baseSalary + allowances + bonus - advanceDeduction - otherDeduction;

  const handleOpenPayModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setPayMonth(selectedMonth);
    setBaseSalary(teacher.baseSalary || 12000);
    setAllowances(0);
    setBonus(0);
    setAdvanceDeduction(0);
    setOtherDeduction(0);
    setRemarks('');
    setIsPayModalOpen(true);
  };

  // Check duplicate payment in the form
  const existingPaymentForTeacherAndMonth = selectedTeacher
    ? payments.find(p => p.teacherId === selectedTeacher.teacherId && p.month === payMonth && p.paymentStatus !== 'cancelled')
    : null;

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !payMonth) return;

    if (existingPaymentForTeacherAndMonth) {
      alert(
        isBn 
          ? `সতর্কতা: ${selectedTeacher.fullName}-এর ${payMonth} মাসের বেতন ইতিমধ্যে পরিশোধ করা হয়েছে (ভাউচার: ${existingPaymentForTeacherAndMonth.voucherNumber})!`
          : `Warning: Salary for ${payMonth} has already been paid for this teacher!`
      );
      return;
    }

    setIsSubmittingPay(true);
    try {
      const voucherNumber = `SAL-${payMonth}-${Date.now().toString().slice(-4)}`;
      const today = getTodayDateString();

      // Find teacher auth UID
      let teacherUid = selectedTeacher.userId;
      if (!teacherUid) {
        const matchedUser = allUsers.find(u => 
          u.teacherId === selectedTeacher.teacherId ||
          u.teacherDocId === selectedTeacher.id ||
          (selectedTeacher.email && u.email && u.email.toLowerCase() === selectedTeacher.email.toLowerCase()) ||
          (selectedTeacher.phone && u.phoneNumber && u.phoneNumber.replace(/\D/g, '') === selectedTeacher.phone.replace(/\D/g, ''))
        );
        if (matchedUser) {
          teacherUid = matchedUser.uid;
        }
      }

      const paymentRecord: Omit<SalaryPayment, 'id'> = {
        voucherNumber,
        teacherId: selectedTeacher.teacherId,
        teacherName: selectedTeacher.fullName,
        teacherUid: teacherUid || undefined,
        teacherDocId: selectedTeacher.id,
        designation: selectedTeacher.designation,
        department: selectedTeacher.department,
        month: payMonth,
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
        paymentStatus: 'paid',
        acknowledgmentStatus: 'pending',
        receiptNumber: `REC-${voucherNumber}`,
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
        description: `${selectedTeacher.fullName} (${selectedTeacher.teacherId}) - ${payMonth} মাসের বেতন পরিশোধ`,
        recordedBy: currentUser?.displayName || 'Accountant',
        linkedPaymentId: voucherNumber,
        createdAt: new Date().toISOString()
      });

      // Send supplementary notification to the teacher
      if (teacherUid) {
        const notifTitle = isBn ? 'বেতন পরিশোধের বিজ্ঞপ্তি' : 'Salary Payment Notification';
        const notifMessage = isBn
          ? `আপনার ${formatSalaryMonth(payMonth, true)} মাসের বেতন ${formatBDT(payableTotal, true)} পরিশোধ করা হয়েছে। বিস্তারিত দেখতে আপনার বেতন ও পে-রোল পেজে প্রবেশ করুন।`
          : `Your salary of ${formatBDT(payableTotal, false)} for ${formatSalaryMonth(payMonth, false)} has been paid. Visit your Salary & Payroll page to view the details and confirm receipt.`;

        await addDoc(collection(db, 'notifications'), {
          title: notifTitle,
          message: notifMessage,
          type: 'salary_payment',
          read: false,
          linkPage: 'teacherSalary',
          targetUid: teacherUid,
          salaryPaymentId: docRef.id,
          salaryMonth: payMonth,
          createdAt: new Date().toISOString()
        });
      }

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
        details: `${selectedTeacher.fullName}-এর ${payMonth} মাসের বেতন প্রদান (ভাউচার: ${voucherNumber}, মোট: ৳${payableTotal})`
      });

      setIsPayModalOpen(false);
      setSelectedPayslip({ id: docRef.id, ...paymentRecord });
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'বেতন পরিশোধে সমস্যা: ' : 'Failed to pay salary: ') + err.message);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Admin: Send reminder notification to teacher
  const handleSendReminder = async (payment: SalaryPayment) => {
    // Anti-spam debounce: check if reminder was sent in last 2 hours
    if (payment.lastReminderSentAt) {
      const lastSent = new Date(payment.lastReminderSentAt).getTime();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (Date.now() - lastSent < twoHoursMs) {
        setFeedbackMessage(
          isBn
            ? 'ইতিমধ্যে সম্প্রতি রিমাইন্ডার পাঠানো হয়েছে। পুনরায় পাঠানোর পূর্বে অপেক্ষা করুন।'
            : 'A reminder was sent recently. Please wait before sending again.'
        );
        setTimeout(() => setFeedbackMessage(null), 4000);
        return;
      }
    }

    setReminderSendingId(payment.id);
    try {
      let targetUid = payment.teacherUid;
      if (!targetUid) {
        const tObj = teachers.find(t => t.teacherId === payment.teacherId);
        targetUid = tObj?.userId;
      }

      if (targetUid) {
        const notifTitle = isBn ? 'বেতন গ্রহণের স্বীকৃতি রিমাইন্ডার' : 'Salary Acknowledgment Reminder';
        const notifMessage = isBn
          ? `আপনার ${formatSalaryMonth(payment.month, true)} মাসের বেতন ${formatBDT(payment.paidAmount, true)} পরিশোধিত রয়েছে। অনুগ্রহ করে বেতন ও পে-রোল পেজে গিয়ে ডিজিটাল স্বাক্ষর সম্পন্ন করুন।`
          : `Your salary for ${formatSalaryMonth(payment.month, false)} has been paid. Please visit your Salary & Payroll page to confirm receipt and sign digitally.`;

        await addDoc(collection(db, 'notifications'), {
          title: notifTitle,
          message: notifMessage,
          type: 'salary_reminder',
          read: false,
          linkPage: 'teacherSalary',
          targetUid,
          salaryPaymentId: payment.id,
          salaryMonth: payment.month,
          createdAt: new Date().toISOString()
        });

        // Update lastReminderSentAt
        await updateDoc(doc(db, 'salary_payments', payment.id), {
          lastReminderSentAt: new Date().toISOString()
        });

        setFeedbackMessage(
          isBn
            ? `${payment.teacherName}-কে সফলভাবে রিমাইন্ডার পাঠানো হয়েছে।`
            : `Reminder sent to ${payment.teacherName} successfully.`
        );
        setTimeout(() => setFeedbackMessage(null), 4000);
        await loadData();
      } else {
        alert(
          isBn
            ? 'এই শিক্ষকের অ্যাকাউন্ট এখনো সিস্টেম অ্যাকাউন্টের সাথে লিংক করা হয়নি।'
            : 'This teacher account is not yet linked to a system user.'
        );
      }
    } catch (err: any) {
      console.error("Error sending reminder:", err);
      alert((isBn ? 'রিমাইন্ডার পাঠাতে ব্যর্থ: ' : 'Failed to send reminder: ') + err.message);
    } finally {
      setReminderSendingId(null);
    }
  };

  const handleExportExcel = () => {
    const rows = teachers.map((t, idx) => {
      const payment = payments.find(p => p.teacherId === t.teacherId);
      const ackStatus = !payment
        ? (isBn ? 'অপরিশোধিত' : 'Due')
        : payment.acknowledgmentStatus === 'acknowledged'
        ? (isBn ? 'স্বীকৃত (ডিজিটাল স্বাক্ষরিত)' : 'Acknowledged')
        : (isBn ? 'অপেক্ষমান' : 'Awaiting Confirmation');

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
        'পরিশোধ স্ট্যাটাস': payment ? 'পরিশোধিত' : 'অপরিশোধিত',
        'স্বীকৃতি স্ট্যাটাস': ackStatus,
        'ভাউচার নং': payment?.voucherNumber || '-',
        'স্বীকৃতির সময়': payment?.acknowledgedAt || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary');
    XLSX.writeFile(workbook, `JMNIM_Salary_${selectedMonth}.xlsx`);
  };

  // Admin calculations
  const totalPaidSum = payments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const acknowledgedPayments = payments.filter(p => p.acknowledgmentStatus === 'acknowledged');
  const pendingAcknowledgmentPayments = payments.filter(p => p.acknowledgmentStatus === 'pending');
  const totalAcknowledgedAmount = acknowledgedPayments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const totalPendingAmount = pendingAcknowledgmentPayments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

  // Admin filtered teachers
  const filteredTeachers = teachers.filter(t => {
    const payment = payments.find(p => p.teacherId === t.teacherId);
    
    // Status filter
    if (adminStatusFilter === 'pending' && (!payment || payment.acknowledgmentStatus !== 'pending')) return false;
    if (adminStatusFilter === 'acknowledged' && (!payment || payment.acknowledgmentStatus !== 'acknowledged')) return false;
    if (adminStatusFilter === 'due' && payment) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.fullName.toLowerCase().includes(q);
      const matchId = t.teacherId.toLowerCase().includes(q);
      const matchDept = (t.department || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDept) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'শিক্ষক বেতন ও পে-রোল ব্যবস্থাপনা' : 'Teacher Salary & Payroll Management'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'মাসিক বেতন পরিশোধ, ডিজিটাল প্রাপ্তি স্বীকৃতি ও পে-স্লিপ প্রিন্ট ব্যবস্থাপনা' 
              : 'Monthly payroll calculation, digital receipt acknowledgment and electronic signature'}
          </p>
        </div>

        {/* Header Right Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dual Tab (Admin Management vs My Salary) */}
          {isAccountantOrAdmin && myLinkedTeacher && (
            <div className="flex bg-slate-200 p-0.5 rounded-lg border border-slate-300 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('admin_payroll')}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === 'admin_payroll'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'পে-রোল অ্যাডমিন' : 'Admin Payroll'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('my_salary')}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === 'my_salary'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'আমার ব্যক্তিগত বেতন' : 'My Personal Salary'}
              </button>
            </div>
          )}

          {/* Month Picker for Admin */}
          {activeTab === 'admin_payroll' && isAccountantOrAdmin && (
            <>
              <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  title={isBn ? 'বেতনের মাস নির্বাচন করুন' : 'Select Salary Month'}
                />
              </div>

              <button
                onClick={handleExportExcel}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isBn ? 'এক্সেল' : 'Export'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-medium flex items-center space-x-2 animate-fadeIn no-print">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* =========================================================================
          SECTION A: TEACHER'S PERSONAL SALARY DASHBOARD (My Salary)
          ========================================================================= */}
      {(activeTab === 'my_salary' || isTeacherOnly) && (
        <div className="space-y-6">
          {/* Teacher Profile Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-lg text-amber-300">
                  {myLinkedTeacher?.fullName?.slice(0, 1) || 'T'}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold flex items-center space-x-2">
                    <span>{myLinkedTeacher?.fullName || currentUser?.displayName || 'সম্মানিত উস্তাদ'}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                      {myLinkedTeacher?.teacherId || userProfile?.teacherId || 'ID: -'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {myLinkedTeacher?.designation || 'শিক্ষক'} {myLinkedTeacher?.department ? `• ${myLinkedTeacher.department}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <Wallet className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-[10px] text-slate-300 block">{isBn ? 'নির্ধারিত মূল বেতন' : 'Base Salary'}</span>
                  <span className="text-base font-black text-amber-300">
                    {formatBDT(myLinkedTeacher?.baseSalary || 0, isBn)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher Salary Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">{isBn ? 'মোট পরিশোধিত বেতন রেকর্ড' : 'Total Paid Records'}</span>
              <span className="text-xl font-bold text-slate-900">{teacherPayments.length} {isBn ? 'টি মাস' : 'Months'}</span>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-xs">
              <span className="text-xs text-amber-800 block">{isBn ? 'স্বীকৃতি অপেক্ষমান' : 'Awaiting Confirmation'}</span>
              <span className="text-xl font-bold text-amber-900">
                {teacherPayments.filter(p => p.acknowledgmentStatus === 'pending').length} {isBn ? 'টি মাস' : ''}
              </span>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-xs text-emerald-800 block">{isBn ? 'স্বীকৃত ও সম্পন্ন' : 'Receipts Confirmed'}</span>
              <span className="text-xl font-bold text-emerald-900">
                {teacherPayments.filter(p => p.acknowledgmentStatus === 'acknowledged').length} {isBn ? 'টি মাস' : ''}
              </span>
            </div>
          </div>

          {/* Personal Salary Records List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {isBn ? 'আমার বেতন প্রাপ্তি ইতিহাস ও রশিদ' : 'My Salary Payment History & Receipts'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'আপনার নামে প্রস্তুতকৃত প্রতিটি মাসের বেতন দেখুন, বুঝে পাওয়ার পর ই-স্বাক্ষর দিয়ে প্রাপ্তি নিশ্চিত করুন।'
                    : 'View all paid monthly salaries, confirm receipt with digital signature, and download receipts.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3.5 px-4">{isBn ? 'বেতনের মাস' : 'Salary Month'}</th>
                    <th className="py-3.5 px-4">{isBn ? 'পরিশোধের তারিখ ও মাধ্যম' : 'Payment Date & Method'}</th>
                    <th className="py-3.5 px-4 text-right">{isBn ? 'মূল বেতন' : 'Base'}</th>
                    <th className="py-3.5 px-4 text-right">{isBn ? 'ভাতা ও বোনাস' : 'Allowances'}</th>
                    <th className="py-3.5 px-4 text-right">{isBn ? 'কর্তন' : 'Deductions'}</th>
                    <th className="py-3.5 px-4 text-right">{isBn ? 'পরিশোধিত নিট টাকা' : 'Net Paid Amount'}</th>
                    <th className="py-3.5 px-4 text-center">{isBn ? 'স্বীকৃতি স্ট্যাটাস' : 'Acknowledgment'}</th>
                    <th className="py-3.5 px-4 text-right">{isBn ? 'পদক্ষেপ' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {isBn ? 'লোড হচ্ছে...' : 'Loading...'}
                      </td>
                    </tr>
                  ) : teacherPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                        <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm font-medium">
                          {isBn ? 'কোনো বেতন পরিশোধ রেকর্ড পাওয়া যায়নি।' : 'No salary records found for your account.'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {isBn ? 'প্রশাসক কর্তৃক বেতন পরিশোধ রেকর্ড করা হলে এখানে প্রদর্শিত হবে।' : 'Paid salaries will automatically appear here once processed by Admin.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    teacherPayments.map((payment) => {
                      const isAck = payment.acknowledgmentStatus === 'acknowledged';
                      const isPending = payment.acknowledgmentStatus === 'pending';
                      const isLegacy = !payment.acknowledgmentStatus || payment.acknowledgmentStatus === 'legacy';

                      return (
                        <tr key={payment.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <span className="text-blue-700">{formatSalaryMonth(payment.month, isBn)}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">{payment.voucherNumber}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            <div>{formatDate(payment.paymentDate, isBn)}</div>
                            <span className="text-[10px] text-slate-400 uppercase font-mono">{payment.paymentMethod}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                            {formatBDT(payment.baseSalary, isBn)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-emerald-700">
                            +{formatBDT(payment.allowances + payment.bonus, isBn)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-rose-600">
                            -{formatBDT(payment.advanceDeduction + payment.otherDeduction, isBn)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-emerald-800 text-sm">
                            {formatBDT(payment.paidAmount, isBn)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isAck ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isBn ? 'বেতন বুঝে পেয়েছেন' : 'Acknowledged'}</span>
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>{isBn ? 'স্বীকৃতি অপেক্ষমান' : 'Awaiting Confirmation'}</span>
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {isBn ? 'পুরোনো বেতন রেকর্ড - ডিজিটাল স্বাক্ষর সংরক্ষিত নেই' : 'Legacy Payment - No Digital Acknowledgment'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {isPending && (
                                <button
                                  onClick={() => setAcknowledgingPayment(payment)}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>{isBn ? 'বেতন গ্রহণ নিশ্চিত করুন' : 'Confirm Salary Receipt'}</span>
                                </button>
                              )}

                              {isAck && (
                                <button
                                  onClick={() => setSelectedPayslip(payment)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                                >
                                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{isBn ? 'স্বাক্ষরিত রশিদ' : 'Signed Receipt'}</span>
                                </button>
                              )}

                              {isLegacy && (
                                <button
                                  onClick={() => setSelectedPayslip(payment)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>{isBn ? 'পে-স্লিপ' : 'Payslip'}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION B: ADMIN PAYROLL DASHBOARD (Authorized Admin / Accountant View)
          ========================================================================= */}
      {activeTab === 'admin_payroll' && isAccountantOrAdmin && (
        <div className="space-y-6">
          {/* Admin Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">{isBn ? 'চলতি মাসে সর্বমোট প্রদত্ত বেতন' : 'Total Salary Paid This Month'}</span>
              <span className="text-xl font-black text-slate-900">{formatBDT(totalPaidSum, isBn)}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {payments.length} / {teachers.length} {isBn ? 'জন শিক্ষক পরিশোধিত' : 'Teachers Paid'}
              </span>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-xs">
              <span className="text-xs text-amber-800 block">{isBn ? 'স্বীকৃতি অপেক্ষমান টাকা' : 'Awaiting Acknowledgment Amount'}</span>
              <span className="text-xl font-black text-amber-900">{formatBDT(totalPendingAmount, isBn)}</span>
              <span className="text-[10px] text-amber-700 mt-1 block">
                {pendingAcknowledgmentPayments.length} {isBn ? 'জন শিক্ষক এখনো নিশ্চিত করেননি' : 'Teachers Pending'}
              </span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-xs text-emerald-800 block">{isBn ? 'স্বীকৃত ও পরিশোধিত টাকা' : 'Total Acknowledged Amount'}</span>
              <span className="text-xl font-black text-emerald-900">{formatBDT(totalAcknowledgedAmount, isBn)}</span>
              <span className="text-[10px] text-emerald-700 mt-1 block">
                {acknowledgedPayments.length} {isBn ? 'জন শিক্ষক ই-স্বাক্ষর সম্পন্ন করেছেন' : 'Teachers Confirmed'}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">{isBn ? 'নিবন্ধিত মোট শিক্ষক' : 'Total Teachers'}</span>
              <span className="text-xl font-black text-slate-800">{teachers.length} {isBn ? 'জন' : ''}</span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {formatSalaryMonth(selectedMonth, isBn)}
              </span>
            </div>
          </div>

          {/* Admin Table Controls & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAdminStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  adminStatusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isBn ? 'সকল শিক্ষক' : 'All Teachers'} ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1 ${
                  adminStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isBn ? 'অপেক্ষমান' : 'Awaiting Confirmation'}</span>
                <span>({pendingAcknowledgmentPayments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('acknowledged')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1 ${
                  adminStatusFilter === 'acknowledged'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'স্বীকৃত' : 'Acknowledged'}</span>
                <span>({acknowledgedPayments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminStatusFilter('due')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  adminStatusFilter === 'due'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                {isBn ? 'অপরিশোধিত' : 'Due / Unpaid'} ({teachers.length - payments.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'নাম বা আইডি দিয়ে খুঁজুন...' : 'Search by name or ID...'}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Admin Teachers Salary Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">{isBn ? 'শিক্ষক আইডি ও নাম' : 'Teacher ID & Name'}</th>
                    <th className="py-3 px-3">{isBn ? 'পদবি ও বিভাগ' : 'Designation & Dept'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'মূল বেতন' : 'Base Salary'}</th>
                    <th className="py-3 px-3 text-center">{isBn ? 'পরিশোধ স্ট্যাটাস' : 'Payment Status'}</th>
                    <th className="py-3 px-3">{isBn ? 'পরিশোধের বিবরণ' : 'Payment Info'}</th>
                    <th className="py-3 px-3 text-center">{isBn ? 'প্রাপ্তি স্বীকৃতি স্ট্যাটাস' : 'Acknowledgment'}</th>
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
                  ) : filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {isBn ? 'কোনো শিক্ষক পাওয়া যায়নি।' : 'No teachers matched your filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher, idx) => {
                      const payment = payments.find(p => p.teacherId === teacher.teacherId);
                      const isPaid = Boolean(payment);
                      const isAck = payment?.acknowledgmentStatus === 'acknowledged';
                      const isPending = payment?.acknowledgmentStatus === 'pending';
                      const isLegacy = payment && (!payment.acknowledgmentStatus || payment.acknowledgmentStatus === 'legacy');

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
                          <td className="py-3 px-3 text-center">
                            {isPaid && payment ? (
                              isAck ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>{isBn ? 'বেতন বুঝে পেয়েছেন' : 'Acknowledged'}</span>
                                  </span>
                                  {payment.acknowledgedAt && (
                                    <span className="text-[9px] text-slate-400 block">
                                      {new Date(payment.acknowledgedAt).toLocaleTimeString(isBn ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              ) : isPending ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                    <span>{isBn ? 'অপেক্ষমান' : 'Awaiting'}</span>
                                  </span>
                                  <button
                                    onClick={() => handleSendReminder(payment)}
                                    disabled={reminderSendingId === payment.id}
                                    className="block mx-auto text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline"
                                    title={isBn ? 'শিক্ষককে রিমাইন্ডার নোটিফিকেশন পাঠান' : 'Send Reminder Notification'}
                                  >
                                    {reminderSendingId === payment.id 
                                      ? (isBn ? 'পাঠানো হচ্ছে...' : 'Sending...') 
                                      : (isBn ? '🔔 রিমাইন্ডার' : '🔔 Remind')}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  {isBn ? 'পুরোনো রেকর্ড' : 'Legacy Record'}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isPaid && payment ? (
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => setSelectedPayslip(payment)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                  title={isAck ? (isBn ? 'স্বাক্ষরিত রশিদ দেখুন' : 'View Signed Receipt') : (isBn ? 'পে-স্লিপ প্রিন্ট করুন' : 'Print Payslip')}
                                >
                                  {isAck ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Printer className="w-3.5 h-3.5" />}
                                  <span>{isAck ? (isBn ? 'স্বাক্ষরিত রশিদ' : 'Signed Receipt') : (isBn ? 'পে-স্লিপ' : 'Payslip')}</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenPayModal(teacher)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
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
        </div>
      )}

      {/* =========================================================================
          SECTION C: PAY TEACHER SALARY MODAL (Admin Execution)
          ========================================================================= */}
      {isPayModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'শিক্ষক বেতন পরিশোধ ফর্ম' : 'Pay Teacher Salary Form'}</span>
              </h3>
              <button 
                onClick={() => setIsPayModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs">
              
              {/* Teacher Info & Selectable Month Field */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">{isBn ? 'শিক্ষকের নাম ও আইডি:' : 'Teacher:'}</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {selectedTeacher.fullName} 
                      <span className="text-blue-600 font-mono text-xs ml-1">({selectedTeacher.teacherId})</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedTeacher.designation} {selectedTeacher.department ? `• ${selectedTeacher.department}` : ''}
                    </p>
                  </div>

                  {/* Month Picker Field */}
                  <div className="text-right">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isBn ? 'বেতনের মাস নির্বাচন করুন:' : 'Select Salary Month:'}
                    </label>
                    <input
                      type="month"
                      value={payMonth}
                      onChange={(e) => setPayMonth(e.target.value)}
                      required
                      className="px-2.5 py-1.5 border border-blue-400 rounded-lg text-xs font-bold text-blue-900 bg-white shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-blue-700 block font-semibold mt-0.5">
                      {formatSalaryMonth(payMonth, isBn)}
                    </span>
                  </div>
                </div>

                {/* Duplicate Payment Warning Banner */}
                {existingPaymentForTeacherAndMonth && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-start space-x-2 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        {isBn ? 'সতর্কতা: ইতিমধ্যে বেতন পরিশোধিত!' : 'Warning: Duplicate Payment Detected!'}
                      </span>
                      <p className="text-[11px] leading-relaxed">
                        {isBn
                          ? `এই শিক্ষকের জন্য ${formatSalaryMonth(payMonth, true)} মাসের বেতন ইতিমধ্যে পরিশোধ করা হয়েছে (ভাউচার: ${existingPaymentForTeacherAndMonth.voucherNumber}, স্ট্যাটাস: ${existingPaymentForTeacherAndMonth.paymentStatus})। পুনরাবৃত্তি এড়াতে পরিশোধ নিষ্ক্রিয় করা হয়েছে।`
                          : `Salary for ${formatSalaryMonth(payMonth, false)} has already been paid for this teacher (Voucher: ${existingPaymentForTeacherAndMonth.voucherNumber}, Status: ${existingPaymentForTeacherAndMonth.paymentStatus}). Duplicate payment blocked.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Salary Breakdown Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'মূল বেতন (৳)' : 'Base Salary (BDT)'}</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'ভাতা (House/Medical) ৳' : 'Allowances (BDT)'}</label>
                  <input
                    type="number"
                    value={allowances}
                    onChange={(e) => setAllowances(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-emerald-700 font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'বোনাস ৳' : 'Bonus (BDT)'}</label>
                  <input
                    type="number"
                    value={bonus}
                    onChange={(e) => setBonus(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-emerald-700 font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'অগ্রিম কর্তন ৳' : 'Advance Deduction'}</label>
                  <input
                    type="number"
                    value={advanceDeduction}
                    onChange={(e) => setAdvanceDeduction(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-rose-600 font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'অন্যান্য কর্তন ৳' : 'Other Deduction'}</label>
                  <input
                    type="number"
                    value={otherDeduction}
                    onChange={(e) => setOtherDeduction(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-rose-600 font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Net Payable Highlight */}
              <div className="p-3 bg-emerald-50 text-emerald-950 border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                <div>
                  <span className="font-bold text-xs block">{isBn ? 'সর্বমোট প্রদেয় নিট বেতন:' : 'Net Payable Salary:'}</span>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    {isBn ? 'স্বয়ংক্রিয় ক্যাশবহি খরচে যুক্ত হবে' : 'Automatically recorded to Cashbook'}
                  </span>
                </div>
                <span className="text-xl font-black text-emerald-800">{formatBDT(payableTotal, isBn)}</span>
              </div>

              {/* Payment Method & Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'পরিশোধ মাধ্যম' : 'Payment Method'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
                    <option value="bank">{isBn ? 'ব্যাংক ট্রান্সফার (Bank Transfer)' : 'Bank Transfer'}</option>
                    <option value="bkash">বিকাশ (bKash)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">{isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Remarks (Optional)'}</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={isBn ? 'কোনো নোট থাকলে লিখুন...' : 'Notes...'}
                    className="w-full px-3 py-1.5 border rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  disabled={isSubmittingPay}
                  className="px-4 py-2 border rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={Boolean(existingPaymentForTeacherAndMonth) || isSubmittingPay}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md transition ${
                    existingPaymentForTeacherAndMonth || isSubmittingPay
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                >
                  {isSubmittingPay 
                    ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Processing...') 
                    : (isBn ? 'বেতন পরিশোধ নিশ্চিত করুন' : 'Confirm Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION D: TEACHER SALARY ACKNOWLEDGMENT & SIGNATURE MODAL
          ========================================================================= */}
      {acknowledgingPayment && (
        <TeacherAcknowledgmentModal
          payment={acknowledgingPayment}
          teacherName={acknowledgingPayment.teacherName}
          teacherId={acknowledgingPayment.teacherId}
          designation={acknowledgingPayment.designation || myLinkedTeacher?.designation}
          department={acknowledgingPayment.department || myLinkedTeacher?.department}
          userUid={currentUser?.uid || ''}
          settings={{
            institutionName: settings.institutionName,
            institutionNameEn: settings.institutionNameEn
          }}
          language={language}
          onClose={() => setAcknowledgingPayment(null)}
          onSuccess={(updatedPayment) => {
            setAcknowledgingPayment(null);
            // Refresh local state immediately
            setTeacherPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));
            setPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));
            // Open official signed receipt
            setSelectedPayslip(updatedPayment);
          }}
        />
      )}

      {/* =========================================================================
          SECTION E: PRINTABLE SALARY RECEIPT / PAYSLIP MODAL
          ========================================================================= */}
      {selectedPayslip && (
        <SalaryReceiptModal
          payment={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          settings={{
            institutionName: settings.institutionName,
            institutionNameEn: settings.institutionNameEn,
            address: settings.address,
            phone: settings.phone
          }}
          language={language}
        />
      )}

    </div>
  );
};