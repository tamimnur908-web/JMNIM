import React, { useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  LayoutDashboard,
  GraduationCap,
  UserPlus,
  CalendarCheck,
  Users,
  ClipboardCheck,
  Receipt,
  Wallet,
  BookOpen,
  CalendarDays,
  Award,
  Bell,
  FileSpreadsheet,
  Settings,
  Database,
  ShieldCheck
} from 'lucide-react';
import { ERPModule } from '../types';

interface MobileTopNavProps {
  currentPage: string;
  onSelectPage: (page: string) => void;
}

interface NavItem {
  id: string;
  module: ERPModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

export const MobileTopNav: React.FC<MobileTopNavProps> = ({ currentPage, onSelectPage }) => {
  const { t } = useLanguage();
  const { isSuperAdmin, hasPermission, canApproveRegistrations, role } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const currentRole = role || 'staff';

  // Order starting with Teacher GPS Attendance (Check-in/Check-out), then Dashboard, then others
  const navItems: NavItem[] = [
    { id: 'teacherAttendance', module: 'attendance', label: t.teacherAttendance, icon: MapPin, roles: ['admin', 'principal', 'teacher'] },
    { id: 'dashboard', module: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'userApprovals', module: 'userApprovals', label: t.userApprovals, icon: ShieldCheck, roles: ['admin', 'principal'] },
    { id: 'students', module: 'students', label: t.students, icon: GraduationCap, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'admissions', module: 'students', label: t.admissions, icon: UserPlus, roles: ['admin', 'principal', 'teacher', 'accountant', 'staff'] },
    { id: 'studentAttendance', module: 'attendance', label: t.studentAttendance, icon: CalendarCheck, roles: ['admin', 'principal', 'teacher'] },
    { id: 'teachers', module: 'teachers', label: t.teachers, icon: Users, roles: ['admin', 'principal'] },
    { id: 'attendanceAudit', module: 'attendance', label: t.attendanceAudit, icon: ClipboardCheck, roles: ['admin', 'principal'] },
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

  const allowedItems = navItems.filter(item => {
    if (isSuperAdmin) return true;
    if (item.id === 'userApprovals') {
      return canApproveRegistrations || hasPermission('userApprovals', 'view');
    }
    const roleMatch = item.roles.includes(currentRole);
    const permMatch = hasPermission(item.module, 'view');
    return roleMatch && permMatch;
  });

  // Automatically scroll the active item into view horizontally
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentPage]);

  return (
    <div className="lg:hidden w-full bg-slate-900 border-b border-slate-800 shadow-md shrink-0 no-print">
      <div 
        ref={scrollContainerRef}
        className="flex items-center space-x-2 px-3 py-2 overflow-x-auto no-scrollbar scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              ref={isActive ? activeTabRef : null}
              type="button"
              onClick={() => onSelectPage(item.id)}
              className={`
                shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all select-none
                ${isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50 scale-102 ring-1 ring-blue-400'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }
              `}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
