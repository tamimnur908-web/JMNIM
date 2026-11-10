import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SettingsProvider } from './context/SettingsContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileTopNav } from './components/MobileTopNav';
import { LoginPage } from './pages/LoginPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { UserApprovalsPage } from './pages/UserApprovalsPage';
import { Loader2, ShieldAlert } from 'lucide-react';

// All 16 Sidebar Modules
import { DashboardPage } from './pages/DashboardPage';
import { TeacherAttendancePage } from './pages/TeacherAttendancePage';
import { TeacherManagementPage } from './pages/TeacherManagementPage';
import { AttendanceAuditPage } from './pages/AttendanceAuditPage';
import { StudentManagementPage } from './pages/StudentManagementPage';
import { AdmissionPage } from './pages/AdmissionPage';
import { StudentAttendancePage } from './pages/StudentAttendancePage';
import { FeeManagementPage } from './pages/FeeManagementPage';
import { TeacherSalaryPage } from './pages/TeacherSalaryPage';
import { AccountsCashbookPage } from './pages/AccountsCashbookPage';
import { ClassRoutinePage } from './pages/ClassRoutinePage';
import { ExamsResultsPage } from './pages/ExamsResultsPage';
import { NoticeBoardPage } from './pages/NoticeBoardPage';
import { CentralReportsPage } from './pages/CentralReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BackupRestorePage } from './pages/BackupRestorePage';
import { ERPModule, isPendingStatus } from './types';
import { useSettings } from './context/SettingsContext';
import { runAttendanceSentinel } from './utils/attendanceSentinel';

const PAGE_MODULE_MAP: Record<string, ERPModule> = {
  dashboard: 'dashboard',
  teacherAttendance: 'attendance',
  teachers: 'teachers',
  attendanceAudit: 'attendance',
  students: 'students',
  admissions: 'students',
  studentAttendance: 'attendance',
  feeManagement: 'fees',
  teacherSalary: 'payroll',
  accounts: 'accounts',
  routines: 'academic',
  exams: 'academic',
  notices: 'notices',
  reports: 'reports',
  settings: 'settings',
  backupRestore: 'backupRestore',
  userApprovals: 'userApprovals',
};

const MainLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('teacherAttendance');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const { currentUser, userProfile, isSuperAdmin, canApproveRegistrations, loading, hasPermission } = useAuth();
  const { settings } = useSettings();

  // Background attendance sentinel timer (every 60 seconds)
  useEffect(() => {
    if (!currentUser || !settings) return;
    runAttendanceSentinel(settings);
    const interval = setInterval(() => {
      runAttendanceSentinel(settings);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser, settings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4 font-bengali">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
        <div className="text-center">
          <p className="text-base font-bold">লোড হচ্ছে...</p>
          <p className="text-xs text-slate-400 mt-1">জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসা</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show LoginPage
  if (!currentUser) {
    return <LoginPage />;
  }

  // CRITICAL REQUIREMENT: Block access before approval or if disabled/rejected!
  // If user is pending, rejected, or disabled and not Super Admin, show PendingApprovalPage
  if (!isSuperAdmin && userProfile && (
    isPendingStatus(userProfile) || 
    userProfile.status === 'rejected' || 
    userProfile.approvalStatus === 'rejected' ||
    userProfile.accountStatus === 'rejected' ||
    userProfile.status === 'disabled' ||
    userProfile.accountStatus === 'disabled'
  )) {
    return <PendingApprovalPage />;
  }

  // Check if current user has permission for the module
  const targetModule = PAGE_MODULE_MAP[currentPage];
  const isAuthorized = isSuperAdmin || (targetModule ? hasPermission(targetModule, 'view') : true);

  const renderContent = () => {
    if (!isAuthorized && targetModule) {
      return (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm font-bengali">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">অ্যাক্সেস অনুমোদিত নয় (Access Restricted)</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            এই মডিউলটি দেখার জন্য আপনার অ্যাকাউন্টে পর্যাপ্ত অনুমতি (Permission) প্রদান করা হয়নি। বিস্তারিত তথ্যের জন্য মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
          </p>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
          >
            ড্যাশবোর্ডে ফিরে যান
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={(p) => setCurrentPage(p)} />;
      case 'userApprovals':
        return <UserApprovalsPage />;
      case 'teacherAttendance':
        return <TeacherAttendancePage />;
      case 'teachers':
        return <TeacherManagementPage />;
      case 'attendanceAudit':
        return <AttendanceAuditPage />;
      case 'students':
        return <StudentManagementPage onNavigateToAdmission={() => setCurrentPage('admissions')} />;
      case 'admissions':
        return <AdmissionPage onNavigateToStudents={() => setCurrentPage('students')} />;
      case 'studentAttendance':
        return <StudentAttendancePage />;
      case 'feeManagement':
        return <FeeManagementPage />;
      case 'teacherSalary':
        return <TeacherSalaryPage />;
      case 'accounts':
        return <AccountsCashbookPage />;
      case 'routines':
        return <ClassRoutinePage />;
      case 'exams':
        return <ExamsResultsPage />;
      case 'notices':
        return <NoticeBoardPage />;
      case 'reports':
        return <CentralReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'backupRestore':
        return <BackupRestorePage />;
      default:
        return <DashboardPage onNavigate={(p) => setCurrentPage(p)} />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col fixed inset-0">
      <Header 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        onNavigate={(p) => setCurrentPage(p)}
      />
      <MobileTopNav 
        currentPage={currentPage}
        onSelectPage={(p) => setCurrentPage(p)}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar 
          currentPage={currentPage}
          onSelectPage={(p) => setCurrentPage(p)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto pb-16">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SettingsProvider>
          <MainLayout />
        </SettingsProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
