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
  addDoc, 
  onSnapshot, 
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
  Key,
  RefreshCw,
  Wrench,
  Check,
  Ban,
  Slash,
  Eye,
  CheckCircle
} from 'lucide-react';
import { 
  UserProfile, 
  UserRole, 
  UserStatus, 
  ERPModule, 
  PermissionAction, 
  UserPermissions, 
  RegistrationRequest,
  isPendingStatus
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Review Modal State
  const [selectedUser, setSelectedUser] = useState<UserProfile | RegistrationRequest | null>(null);
  const [assignedRole, setAssignedRole] = useState<UserRole>('teacher');
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [modalMode, setModalMode] = useState<'review' | 'reject'>('review');
  const [saving, setSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Controlled Repair Preview State
  const [repairCandidates, setRepairCandidates] = useState<UserProfile[]>([]);
  const [repairing, setRepairing] = useState(false);
  const [repairSuccessMsg, setRepairSuccessMsg] = useState<string | null>(null);

  const processAndMergeData = (uList: UserProfile[], rSnapDocs: RegistrationRequest[]) => {
    const reqMap = new Map<string, RegistrationRequest>();
    rSnapDocs.forEach(d => {
      reqMap.set(d.uid || d.id, d);
    });

    const candidates: UserProfile[] = [];
    for (const u of uList) {
      const isAdm = u.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3' || u.email?.toLowerCase() === 'tamimnur908@gmail.com';
      if ((isPendingStatus(u.status) || isPendingStatus(u.accountStatus) || u.approvalStatus === 'pending') && !isAdm) {
        if (!reqMap.has(u.uid)) {
          candidates.push(u);
          // Synthesize in-memory representation for display in pending list
          const now = new Date().toISOString();
          const fallbackMethod = u.registrationMethod || (u.email?.includes('@gmail.com') ? 'google' : (u.phoneNumber ? 'phone' : 'email'));
          reqMap.set(u.uid, {
            id: u.uid,
            uid: u.uid,
            displayName: u.displayName || 'ইউজার',
            email: u.email,
            phoneNumber: u.phoneNumber,
            photoURL: u.photoURL,
            registrationMethod: fallbackMethod,
            registrationDate: u.createdAt || now,
            status: 'pending',
            createdAt: u.createdAt || now
          });
        }
      }
    }

    setRepairCandidates(candidates);
    const reqList = Array.from(reqMap.values());
    reqList.sort((a, b) => ((b.registrationDate || b.createdAt) > (a.registrationDate || a.createdAt) ? 1 : -1));
    setRequests(reqList);

    // Auto-open review modal if user clicked an approval notification
    const openUid = sessionStorage.getItem('open_approval_uid');
    if (openUid) {
      const target = reqList.find(r => r.uid === openUid || r.id === openUid) || uList.find(u => u.uid === openUid);
      if (target) {
        sessionStorage.removeItem('open_approval_uid');
        openReviewModal(target);
      }
    }
  };

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    let latestUsers: UserProfile[] = [];
    let latestReqs: RegistrationRequest[] = [];

    // Real-time listener for users
    const unsubUsers = onSnapshot(collection(db, 'users'), (uSnap) => {
      const uList: UserProfile[] = [];
      uSnap.forEach(d => {
        uList.push({ uid: d.id, ...d.data() } as UserProfile);
      });
      uList.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
      latestUsers = uList;
      setUsersList(uList);
      processAndMergeData(latestUsers, latestReqs);
      setLoading(false);
    }, (err) => {
      console.warn("User onSnapshot error:", err);
      setFetchError(err.message || 'ইউজার তথ্য লোড ব্যর্থ');
      setLoading(false);
    });

    // Real-time listener for registration_requests
    const unsubReqs = onSnapshot(collection(db, 'registration_requests'), (rSnap) => {
      const rList: RegistrationRequest[] = [];
      rSnap.forEach(d => {
        rList.push({ id: d.id, ...d.data() } as RegistrationRequest);
      });
      latestReqs = rList;
      processAndMergeData(latestUsers, latestReqs);
      setLoading(false);
    }, (err) => {
      console.warn("Registration request onSnapshot error:", err);
      setFetchError(err.message || 'নিবন্ধন রিকোয়েস্ট লোড ব্যর্থ');
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubReqs();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const userSnap = await getDocs(collection(db, 'users'));
      const uList: UserProfile[] = [];
      userSnap.forEach(d => uList.push({ uid: d.id, ...d.data() } as UserProfile));
      uList.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
      setUsersList(uList);

      const reqSnap = await getDocs(collection(db, 'registration_requests'));
      const rList: RegistrationRequest[] = [];
      reqSnap.forEach(d => rList.push({ id: d.id, ...d.data() } as RegistrationRequest));

      processAndMergeData(uList, rList);
    } catch (err: any) {
      console.error("Could not load registration requests:", err);
      setFetchError(err.message || 'অনুরোধ তালিকা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Controlled Repair Execution (Triggered only by Admin action)
  const handleExecuteRepair = async (targetUser?: UserProfile) => {
    const listToRepair = targetUser ? [targetUser] : repairCandidates;
    if (listToRepair.length === 0) return;

    setRepairing(true);
    setRepairSuccessMsg(null);
    try {
      for (const u of listToRepair) {
        const now = new Date().toISOString();
        const fallbackMethod = u.registrationMethod || (u.email?.includes('@gmail.com') ? 'google' : (u.phoneNumber ? 'phone' : 'email'));
        const regReq: RegistrationRequest = {
          id: u.uid,
          uid: u.uid,
          displayName: u.displayName || 'ইউজার',
          email: u.email || undefined,
          phoneNumber: u.phoneNumber || undefined,
          photoURL: u.photoURL || undefined,
          registrationMethod: fallbackMethod,
          registrationDate: u.createdAt || now,
          status: 'pending',
          createdAt: u.createdAt || now
        };
        await setDoc(doc(db, 'registration_requests', u.uid), regReq, { merge: true });

        // Add targeted notification for approvers
        try {
          await addDoc(collection(db, 'notifications'), {
            title: `নতুন ইউজার নিবন্ধন আবেদন (${fallbackMethod.toUpperCase()})`,
            message: `${u.displayName} (${u.email || u.phoneNumber || 'অ্যাকাউন্ট'}) সিস্টেম ব্যবহারের অনুমোদনের জন্য অপেক্ষমাণ।`,
            type: 'approval_request',
            linkPage: 'userApprovals',
            applicantUid: u.uid,
            applicantName: u.displayName,
            registrationMethod: fallbackMethod,
            targetRole: ['admin', 'principal'],
            read: false,
            createdAt: now
          });
        } catch (nErr) {
          console.warn("Notification error during repair:", nErr);
        }

        // Audit log
        await logAudit({
          action: 'Pending Registration Request Repaired',
          module: 'User Approvals & Access Control',
          recordId: u.uid,
          recordType: 'RegistrationRequest',
          performedBy: currentUser?.displayName || 'Admin',
          performedByRole: role || 'admin',
          performedByUid: currentUser?.uid,
          details: `নিবন্ধিত অপেক্ষমাণ অ্যাকাউন্ট (${u.displayName}, ${u.email || u.phoneNumber}) মেরামত ও সিঙ্ক করা হয়েছে।`
        });
      }

      setRepairSuccessMsg(isBn ? 'অপেক্ষমাণ অ্যাকাউন্টের রিকোয়েস্ট সফলভাবে মেরামত ও ডাটাবেজে সংরক্ষণ করা হয়েছে।' : 'Missing registration requests repaired successfully.');
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'মেরামত করতে সমস্যা: ' : 'Repair error: ') + err.message);
    } finally {
      setRepairing(false);
    }
  };

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
        accountStatus: 'active',
        approvalStatus: 'approved',
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
        accountStatus: 'active',
        approvalStatus: 'approved',
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

      // 4. Notify Applicant of Approval
      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে!',
          message: `মুবারকবাদ! মাদরাসা কর্তৃপক্ষ আপনার নিবন্ধন অনুমোদন করেছেন। নির্ধারিত রোল: ${assignedRole.toUpperCase()}`,
          type: 'approval_result',
          targetUid: uid,
          read: false,
          createdAt: now
        });
      } catch (nErr) {
        console.warn("Could not send applicant notification:", nErr);
      }

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
        accountStatus: 'rejected',
        approvalStatus: 'rejected',
        rejectionReason: rejectionReason.trim() || 'কর্তৃপক্ষ কর্তৃক আবেদনটি গৃহীত হয়নি',
        updatedAt: now
      });

      // 2. Update registration request
      const reqDocRef = doc(db, 'registration_requests', uid);
      await updateDoc(reqDocRef, {
        status: 'rejected',
        accountStatus: 'rejected',
        approvalStatus: 'rejected',
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

      // 4. Notify Applicant of Rejection
      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'নিবন্ধন আবেদন সংক্রান্ত নোটিশ',
          message: `আপনার অ্যাকাউন্ট আবেদনটি কর্তৃপক্ষ কর্তৃক গৃহীত হয়নি। কারণ: ${rejectionReason.trim() || 'কর্তৃপক্ষের সিদ্ধান্ত'}`,
          type: 'approval_result',
          targetUid: uid,
          read: false,
          createdAt: now
        });
      } catch (nErr) {
        console.warn("Could not send applicant notification:", nErr);
      }

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

  const handleToggleUserStatus = async (user: UserProfile) => {
    const isUAdmin = user.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3' || user.email?.toLowerCase() === 'tamimnur908@gmail.com';
    if (isUAdmin) {
      alert(isBn ? 'প্রধান প্রশাসকের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।' : 'Cannot disable Super Admin account.');
      return;
    }
    const isCurrentlyActive = user.status === 'active' || user.accountStatus === 'active';
    const willDisable = isCurrentlyActive;
    const confirmMsg = willDisable
      ? (isBn ? `${user.displayName}-এর অ্যাকাউন্ট সাময়িকভাবে নিষ্ক্রিয় (Disable) করতে চান? ইউজার সিস্টেম ব্যবহার করতে পারবেন না।` : `Disable account for ${user.displayName}? User will lose access to the system.`)
      : (isBn ? `${user.displayName}-এর অ্যাকাউন্ট পুনরায় সক্রিয় (Enable) করতে চান?` : `Re-enable account for ${user.displayName}?`);
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const newStatus: UserStatus = willDisable ? 'disabled' : 'active';
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.uid), {
        status: newStatus,
        accountStatus: newStatus,
        updatedAt: now
      });

      await logAudit({
        action: willDisable ? 'User Account Disabled' : 'User Account Enabled',
        module: 'User Approvals & Access Control',
        recordId: user.uid,
        recordType: 'UserProfile',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `ইউজার ${user.displayName} (${user.email || user.phoneNumber || ''}) এর স্ট্যাটাস '${newStatus}'-এ পরিবর্তন করা হয়েছে।`
      });

      await loadData();
    } catch (err: any) {
      alert((isBn ? 'স্ট্যাটাস পরিবর্তনে সমস্যা: ' : 'Status update error: ') + err.message);
    }
  };

  const handleRevokeAccess = async (user: UserProfile) => {
    const isUAdmin = user.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3' || user.email?.toLowerCase() === 'tamimnur908@gmail.com';
    if (isUAdmin) {
      alert(isBn ? 'প্রধান প্রশাসকের এক্সেস প্রত্যাহার করা যাবে না।' : 'Cannot revoke Super Admin access.');
      return;
    }
    const confirmMsg = isBn 
      ? `সতর্কতা: ${user.displayName}-এর সমস্ত মডিউল পারমিশন প্রত্যাহার (Revoke) করে অ্যাকাউন্ট নিষ্ক্রিয় করতে চান?` 
      : `Warning: Revoke all module permissions and disable access for ${user.displayName}?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.uid), {
        status: 'disabled',
        accountStatus: 'disabled',
        permissions: {},
        updatedAt: now
      });

      await logAudit({
        action: 'User Access Revoked',
        module: 'User Approvals & Access Control',
        recordId: user.uid,
        recordType: 'UserProfile',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `ইউজার ${user.displayName}-এর সমস্ত পারমিশন প্রত্যাহার এবং অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।`
      });

      await loadData();
    } catch (err: any) {
      alert((isBn ? 'এক্সেস প্রত্যাহারে সমস্যা: ' : 'Revoke error: ') + err.message);
    }
  };

  // Tab 1: ONLY pending applications
  const pendingRequests = requests.filter(r => 
    (isPendingStatus(r.status) || isPendingStatus(r.accountStatus) || r.approvalStatus === 'pending') &&
    r.status !== 'approved' &&
    r.status !== 'rejected' &&
    r.approvalStatus !== 'approved' &&
    r.approvalStatus !== 'rejected'
  );

  // Tab 2: ONLY approved users. Pending and rejected users must NEVER appear.
  const approvedUsers = usersList.filter(u => {
    // Exclude if pending
    if (isPendingStatus(u.status) || isPendingStatus(u.accountStatus) || u.approvalStatus === 'pending') {
      return false;
    }
    // Exclude if rejected
    if (u.status === 'rejected' || u.accountStatus === 'rejected' || u.approvalStatus === 'rejected') {
      return false;
    }
    // Must be active or disabled (or approvalStatus === 'approved')
    return u.status === 'active' || u.status === 'disabled' || u.accountStatus === 'active' || u.accountStatus === 'disabled' || u.approvalStatus === 'approved';
  });

  const filteredApprovedUsers = approvedUsers.filter(u => 
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
          {/* CONTROLLED REPAIR PREVIEW (Requirement 6) */}
          {repairCandidates.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                      {isBn ? `মেরামত প্রিভিউ: ${repairCandidates.length} টি অপেক্ষমাণ অ্যাকাউন্টের রিকোয়েস্ট সিঙ্ক করা প্রয়োজন` : `Repair Preview: ${repairCandidates.length} Pending Account(s) Missing Approval Request`}
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      {isBn ? 'এই অ্যাকাউন্টগুলো পূর্বে নিবন্ধিত হয়ে পেন্ডিং অবস্থায় আছে কিন্তু রিকোয়েস্ট ডকুমেন্টে যুক্ত ছিল না। নিচে বিস্তারিত যাচাই করে নিশ্চিত করুন।' : 'These accounts are registered as pending in users collection. Review below and approve repair.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleExecuteRepair()}
                  disabled={repairing}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 disabled:opacity-50 shadow-xs"
                >
                  {repairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isBn ? "সকল মেরামত অনুমোদন ও সম্পন্ন করুন" : "Approve & Execute Repair"}</span>
                </button>
              </div>

              {repairSuccessMsg && (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{repairSuccessMsg}</span>
                </div>
              )}

              {/* Repair Candidate List Table */}
              <div className="overflow-x-auto bg-white/90 rounded-xl border border-amber-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/70 text-amber-900 font-bold">
                    <tr>
                      <th className="py-2 px-3">{isBn ? "আবেদনকারী" : "Applicant"}</th>
                      <th className="py-2 px-3">{isBn ? "যোগাযোগ" : "Contact"}</th>
                      <th className="py-2 px-3">{isBn ? "নিবন্ধন তারিখ" : "Date"}</th>
                      <th className="py-2 px-3 font-mono">UID</th>
                      <th className="py-2 px-3 text-right">{isBn ? "অ্যাকশন" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {repairCandidates.map((c) => (
                      <tr key={c.uid} className="hover:bg-amber-50/50">
                        <td className="py-2 px-3 font-bold text-slate-900">{c.displayName}</td>
                        <td className="py-2 px-3 text-slate-600">{c.email || c.phoneNumber || '-'}</td>
                        <td className="py-2 px-3 text-slate-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{c.uid}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleExecuteRepair(c)}
                            disabled={repairing}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold"
                          >
                            {isBn ? "মেরামত করুন" : "Repair"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <h3 className="font-bold text-xs sm:text-sm text-slate-800">
                {isBn ? "অনুমোদনের অপেক্ষায় থাকা নতুন আবেদনসমূহ" : "Pending User Registrations Awaiting Approval"}
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-500 font-semibold">
                {isBn ? `মোট : ${pendingRequests.length} টি আবেদন` : `Total: ${pendingRequests.length} requests`}
              </span>
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                title={isBn ? "রিফ্রেশ" : "Refresh"}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span>{isBn ? "তথ্য লোড ও আবেদন যাচাই হচ্ছে..." : "Loading requests and verifying applicants..."}</span>
            </div>
          ) : fetchError ? (
            <div className="p-8 text-center space-y-3 bg-red-50/50 border-b border-red-100">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-sm font-bold text-red-800">
                {isBn ? "আবেদন তালিকা লোড করতে সমস্যা হয়েছে" : "Failed to load approval requests"}
              </p>
              <p className="text-xs text-red-600 max-w-md mx-auto">{fetchError}</p>
              <button
                type="button"
                onClick={loadData}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isBn ? "পুনরায় চেষ্টা করুন" : "Retry"}</span>
              </button>
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
          {/* Search Bar & Summary */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 flex-1">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isBn ? "অনুমোদিত ইউজার খুঁজুন (নাম, ইমেইল বা ফোন নম্বর)..." : "Search approved users by name, email, or phone..."}
                className="w-full text-xs sm:text-sm focus:outline-none"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold px-2 shrink-0">
              {isBn ? `অনুমোদিত ইউজার : ${filteredApprovedUsers.length} জন` : `Approved Users: ${filteredApprovedUsers.length}`}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredApprovedUsers.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  {isBn ? "কোনো অনুমোদিত ইউজার পাওয়া যায়নি" : "No approved users found"}
                </p>
                <p className="text-xs text-slate-400">
                  {isBn ? "নতুন আবেদন অনুমোদন পেলে এখানে প্রদর্শিত হবে।" : "Users will appear here once approved by an administrator."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">{isBn ? "ব্যবহারকারী" : "User"}</th>
                      <th className="py-3 px-4">{isBn ? "যোগাযোগ" : "Contact"}</th>
                      <th className="py-3 px-4">{isBn ? "নির্ধারিত রোল" : "Assigned Role"}</th>
                      <th className="py-3 px-4">{isBn ? "পারমিশন এক্সেস" : "Permissions"}</th>
                      <th className="py-3 px-4">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                      <th className="py-3 px-4">{isBn ? "অনুমোদন ও তারিখ" : "Approved By & Date"}</th>
                      <th className="py-3 px-4 text-right">{isBn ? "অ্যাকশন" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApprovedUsers.map((u) => {
                      const isUAdmin = u.role === 'admin' || u.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3' || u.email?.toLowerCase() === 'tamimnur908@gmail.com';
                      const isActive = u.status === 'active' || u.accountStatus === 'active';
                      const activeModuleCount = Object.keys(u.permissions || {}).filter(m => (u.permissions as any)[m]?.length > 0).length;

                      return (
                        <tr key={u.uid} className={`transition ${!isActive ? 'bg-slate-50/60 opacity-80' : 'hover:bg-slate-50/70'}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">
                                {u.displayName?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{u.displayName}</div>
                                {isUAdmin ? (
                                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                                    {isBn ? "প্রধান প্রশাসক" : "Super Admin"}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[120px]">
                                    {u.uid}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 space-y-0.5">
                            {u.email && <div className="text-slate-800">{u.email}</div>}
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
                            <button
                              type="button"
                              onClick={() => openReviewModal(u)}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition"
                            >
                              {activeModuleCount > 0 
                                ? (isBn ? `${activeModuleCount} টি মডিউল সক্রিয়` : `${activeModuleCount} Modules`)
                                : (isBn ? "কোনো পারমিশন নেই" : "No Permissions")}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                              isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                              <span>{isActive ? (isBn ? "সক্রিয়" : "ACTIVE") : (isBn ? "নিষ্ক্রিয়" : "DISABLED")}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] space-y-0.5">
                            <div className="font-medium text-slate-700">{u.approvedByName || (isUAdmin ? 'System Owner' : '—')}</div>
                            <div className="text-[10px] text-slate-400">
                              {u.approvedAt ? new Date(u.approvedAt).toLocaleDateString() : (u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '')}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Edit Permissions / Role */}
                              <button
                                type="button"
                                onClick={() => openReviewModal(u)}
                                title={isBn ? "রোল ও পারমিশন পরিবর্তন" : "Edit Role & Permissions"}
                                className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Enable / Disable */}
                              {!isUAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserStatus(u)}
                                  title={isActive ? (isBn ? "অ্যাকাউন্ট নিষ্ক্রিয় করুন" : "Disable Account") : (isBn ? "অ্যাকাউন্ট সক্রিয় করুন" : "Enable Account")}
                                  className={`p-1.5 rounded-lg border transition ${
                                    isActive
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                </button>
                              )}

                              {/* Revoke Access */}
                              {!isUAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeAccess(u)}
                                  title={isBn ? "এক্সেস প্রত্যাহার ও নিষ্ক্রিয়" : "Revoke Access"}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition"
                                >
                                  <Slash className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
