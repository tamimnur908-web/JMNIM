import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  MapPin,
  ClipboardCheck,
  GraduationCap,
  UserPlus,
  CalendarCheck,
  Receipt,
  Wallet,
  BookOpen,
  CalendarDays,
  Award,
  Bell,
  FileSpreadsheet,
  Settings,
  Database,
  ShieldCheck,
  X
} from 'lucide-react';
import { ERPModule } from '../types';

interface SidebarProps {
  currentPage: string;
  onSelectPage: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  module: ERPModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage, isOpen, onClose }) => {
  const { t, language } = useLanguage();
  const { isSuperAdmin, hasPermission, canApproveRegistrations, role } = useAuth();

  const currentRole = role || 'staff';

  const navItems: NavItem[] = [
    { id: 'teacherAttendance', module: 'attendance', label: t.teacherAttendance, icon: MapPin, roles: ['admin', 'principal', 'teacher'] },
    { id: 'dashboard', module: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'userApprovals', module: 'userApprovals', label: t.userApprovals, icon: ShieldCheck, roles: ['admin', 'principal'] },
    { id: 'teachers', module: 'teachers', label: t.teachers, icon: Users, roles: ['admin', 'principal'] },
    { id: 'attendanceAudit', module: 'attendance', label: t.attendanceAudit, icon: ClipboardCheck, roles: ['admin', 'principal'] },
    { id: 'students', module: 'students', label: t.students, icon: GraduationCap, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'admissions', module: 'students', label: t.admissions, icon: UserPlus, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'studentAttendance', module: 'attendance', label: t.studentAttendance, icon: CalendarCheck, roles: ['admin', 'principal', 'teacher'] },
    { id: 'feeManagement', module: 'fees', label: t.feeManagement, icon: Receipt, roles: ['admin', 'principal', 'accountant'] },
    { id: 'teacherSalary', module: 'payroll', label: t.teacherSalary, icon: Wallet, roles: ['admin', 'principal', 'accountant', 'teacher'] },
    { id: 'accounts', module: 'accounts', label: t.accounts, icon: BookOpen, roles: ['admin', 'accountant'] },
    { id: 'routines', module: 'academic', label: t.routines, icon: CalendarDays, roles: ['admin', 'principal', 'teacher'] },
    { id: 'exams', module: 'academic', label: t.exams, icon: Award, roles: ['admin', 'principal', 'teacher'] },
    { id: 'notices', module: 'notices', label: t.notices, icon: Bell, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'reports', module: 'reports', label: t.reports, icon: FileSpreadsheet, roles: ['admin', 'principal', 'accountant'] },
    { id: 'settings', module: 'settings', label: t.settings, icon: Settings, roles: ['admin'] },
    { id: 'backupRestore', module: 'backupRestore', label: t.backupRestore, icon: Database, roles: ['admin'] },
  ];

  // Super Admin sees all. Others see what they are assigned and have permission for.
  const allowedItems = navItems.filter(item => {
    if (isSuperAdmin) return true;
    if (item.id === 'userApprovals') {
      return canApproveRegistrations || hasPermission('userApprovals', 'view');
    }
    // Must be allowed for their role AND have 'view' permission for the module
    const roleMatch = item.roles.includes(currentRole);
    const permMatch = hasPermission(item.module, 'view');
    return roleMatch && permMatch;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`
        fixed top-0 bottom-0 left-0 w-64 bg-slate-900 text-slate-100 z-50 flex flex-col transition-transform duration-300 ease-in-out no-print
        lg:static lg:translate-x-0 lg:h-full lg:w-64 lg:shrink-0 lg:z-20
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        {/* Brand header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <img src="/logo.png" alt="Madrasa Logo" className="w-8 h-8 rounded-full bg-white p-0.5" />
            <span className="font-bold text-sm tracking-wide text-white">
              {language === 'bn' ? 'JMNIM মাদরাসা' : 'JMNIM Madrasha'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectPage(item.id);
                  onClose();
                }}
                className={`
                  w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          {language === 'bn' ? 'মাদরাসা ম্যানেজমেন্ট সিস্টেম' : 'Madrasa Management ERP'}
        </div>
      </aside>
    </>
  );
};
