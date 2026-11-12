import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Globe, 
  Clock, 
  Shield, 
  LogOut, 
  Menu, 
  ChevronDown, 
  CheckCircle,
  Bell,
  ExternalLink
} from 'lucide-react';
import { NotificationItem } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  onNavigate?: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const { language, setLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, userProfile, role, isSuperAdmin, logout } = useAuth();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Load Notifications
  const loadNotifications = async () => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const list: NotificationItem[] = [];
      snap.forEach(d => {
        const n = { id: d.id, ...d.data() } as NotificationItem;
        // User specific notification (e.g., approval/rejection results)
        if (n.targetUid && n.targetUid !== currentUser?.uid) return;
        // Role specific notification (e.g., approval requests to admin/principal)
        if (n.targetRole && Array.isArray(n.targetRole)) {
          const isApprover = isSuperAdmin || (role && n.targetRole.includes(role)) || (settings?.approverUids && currentUser?.uid && settings.approverUids.includes(currentUser.uid));
          if (!isApprover) return;
        }
        list.push(n);
      });
      list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setNotifications(list.slice(0, 15));
    } catch (err) {
      // safe fallback
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const resolveNotificationTargetPage = (notif: NotificationItem): string | undefined => {
    if (notif.linkPage === 'attendance') {
      return 'teacherAttendance';
    }
    if (notif.linkPage) {
      return notif.linkPage;
    }
    switch (notif.type as string) {
      case 'missed_checkout':
      case 'auto_checkout':
      case 'leave_request':
      case 'leave_approved':
      case 'leave_rejected':
        return 'teacherAttendance';
      case 'salary_payment':
      case 'salary_reminder':
      case 'salary_acknowledged':
        return 'teacherSalary';
      case 'approval_request':
      case 'user_registration':
      case 'account_approval':
        return 'userApprovals';
      case 'student_edit_request':
      case 'student_delete_request':
        return 'students';
      default:
        return undefined;
    }
  };

  const handleMarkAsRead = async (notif: NotificationItem) => {
    const targetPage = resolveNotificationTargetPage(notif);

    if (!notif.read) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      } catch (err) {
        console.warn("Could not mark notif as read:", err);
      }
    }

    if (targetPage && onNavigate) {
      setNotifOpen(false);
      if (notif.applicantUid) {
        sessionStorage.setItem('open_approval_uid', notif.applicantUid);
      }
      if (notif.salaryPaymentId) {
        sessionStorage.setItem('open_salary_payment_id', notif.salaryPaymentId);
        window.dispatchEvent(new CustomEvent('open_salary_payment', { detail: { paymentId: notif.salaryPaymentId } }));
      }
      onNavigate(targetPage);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      const formatted = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', options).format(now);
      setTimeStr(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleLabels: Record<string, string> = {
    admin: language === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin',
    principal: t.principal,
    teacher: t.teacher,
    accountant: t.accountant,
    staff: language === 'bn' ? 'স্টাফ' : 'Staff',
  };

  // Determine avatar photo URL (Guaranteed to show photo for admin, Google photo for google users)
  const getAvatarUrl = (): string => {
    if (currentUser?.photoURL) return currentUser.photoURL;
    if (userProfile?.photoURL) return userProfile.photoURL;
    const providerPhoto = currentUser?.providerData?.find(p => p.photoURL)?.photoURL;
    if (providerPhoto) return providerPhoto;
    
    // Always fallback to admin profile picture from user upload
    return '/admin-avatar.png';
  };

  const avatarUrl = getAvatarUrl();

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  return (
    <header className="min-h-[3.75rem] sm:h-16 w-full bg-white border-b border-slate-200 shrink-0 z-30 shadow-sm no-print">
      <div className="min-h-[3.75rem] sm:h-full px-2.5 sm:px-5 py-1.5 sm:py-0 flex items-center justify-between gap-2">
        {/* Left Side: Mobile toggle & Institution Branding */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0 flex-1">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none shrink-0"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border border-blue-900/10 shadow-sm shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-base font-bold text-slate-900 leading-snug truncate">
                {language === 'bn' ? settings.institutionName : settings.institutionNameEn}
              </h1>
              <p className="text-[10px] sm:text-xs text-amber-700 font-medium truncate">
                {language === 'bn' ? settings.establishedYear : 'Est: 2016'} • {language === 'bn' ? 'ডিজিটাল ম্যানেজমেন্ট' : 'Digital Portal'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Clock, Language, Super Admin Badge & Profile Capsule */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          {/* Real-time Clock (Asia/Dhaka) */}
          <div className="hidden lg:flex items-center text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-700 animate-pulse" />
            <span>{timeStr}</span>
            <span className="ml-1 text-[10px] text-slate-400 font-mono">
              {language === 'bn' ? 'ঢাকা' : 'Dhaka'}
            </span>
          </div>

          {/* Dual Language Switcher (বাংলা / English Segmented Pill) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition ${
                language === 'bn'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="বাংলা ভাষা সক্রিয় করুন"
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition ${
                language === 'en'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Activate English Language"
            >
              EN
            </button>
          </div>

          {/* Notification Center Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="p-1.5 sm:p-2 rounded-full border border-slate-200 hover:bg-slate-50 transition relative text-slate-600 hover:text-blue-600 focus:outline-none"
              title={language === 'bn' ? 'বিজ্ঞপ্তি ও অনুমোদন কেন্দ্র' : 'Notifications'}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown (Responsive positioning for 320px-1920px) */}
            {notifOpen && (
              <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">
                    {language === 'bn' ? 'বিজ্ঞপ্তি ও অনুমোদন' : 'Notifications'}
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                      {unreadCount} {language === 'bn' ? 'টি নতুন' : 'new'}
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      {language === 'bn' ? 'কোনো নতুন বিজ্ঞপ্তি নেই।' : 'No notifications.'}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n)}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition space-y-1 ${
                          !n.read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${!n.read ? 'text-blue-900' : 'text-slate-800'}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{n.message}</p>
                        {Boolean(n.salaryPaymentId || n.linkPage === 'teacherSalary') && (
                          <div className="pt-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 text-white rounded-md text-[10px] font-bold shadow-xs hover:bg-blue-700 transition">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              {language === 'bn' ? 'বেতনের বিবরণ দেখুন' : 'View Salary Details'}
                            </span>
                          </div>
                        )}
                        <span className="text-[9px] text-slate-400 block">{new Date(n.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Role Badge (Hidden on small mobile to avoid overlapping institution title; visible inside profile menu) */}
          {role && (
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-semibold shadow-xs">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>{role === 'admin' ? (language === 'bn' ? 'প্রধান প্রশাসক (Admin)' : 'Super Admin') : (roleLabels[role] || role)}</span>
            </div>
          )}

          {/* User Profile Pill: [ (avatar)  v ] */}
          {currentUser && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 p-0.5 sm:p-1 pr-1.5 sm:pr-3 transition shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 group"
                title={language === 'bn' ? 'প্রোফাইল মেনু' : 'Profile Menu'}
              >
                {/* Circular Profile Picture */}
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-200 object-cover shadow-xs shrink-0 bg-slate-100" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== window.location.origin + '/admin-avatar.png') {
                      target.src = '/admin-avatar.png';
                    }
                  }}
                />

                {/* Downward Arrow */}
                <ChevronDown 
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 ml-1 sm:ml-2 transition-transform duration-200 group-hover:text-slate-800 ${
                    dropdownOpen ? 'rotate-180 text-blue-700' : ''
                  }`} 
                />
              </button>

              {/* Dropdown Menu when clicking the pill */}
              {dropdownOpen && (
                <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 sm:w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn">
                  {/* User Profile Details */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/70">
                    <img 
                      src={avatarUrl} 
                      alt="Profile" 
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full border-2 border-white object-cover shadow-sm shrink-0" 
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {currentUser.displayName || (role === 'admin' ? (language === 'bn' ? 'প্রধান প্রশাসক (Admin)' : 'Super Admin') : (language === 'bn' ? 'ইউজার' : 'User'))}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                        {currentUser.email || currentUser.phoneNumber || ''}
                      </p>
                      <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-semibold">
                        <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{language === 'bn' ? 'সক্রিয় অ্যাকাউন্ট' : 'Active Account'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown Logout Action */}
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center text-red-600 transition">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold leading-none">লগআউট (Log Out)</p>
                        <p className="text-[10px] text-red-400 font-normal mt-0.5">সিস্টেম থেকে বের হন</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
