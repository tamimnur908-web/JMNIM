import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Users, 
  GraduationCap, 
  MapPin, 
  Receipt, 
  Bell,
  ArrowUpRight,
  ShieldAlert,
  Wallet,
  BookOpen,
  CalendarCheck
} from 'lucide-react';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';

export const DashboardPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [teacherCount, setTeacherCount] = useState<number>(0);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [todayPresent, setTodayPresent] = useState<number>(0);
  const [todayLate, setTodayLate] = useState<number>(0);
  const [todayFees, setTodayFees] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const today = getTodayDateString();

        // 1. Teachers count
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        setTeacherCount(teachersSnap.size);

        // 2. Students count
        const studentsSnap = await getDocs(query(collection(db, 'students'), where('isArchived', '!=', true)));
        setStudentCount(studentsSnap.size);

        // 3. Today's Teacher Attendance
        const attQuery = query(collection(db, 'teacher_attendance_events'), where('date', '==', today));
        const attSnap = await getDocs(attQuery);
        let present = 0;
        let late = 0;
        attSnap.forEach(doc => {
          const data = doc.data();
          if (data.eventType === 'check_in') {
            present++;
            if (data.status === 'late') late++;
          }
        });
        setTodayPresent(present);
        setTodayLate(late);

        // 4. Today's Fee Collection
        const feesQuery = query(collection(db, 'fee_payments'), where('paymentDate', '==', today));
        const feesSnap = await getDocs(feesQuery);
        let feeSum = 0;
        feesSnap.forEach(doc => {
          feeSum += (doc.data().paidAmount || 0);
        });
        setTodayFees(feeSum);

        // 5. Pending Approvals
        const appSnap = await getDocs(query(collection(db, 'student_approval_requests'), where('status', '==', 'pending')));
        setPendingApprovalsCount(appSnap.size);

        // 6. Cashbook Balance
        const txSnap = await getDocs(collection(db, 'cash_transactions'));
        let income = 0;
        let expense = 0;
        txSnap.forEach(doc => {
          const d = doc.data();
          if (d.type === 'income') income += (d.amount || 0);
          else if (d.type === 'expense') expense += (d.amount || 0);
        });
        setCashBalance(income - expense);

        // 7. Notices
        const noticesSnap = await getDocs(collection(db, 'notices'));
        const nList: any[] = [];
        noticesSnap.forEach(d => nList.push({ id: d.id, ...d.data() }));
        setRecentNotices(nList.slice(0, 3));

      } catch (err) {
        console.warn("Dashboard data query handled safely (starting empty):", err);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Super Admin Pending Approval Banner (Requirement 5) */}
      {isSuperAdmin && pendingApprovalsCount > 0 && (
        <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-md flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {isBn 
                  ? `${pendingApprovalsCount} টি শিক্ষার্থী পরিবর্তন/ডিলিট অনুমোদন অপেক্ষমাণ!` 
                  : `${pendingApprovalsCount} Student Edit/Delete Approval Requests Pending!`}
              </h4>
              <p className="text-xs text-amber-100">
                {isBn ? 'অন্যান্য কর্মীদের জমাকৃত অনুরোধ পর্যালোচনা করে অনুমোদন বা বাতিল করুন।' : 'Review pending change requests submitted by staff.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('students')}
            className="px-4 py-2 bg-white text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-50 shadow-sm transition"
          >
            {isBn ? 'পর্যালোচনা করুন →' : 'Review Requests →'}
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold mb-3">
            {isBn ? settings.establishedYear : 'Est: 2016'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">
            {isBn ? settings.institutionName : settings.institutionNameEn}
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm">
            {t.welcomeSubtitle}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Teachers */}
        <div 
          onClick={() => onNavigate('teachers')}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-400 transition"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">{t.totalTeachers}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {formatNumber(teacherCount, isBn)} <span className="text-xs font-normal text-slate-500">{t.personsUnit}</span>
            </h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Total Students */}
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-400 transition"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">{t.totalStudents}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {formatNumber(studentCount, isBn)} <span className="text-xs font-normal text-slate-500">{t.personsUnit}</span>
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Teacher Attendance */}
        <div 
          onClick={() => onNavigate('teacherAttendance')}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-400 transition"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">{t.todayPresentTeachers}</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-slate-900">
                {formatNumber(todayPresent, isBn)}
              </h3>
              {todayLate > 0 && (
                <span className="text-xs text-amber-600 font-medium">
                  ({formatNumber(todayLate, isBn)} {t.late})
                </span>
              )}
            </div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* Cashbook Balance / Today's Fee */}
        <div 
          onClick={() => onNavigate('accounts')}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-400 transition"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">{isBn ? 'বর্তমান ক্যাশ ব্যালেন্স' : 'Cash Balance'}</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">
              {formatBDT(cashBalance, isBn)}
            </h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center space-x-2">
          <span>{t.quickActions}</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button 
            onClick={() => onNavigate('admissions')}
            className="flex items-center justify-between p-3 bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 rounded-lg text-xs font-medium border border-blue-100 transition"
          >
            <span>{isBn ? 'নতুন ভর্তি' : 'New Admission'}</span>
            <ArrowUpRight className="w-4 h-4 text-blue-600" />
          </button>
          <button 
            onClick={() => onNavigate('feeManagement')}
            className="flex items-center justify-between p-3 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 rounded-lg text-xs font-medium border border-emerald-100 transition"
          >
            <span>{isBn ? 'ফি কালেকশন' : 'Fee Collection'}</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </button>
          <button 
            onClick={() => onNavigate('studentAttendance')}
            className="flex items-center justify-between p-3 bg-purple-50/70 hover:bg-purple-100/70 text-purple-900 rounded-lg text-xs font-medium border border-purple-100 transition"
          >
            <span>{isBn ? 'শিক্ষার্থী হাজিরা' : 'Student Attendance'}</span>
            <ArrowUpRight className="w-4 h-4 text-purple-600" />
          </button>
          <button 
            onClick={() => onNavigate('accounts')}
            className="flex items-center justify-between p-3 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 rounded-lg text-xs font-medium border border-amber-100 transition"
          >
            <span>{isBn ? 'ক্যাশ বহি' : 'Cashbook'}</span>
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
          </button>
        </div>
      </div>

      {/* Notices & Institutional Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notice Board */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>{t.notices}</span>
            </h3>
            <button 
              onClick={() => onNavigate('notices')} 
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              {t.all}
            </button>
          </div>

          {recentNotices.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              {t.emptyStateMsg}
            </div>
          ) : (
            <div className="space-y-3">
              {recentNotices.map((n) => (
                <div key={n.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-900">{n.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{n.content}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block">{n.publishDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Settings & GPS Status Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>{t.systemGpsStatus}</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">{t.scheduledCheckIn}</span>
              <span className="font-semibold text-slate-800">{formatNumber(settings.dailyCheckInTime, isBn)} AM</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">{t.scheduledCheckOut}</span>
              <span className="font-semibold text-slate-800">{formatNumber(settings.dailyCheckOutTime, isBn)} AM</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">{t.lateConsideration}</span>
              <span className="font-semibold text-slate-800">{formatNumber(settings.lateGraceMinutes, isBn)} {t.minutesUnit}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">{t.allowedRadiusLabel}</span>
              <span className="font-semibold text-slate-800">{formatNumber(settings.allowedRadiusMeters, isBn)} {t.metersUnit}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">{t.madrasaCoordinates}</span>
              <span className="font-mono text-slate-700 text-[11px]">
                {settings.gpsLat.toFixed(4)}, {settings.gpsLng.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
