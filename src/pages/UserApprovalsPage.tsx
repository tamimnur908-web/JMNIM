import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Users, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Edit3, 
  Mail, 
  Phone, 
  Calendar,
  Lock,
  ChevronRight,
  Shield,
  Key
} from 'lucide-react';
import { 
  UserProfile, 
  UserRole, 
  UserStatus, 
  ERPModule, 
  PermissionAction, 
  UserPermissions, 
  RegistrationRequest 
} from '../types';
import { logAudit } from '../utils/auditLogger';

const ALL_MODULES: { id: ERPModule; nameBn: string; nameEn: string }[] = [
  { id: 'dashboard', nameBn: 'ড্যাশবোর্ড', nameEn: 'Dashboard' },
  { id: 'students', nameBn: 'শিক্ষার্থী ব্যবস্থাপনা ও ভর্তি', nameEn: 'Student Management & Admissions' },
  { id: 'teachers', nameBn: 'শিক্ষক ব্যবস্থাপনা ও প্রোফাইল', nameEn: 'Teacher Management & Profiles' },
  { id: 'attendance', nameBn: 'শিক্ষক ও শিক্ষার্থী হাজিরা', nameEn: 'Attendance & GPS Overrides' },
  { id: 'fees', nameBn: 'ফি কালেকশন ও মানি রসিদ', nameEn: 'Fee Collection & Money Receipts' },
  { id: 'payroll', nameBn: 'শিক্ষক বেতন ও পে-রোল', nameEn: 'Salary & Payroll' },
  { id: 'accounts', nameBn: 'হিসাব ও ক্যাশ বহি (Cashbook)', nameEn: 'Accounts & Cashbook' },
  { id: 'academic', nameBn: 'শ্রেণি, রুটিন ও পরীক্ষা ফলাফল', nameEn: 'Classes, Routines & Exams' },
  { id: 'notices', nameBn: 'নোটিশ বোর্ড', nameEn: 'Notice Board' },
  { id: 'reports', nameBn: 'সেন্ট্রাল রিপোর্টস ও ডাউনলোড', nameEn: 'Central Reports & Analytics' },
  { id: 'settings', nameBn: 'প্রতিষ্ঠান ও জিপিএস সেটিংস', nameEn: 'Institution & GPS Settings' },
  { id: 'backupRestore', nameBn: 'ব্যাকআপ ও এক্সেল ইমপোর্ট', nameEn: 'Backup, Restore & Excel Import' },
  { id: 'userApprovals', nameBn: 'ইউজার অনুমোদন ও পারমিশন কন্ট্রোল', nameEn: 'User Approvals & Permissions' },
];

const ALL_ACTIONS: { id: PermissionAction; nameBn: string; nameEn: string }[] = [
  { id: 'view', nameBn: 'দেখা (View)', nameEn: 'View' },
  { id: 'add', nameBn: 'যুক্ত করা (Add)', nameEn: 'Add' },
  { id: 'edit', nameBn: 'সম্পাদনা (Edit)', nameEn: 'Edit' },
  { id: 'delete', nameBn: 'মুছে ফেলা (Delete)', nameEn: 'Delete' },
  { id: 'approve', nameBn: 'অনুমোদন (Approve)', nameEn: 'Approve' },
  { id: 'print', nameBn: 'প্রিন্ট (Print)', nameEn: 'Print' },
  { id: 'export', nameBn: 'এক্সপোর্ট (Export)', nameEn: 'Export' },
  { id: 'import', nameBn: 'ইমপোর্ট (Import)', nameEn: 'Import' },
];

// Preset templates for quick role configuration
const PRESETS: Record<UserRole, UserPermissions> = {
  admin: {
    dashboard: ['view'],
    students: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export', 'import'],
    teachers: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export', 'import'],
    attendance: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export'],
    fees: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export'],
    payroll: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export'],
    accounts: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export', 'import'],
    academic: ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export'],
    notices: ['view', 'add', 'edit', 'delete', 'print'],
    reports: ['view', 'print', 'export'],
    settings: ['view', 'edit'],
    backupRestore: ['view', 'export', 'import'],
    userApprovals: ['view', 'approve']
  },
  principal: {
    dashboard: ['view'],
    students: ['view', 'add', 'print', 'export'],
    teachers: ['view', 'add', 'edit', 'print', 'export'],
    attendance: ['view', 'add', 'edit', 'approve', 'print'],
    fees: ['view', 'add', 'print', 'export'],
    payroll: ['view', 'print'],
    accounts: ['view', 'print'],
    academic: ['view', 'add', 'edit', 'print'],
    notices: ['view', 'add', 'edit', 'delete', 'print'],
    reports: ['view', 'print', 'export'],
    settings: ['view'],
    backupRestore: ['view'],
    userApprovals: ['view', 'approve']
  },
  teacher: {
    dashboard: ['view'],
    students: ['view', 'add', 'print'],
    teachers: ['view'],
    attendance: ['view', 'add'],
    fees: [],
    payroll: ['view'],
    accounts: [],
    academic: ['view', 'add', 'edit', 'print'],
    notices: ['view'],
    reports: [],
    settings: [],
    backupRestore: [],
    userApprovals: []
  },
  accountant: {
    dashboard: ['view'],
    students: ['view', 'add', 'print', 'export'],
    teachers: ['view'],
    attendance: ['view'],
    fees: ['view', 'add', 'edit', 'print', 'export', 'import'],
    payroll: ['view', 'add', 'edit', 'print', 'export'],
    accounts: ['view', 'add', 'edit', 'print', 'export', 'import'],
    academic: ['view'],
    notices: ['view'],
    reports: ['view', 'print', 'export'],
    settings: [],
    backupRestore: [],
    userApprovals: []
  },
  staff: {
    dashboard: ['view'],
    students: ['view', 'add'],
    teachers: [],
    attendance: ['view'],
    fees: [],
    payroll: [],
    accounts: [],
    academic: ['view'],
    notices: ['view'],
    reports: [],
    settings: [],
    backupRestore: [],
    userApprovals: []
  }
};

export const UserApprovalsPage: React.FC = () => {
  const { currentUser, isSuperAdmin, role } = useAuth();
  const { language } = useLanguage();
  const { settings, updateSettings } = useSettings();
  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'approvers'>('pending');
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Review Modal State
  const [selectedUser, setSelectedUser] = useState<UserProfile | RegistrationRequest | null>(null);
  const [assignedRole, setAssignedRole] = useState<UserRole>('teacher');
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [modalMode, setModalMode] = useState<'review' | 'reject'>('review');
  const [saving, setSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Registration Requests
      const reqSnap = await getDocs(collection(db, 'registration_requests'));
      const reqList: RegistrationRequest[] = [];
      reqSnap.forEach(d => {
        reqList.push({ id: d.id, ...d.data() } as RegistrationRequest);
      });
      reqList.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setRequests(reqList);

      // 2. Load All User Profiles
      const userSnap = await getDocs(collection(db, 'users'));
      const uList: UserProfile[] = [];
      userSnap.forEach(d => {
        uList.push({ ...d.data() } as UserProfile);
      });
      uList.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
      setUsersList(uList);
    } catch (err) {
      console.warn("Could not load registration requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReviewModal = (user: UserProfile | RegistrationRequest) => {
    setSelectedUser(user);
    setModalMode('review');
    const existingRole = (user as UserProfile).role || 'teacher';
    setAssignedRole(existingRole);
    // If permissions exist, use them; otherwise use preset template
    const existingPerms = (user as UserProfile).permissions || PRESETS[existingRole] || {};
    setPermissions(existingPerms);
    setRejectionReason('');
    setActionSuccess(null);
  };

  const openRejectModal = (user: UserProfile | RegistrationRequest) => {
    setSelectedUser(user);
    setModalMode('reject');
    setRejectionReason('');
    setActionSuccess(null);
  };

  const handleApplyPreset = (r: UserRole) => {
    setAssignedRole(r);
    setPermissions(PRESETS[r] || {});
  };

  const togglePermission = (modId: ERPModule, actId: PermissionAction) => {
    setPermissions(prev => {
      const current = prev[modId] || [];
      const updated = current.includes(actId)
        ? current.filter(a => a !== actId)
        : [...current, actId];
      return { ...prev, [modId]: updated };
    });
  };

  const handleApprove = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const uid = selectedUser.uid;
      const now = new Date().toISOString();

      // 1. Update user profile document in `users` collection
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        status: 'active',
        role: assignedRole,
        permissions: permissions,
        approvedBy: currentUser?.uid || 'Admin',
        approvedByName: currentUser?.displayName || 'Authorized Approver',
        approvedAt: now,
        updatedAt: now
      });

      // 2. Update registration request document
      const reqDocRef = doc(db, 'registration_requests', uid);
      await updateDoc(reqDocRef, {
        status: 'approved',
        assignedRole: assignedRole,
        assignedPermissions: permissions,
        reviewedBy: currentUser?.uid || 'Admin',
        reviewedByName: currentUser?.displayName || 'Authorized Approver',
        reviewedAt: now
      }).catch(() => {
        // Doc might not exist if editing an approved user
      });

      // 3. Log Audit
      await logAudit({
        action: 'User Approved & Permissions Assigned',
        module: 'User Approvals & Access Control',
        recordId: uid,
        recordType: 'UserProfile',
        performedBy: currentUser?.displayName || 'Authorized Approver',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `ইউজার ${selectedUser.displayName} (${selectedUser.email || selectedUser.phoneNumber || ''}) অনুমোদিত হয়েছে। নির্ধারিত রোল: ${assignedRole}`
      });

      setActionSuccess(isBn ? 'ইউজার সফলভাবে অনুমোদিত ও সক্রিয় করা হয়েছে।' : 'User approved and activated successfully.');
      setTimeout(() => {
        setSelectedUser(null);
        loadData();
      }, 1000);
    } catch (err: any) {
      alert((isBn ? 'অনুমোদনে সমস্যা: ' : 'Approval error: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const uid = selectedUser.uid;
      const now = new Date().toISOString();

      // 1. Update user profile to rejected
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim() || 'কর্তৃপক্ষ কর্তৃক আবেদনটি গৃহীত হয়নি',
        updatedAt: now
      });

      // 2. Update registration request
      const reqDocRef = doc(db, 'registration_requests', uid);
      await updateDoc(reqDocRef, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        reviewedBy: currentUser?.uid,
        reviewedByName: currentUser?.displayName || 'Authorized Approver',
        reviewedAt: now
      }).catch(() => {});

      // 3. Log Audit
      await logAudit({
        action: 'User Registration Rejected',
        module: 'User Approvals & Access Control',
        recordId: uid,
        recordType: 'UserProfile',
        performedBy: currentUser?.displayName || 'Authorized Approver',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        reason: rejectionReason,
        details: `ইউজার ${selectedUser.displayName}-এর আবেদন প্রত্যাখ্যান করা হয়েছে। কারণ: ${rejectionReason}`
      });

      setActionSuccess(isBn ? 'আবেদনটি প্রত্যাখ্যান করা হয়েছে।' : 'Registration rejected.');
      setTimeout(() => {
        setSelectedUser(null);
        loadData();
      }, 1000);
    } catch (err: any) {
      alert((isBn ? 'প্রত্যাখ্যানে সমস্যা: ' : 'Rejection error: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleApproverAuthority = async (userUid: string) => {
    if (!isSuperAdmin) return;
    const currentList = settings.approverUids || [];
    const updated = currentList.includes(userUid)
      ? currentList.filter(id => id !== userUid)
      : [...currentList, userUid];
    
    try {
      await updateSettings({ approverUids: updated });
    } catch (err: any) {
      alert("Error updating approver settings: " + err.message);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const filteredUsers = usersList.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.phoneNumber || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-bengali">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <span>{isBn ? "ইউজার নিবন্ধন অনুমোদন ও পারমিশন কন্ট্রোল" : "User Approvals & Permission Control"}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isBn 
              ? "নতুন আবেদনকারীদের অনুমোদন, প্রাতিষ্ঠানিক রোল প্রদান ও মডিউলভিত্তিক এক্সেস পারমিশন নির্ধারণ"
              : "Verify registration requests, assign institutional roles, and grant module-level permissions"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'pending' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isBn ? "অপেক্ষমাণ আবেদন" : "Pending Requests"}</span>
            {pendingRequests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-black animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'users' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isBn ? "সকল ইউজার ও পারমিশন" : "All Users & Access"}</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('approvers')}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
                activeTab === 'approvers' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>{isBn ? "অনুমোদন ক্ষমতা ডেলিগেশন" : "Approver Delegation"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PENDING REGISTRATION REQUESTS                           */}
      {/* ============================================================== */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <h3 className="font-bold text-xs sm:text-sm text-slate-800">
                {isBn ? "অনুমোদনের অপেক্ষায় থাকা নতুন আবেদনসমূহ" : "Pending User Registrations Awaiting Approval"}
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {isBn ? `মোট : ${pendingRequests.length} টি আবেদন` : `Total: ${pendingRequests.length} requests`}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              {isBn ? "তথ্য লোড হচ্ছে..." : "Loading requests..."}
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isBn ? "কোনো অপেক্ষমাণ নিবন্ধন আবেদন নেই" : "No pending registration requests"}
              </p>
              <p className="text-xs text-slate-400">
                {isBn ? "সকল আবেদনকারীকে অনুমোদন বা নিষ্পত্তি করা হয়েছে।" : "All registrations have been reviewed."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 text-sm">
                      {req.displayName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-slate-900">{req.displayName}</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {req.registrationMethod.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                        {req.email && (
                          <span className="flex items-center space-x-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{req.email}</span>
                          </span>
                        )}
                        {req.phoneNumber && (
                          <span className="flex items-center space-x-1 font-mono font-medium text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{req.phoneNumber}</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1 text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(req.registrationDate || req.createdAt).toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openReviewModal(req)}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center space-x-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isBn ? "রিভিউ ও অনুমোদন" : "Review & Approve"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openRejectModal(req)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>{isBn ? "প্রত্যাখ্যান" : "Reject"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ALL REGISTERED USERS & PERMISSION MANAGEMENT           */}
      {/* ============================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isBn ? "নাম, ইমেইল বা মোবাইল নম্বর দিয়ে ব্যবহারকারী খুঁজুন..." : "Search users by name, email, or phone..."}
              className="w-full text-xs sm:text-sm focus:outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{isBn ? "ব্যবহারকারী" : "User"}</th>
                    <th className="py-3 px-4">{isBn ? "যোগাযোগ" : "Contact"}</th>
                    <th className="py-3 px-4">{isBn ? "রোল" : "Role"}</th>
                    <th className="py-3 px-4">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                    <th className="py-3 px-4">{isBn ? "অনুমোদনকারী" : "Approved By"}</th>
                    <th className="py-3 px-4 text-right">{isBn ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isUAdmin = u.role === 'admin' || u.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3';
                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">
                              {u.displayName?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.displayName}</div>
                              {isUAdmin && (
                                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  {isBn ? "প্রধান প্রশাসক" : "Super Admin"}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 space-y-0.5">
                          {u.email && <div>{u.email}</div>}
                          {u.phoneNumber && <div className="font-mono text-slate-700 font-semibold">{u.phoneNumber}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'principal' ? 'bg-blue-100 text-blue-800' :
                            u.role === 'accountant' ? 'bg-emerald-100 text-emerald-800' :
                            u.role === 'teacher' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {u.role ? u.role.toUpperCase() : 'STAFF'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            u.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {u.status ? u.status.toUpperCase() : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {u.approvedByName || (isUAdmin ? 'System Owner' : '—')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openReviewModal(u)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isBn ? "পারমিশন এডিট" : "Edit Permissions"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: APPROVER DELEGATION (Super Admin Only)                 */}
      {/* ============================================================== */}
      {activeTab === 'approvers' && isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 border-b border-slate-100 pb-3">
            <Key className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm sm:text-base">
              {isBn ? "নিবন্ধন অনুমোদন ক্ষমতা কনফিগারেশন (Delegation)" : "Registration Approver Authority Delegation"}
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isBn 
              ? "সুপার অ্যাডমিন ব্যতীত কোন কোন প্রিন্সিপাল বা অ্যাডমিন নতুন আবেদনকারীদের অনুমোদন করতে পারবেন, তা নিচে টগল করে নির্দিষ্ট করুন। অননুমোদিত ইউজাররা কোনো আবেদন রিভিউ করতে পারবেন না।"
              : "Specify which Principals or secondary Admins are authorized to review and approve registrations. Users without delegated authority cannot approve accounts."}
          </p>

          <div className="divide-y divide-slate-100 mt-4">
            {usersList.filter(u => u.role === 'principal' || u.role === 'admin').map((adminUser) => {
              const isOwnerUser = adminUser.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3';
              const isDelegated = isOwnerUser || (settings.approverUids || []).includes(adminUser.uid);

              return (
                <div key={adminUser.uid} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center space-x-2">
                      <span>{adminUser.displayName}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                        {adminUser.role}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{adminUser.email || adminUser.phoneNumber}</div>
                  </div>

                  <button
                    type="button"
                    disabled={isOwnerUser}
                    onClick={() => toggleApproverAuthority(adminUser.uid)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isDelegated
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {isOwnerUser 
                      ? (isBn ? "স্থায়ী প্রধান (Permanent)" : "Owner") 
                      : isDelegated 
                      ? (isBn ? "অনুমোদন ক্ষমতা সক্রিয়" : "Authorized Approver") 
                      : (isBn ? "ক্ষমতা নেই (Disabled)" : "Unauthorized")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REVIEW & PERMISSION ASSIGNMENT MODAL                           */}
      {/* ============================================================== */}
      {selectedUser && modalMode === 'review' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>{isBn ? "ইউজার অনুমোদন ও পারমিশন অ্যাসাইন" : "Review User & Assign Permissions"}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedUser.displayName} • {selectedUser.email || selectedUser.phoneNumber || 'User'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              
              {actionSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* 1. Select Role & Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {isBn ? "১. প্রাতিষ্ঠানিক রোল নির্বাচন (Role Selection)" : "1. Assign User Role"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['teacher', 'accountant', 'staff', 'principal', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleApplyPreset(r)}
                      className={`p-2.5 rounded-xl border text-center transition font-bold ${
                        assignedRole === r
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="capitalize">{r}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Granular Module & Action Permissions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {isBn ? "২. মডিউল ও অ্যাকশন পারমিশন ম্যাট্রিক্স" : "2. Module & Action Permissions Matrix"}
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isBn ? "প্রয়োজনমতো চেকবক্স অন/অফ করুন" : "Toggle checkboxes as required"}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-xs">
                  {ALL_MODULES.map((mod) => {
                    const modPerms = permissions[mod.id] || [];
                    return (
                      <div key={mod.id} className="p-3 hover:bg-slate-50/60 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            <span>{isBn ? mod.nameBn : mod.nameEn}</span>
                          </span>

                          {/* Quick Toggle All for this module */}
                          <button
                            type="button"
                            onClick={() => {
                              const allActionIds = ALL_ACTIONS.map(a => a.id);
                              const hasAll = allActionIds.every(a => modPerms.includes(a));
                              setPermissions(prev => ({
                                ...prev,
                                [mod.id]: hasAll ? [] : allActionIds
                              }));
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-semibold self-start sm:self-auto"
                          >
                            {isBn ? "সব নির্বাচন / বাতিল" : "Toggle All"}
                          </button>
                        </div>

                        {/* Action Checkboxes */}
                        <div className="flex flex-wrap gap-2">
                          {ALL_ACTIONS.map((act) => {
                            const isChecked = modPerms.includes(act.id);
                            return (
                              <label
                                key={act.id}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition select-none flex items-center space-x-1.5 ${
                                  isChecked
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 font-bold'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(mod.id, act.id)}
                                  className="w-3 h-3 text-blue-600 rounded focus:ring-0 cursor-pointer"
                                />
                                <span>{isBn ? act.nameBn : act.nameEn}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => openRejectModal(selectedUser)}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition"
                >
                  {isBn ? "প্রত্যাখ্যান করুন" : "Reject"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{saving ? (isBn ? "সংরক্ষণ হচ্ছে..." : "Saving...") : (isBn ? "অনুমোদন ও পারমিশন নিশ্চিত করুন" : "Confirm Approval & Permissions")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REJECTION REASON MODAL                                         */}
      {/* ============================================================== */}
      {selectedUser && modalMode === 'reject' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3 text-red-600">
              <UserX className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                {isBn ? "নিবন্ধন আবেদন প্রত্যাখ্যান" : "Reject Registration Request"}
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              {isBn 
                ? `${selectedUser.displayName}-এর আবেদন প্রত্যাখ্যানের কারণ লিখুন। আবেদনকারী লগইন করলে এই কারণ দেখতে পাবেন।`
                : `Specify rejection reason for ${selectedUser.displayName}. The user will see this message upon login.`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? "প্রত্যাখ্যানের কারণ" : "Rejection Reason"}
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={isBn ? "যেমন: তথ্যের অমিল বা প্রতিষ্ঠানের কর্মী নন..." : "E.g. Profile mismatch or unrecognized staff..."}
                rows={3}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {saving ? (isBn ? "প্রত্যাখ্যান হচ্ছে..." : "Rejecting...") : (isBn ? "প্রত্যাখ্যান নিশ্চিত করুন" : "Confirm Rejection")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
