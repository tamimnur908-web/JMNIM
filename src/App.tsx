import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SettingsProvider } from './context/SettingsContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { Loader2 } from 'lucide-react';

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

const MainLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const { currentUser, loading } = useAuth();

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

  if (!currentUser) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={(p) => setCurrentPage(p)} />;
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
