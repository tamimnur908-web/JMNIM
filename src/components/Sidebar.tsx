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
  X
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onSelectPage: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage, isOpen, onClose }) => {
  const { t, language } = useLanguage();
  const { role } = useAuth();

  const currentRole = role || 'admin';

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: ['admin', 'principal', 'teacher', 'accountant'] },
    { id: 'teacherAttendance', label: t.teacherAttendance, icon: MapPin, roles: ['admin', 'principal', 'teacher'] },
    { id: 'teachers', label: t.teachers, icon: Users, roles: ['admin', 'principal'] },
    { id: 'attendanceAudit', label: t.attendanceAudit, icon: ClipboardCheck, roles: ['admin', 'principal'] },
    { id: 'students', label: t.students, icon: GraduationCap, roles: ['admin', 'principal', 'teacher', 'accountant'] },
    { id: 'admissions', label: t.admissions, icon: UserPlus, roles: ['admin', 'principal', 'teacher', 'accountant'] },
    { id: 'studentAttendance', label: t.studentAttendance, icon: CalendarCheck, roles: ['admin', 'principal', 'teacher'] },
    { id: 'feeManagement', label: t.feeManagement, icon: Receipt, roles: ['admin', 'principal', 'accountant'] },
    { id: 'teacherSalary', label: t.teacherSalary, icon: Wallet, roles: ['admin', 'principal', 'accountant', 'teacher'] },
    { id: 'accounts', label: t.accounts, icon: BookOpen, roles: ['admin', 'accountant'] },
    { id: 'routines', label: t.routines, icon: CalendarDays, roles: ['admin', 'principal', 'teacher'] },
    { id: 'exams', label: t.exams, icon: Award, roles: ['admin', 'principal', 'teacher'] },
    { id: 'notices', label: t.notices, icon: Bell, roles: ['admin', 'principal', 'teacher', 'accountant'] },
    { id: 'reports', label: t.reports, icon: FileSpreadsheet, roles: ['admin', 'principal', 'accountant'] },
    { id: 'settings', label: t.settings, icon: Settings, roles: ['admin'] },
    { id: 'backupRestore', label: t.backupRestore, icon: Database, roles: ['admin'] },
  ];

  const allowedItems = navItems.filter(item => item.roles.includes(currentRole));

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
                  w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="truncate">{t.roleLabel}: <b className="text-amber-400">{t[currentRole] || currentRole}</b></span>
          <span className="text-slate-500 font-mono">v1.0</span>
        </div>
      </aside>
    </>
  );
};
