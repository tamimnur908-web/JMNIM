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
  provisionApprovedUser, 
  findRepairCandidates, 
  RepairCandidate, 
  generateNextTeacherId 
} from '../services/userProvisioningService';
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
  CheckCircle,
  Link,
  Unlink,
  UserPlus
} from 'lucide-react';
import { 
  UserProfile, 
  UserRole, 
  UserStatus, 
  ERPModule, 
  PermissionAction, 
  UserPermissions, 
  RegistrationRequest,
  Teacher,
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

  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'sync_repair' | 'approvers'>('pending');
  const [showBatchRepairConfirm, setShowBatchRepairConfirm] = useState(false);
  const [batchRepairProgress, setBatchRepairProgress] = useState<{ current: number; total: number; message: string } | null>(null);
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

  // Teacher Profile Linking State (Requirement 1)
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherDocId, setSelectedTeacherDocId] = useState<string>('');
  const [teacherLinkMode, setTeacherLinkMode] = useState<'existing' | 'new' | 'later'>('existing');
  const [newTeacherForm, setNewTeacherForm] = useState({
    teacherId: `T-${Math.floor(100 + Math.random() * 900)}`,
    fullName: '',
    phone: '',
    designation: 'সহকারী শিক্ষক',
    department: 'হিফজ',
    baseSalary: 10000,
    joiningDate: new Date().toISOString().split('T')[0]
  });

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

    // Real-time listener for teachers (Requirement 1)
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (tSnap) => {
      const tList: Teacher[] = [];
      tSnap.forEach(d => {
        tList.push({ id: d.id, ...d.data() } as Teacher);
      });
      tList.sort((a, b) => a.teacherId.localeCompare(b.teacherId));
      setTeachers(tList);
    }, (err) => {
      console.warn("Teachers onSnapshot error:", err);
    });

    return () => {
      unsubUsers();
      unsubReqs();
      unsubTeachers();
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

    // Initialize teacher linking state intelligently
    const targetUid = (user as any).uid || (user as any).id;
    const existingTeacherId = (user as UserProfile).teacherId;
    const existingTeacherDocId = (user as UserProfile).teacherDocId;

    let matched: Teacher | undefined;
    if (existingTeacherDocId) {
      matched = teachers.find(t => t.id === existingTeacherDocId);
    } else if (existingTeacherId) {
      matched = teachers.find(t => t.teacherId === existingTeacherId);
    } else {
      matched = teachers.find(t => t.userId === targetUid || (t as any).authUid === targetUid);
      if (!matched && user.email) {
        const lower = user.email.toLowerCase().trim();
        matched = teachers.find(t => t.email && t.email.toLowerCase().trim() === lower);
      }
      if (!matched && user.phoneNumber) {
        const digits = user.phoneNumber.replace(/\D/g, '');
        if (digits.length >= 8) {
          matched = teachers.find(t => t.phone && t.phone.replace(/\D/g, '') === digits);
        }
      }
    }

    if (matched) {
      setSelectedTeacherDocId(matched.id);
      setTeacherLinkMode('existing');
    } else {
      setSelectedTeacherDocId('');
      setTeacherLinkMode('new');
    }

    setNewTeacherForm({
      teacherId: matched?.teacherId || (user as UserProfile).teacherId || generateNextTeacherId(teachers),
      fullName: user.displayName || matched?.fullName || '',
      phone: user.phoneNumber || matched?.phone || '',
      designation: matched?.designation || (existingRole === 'principal' ? 'মুহতামিম / প্রধান শিক্ষক' : 'সহকারী শিক্ষক'),
      department: matched?.department || 'সাধারণ',
      baseSalary: matched?.baseSalary || 12000,
      joiningDate: matched?.joiningDate || new Date().toISOString().split('T')[0]
    });
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
    setActionSuccess(null);
    try {
      const result = await provisionApprovedUser({
        user: selectedUser,
        assignedRole,
        permissions,
        approverUid: currentUser?.uid || 'Admin',
        approverName: currentUser?.displayName || 'Authorized Approver',
        existingTeachersList: teachers,
        allUsersList: usersList,
        explicitTeacherData: (assignedRole === 'teacher' || assignedRole === 'principal') ? {
          teacherId: newTeacherForm.teacherId,
          fullName: newTeacherForm.fullName,
          phone: newTeacherForm.phone,
          designation: newTeacherForm.designation,
          department: newTeacherForm.department,
          baseSalary: newTeacherForm.baseSalary,
          joiningDate: newTeacherForm.joiningDate
        } : undefined,
        linkExistingTeacherDocId: teacherLinkMode === 'existing' ? selectedTeacherDocId : undefined
      });

      if (result.success) {
        setActionSuccess(
          isBn 
            ? 'ব্যবহারকারী সফলভাবে অনুমোদিত হয়েছে এবং সংশ্লিষ্ট মডিউলগুলোতে যুক্ত করা হয়েছে।' 
            : 'User approved and provisioned across all modules successfully.'
        );
        setTimeout(() => {
          setSelectedUser(null);
          loadData();
        }, 1200);
      } else {
        alert(result.message + (result.error ? ` (${result.error})` : ''));
      }
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

  // Sync & Repair Hub Execution (Requirement 6)
  const syncCandidates = findRepairCandidates(usersList, teachers);

  const handleExecuteBatchRepair = async () => {
    if (syncCandidates.length === 0) return;
    setRepairing(true);
    setRepairSuccessMsg(null);
    let repairedCount = 0;
    const errorsList: string[] = [];

    for (let i = 0; i < syncCandidates.length; i++) {
      const candidate = syncCandidates[i];
      setBatchRepairProgress({
        current: i + 1,
        total: syncCandidates.length,
        message: `${candidate.user.displayName} সিঙ্ক ও মেরামত হচ্ছে...`
      });

      try {
        const u = candidate.user;
        const res = await provisionApprovedUser({
          user: u,
          assignedRole: u.role || 'teacher',
          permissions: u.permissions || PRESETS[u.role || 'teacher'] || {},
          approverUid: currentUser?.uid || 'Admin',
          approverName: currentUser?.displayName || 'Authorized Approver',
          existingTeachersList: teachers,
          allUsersList: usersList,
          linkExistingTeacherDocId: candidate.matchedTeacher?.id
        });
        if (res.success) {
          repairedCount++;
        } else {
          errorsList.push(`${u.displayName}: ${res.error || 'Partial'}`);
        }
      } catch (err: any) {
        errorsList.push(`${candidate.user.displayName}: ${err.message}`);
      }
    }

    setRepairing(false);
    setBatchRepairProgress(null);
    setShowBatchRepairConfirm(false);
    setRepairSuccessMsg(
      isBn
        ? `সফলভাবে ${repairedCount} জন অনুমোদিত ইউজারের প্রোফাইল সংশ্লিষ্ট সকল মডিউলে সিঙ্ক ও মেরামত সম্পন্ন হয়েছে।`
        : `Successfully synchronized and repaired ${repairedCount} user accounts.`
    );
    await loadData();
  };

  const handleExecuteSingleRepair = async (candidate: RepairCandidate) => {
    setRepairing(true);
    setRepairSuccessMsg(null);
    try {
      const u = candidate.user;
      const res = await provisionApprovedUser({
        user: u,
        assignedRole: u.role || 'teacher',
        permissions: u.permissions || PRESETS[u.role || 'teacher'] || {},
        approverUid: currentUser?.uid || 'Admin',
        approverName: currentUser?.displayName || 'Authorized Approver',
        existingTeachersList: teachers,
        allUsersList: usersList,
        linkExistingTeacherDocId: candidate.matchedTeacher?.id
      });
      if (res.success) {
        setRepairSuccessMsg(
          isBn
            ? `${u.displayName}-এর প্রোফাইল সংশ্লিষ্ট সকল মডিউলে সিঙ্ক ও মেরামত সম্পন্ন হয়েছে।`
            : `Successfully repaired and synchronized ${u.displayName}.`
        );
        await loadData();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert((isBn ? 'মেরামতে ত্রুটি: ' : 'Repair error: ') + err.message);
    } finally {
      setRepairing(false);
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

          <button
            onClick={() => setActiveTab('sync_repair')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'sync_repair' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-purple-600" />
            <span>{isBn ? "সিঙ্ক ও মেরামত হাব" : "Sync & Repair Hub"}</span>
            {syncCandidates.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-black animate-pulse">
                {syncCandidates.length}
              </span>
            )}
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

          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0"></span>
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 break-words">
                {isBn ? "অনুমোদনের অপেক্ষায় থাকা নতুন আবেদনসমূহ" : "Pending User Registrations Awaiting Approval"}
              </h3>
            </div>
            <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
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
                            {u.role === 'teacher' && (
                              <div className="mt-1">
                                {u.teacherId ? (
                                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono font-bold block w-fit">
                                    ID: {u.teacherId}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openReviewModal(u)}
                                    title={isBn ? "শিক্ষক প্রোফাইল লিঙ্ক করুন" : "Link Teacher Profile"}
                                    className="text-[10px] text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded font-bold flex items-center space-x-1 w-fit transition animate-pulse"
                                  >
                                    <AlertCircle className="w-3 h-3 text-rose-500" />
                                    <span>{isBn ? "প্রোফাইল লিংকিং প্রয়োজন" : "Link Required"}</span>
                                  </button>
                                )}
                              </div>
                            )}
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
      {/* TAB 3: SYSTEM SYNCHRONIZATION & REPAIR HUB (Requirement 6)     */}
      {/* ============================================================== */}
      {activeTab === 'sync_repair' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">{isBn ? "মোট অনুমোদিত ইউজার" : "Total Approved Users"}</span>
              <span className="text-xl font-black text-slate-900">
                {usersList.filter(u => u.status === 'active' || u.approvalStatus === 'approved').length} {isBn ? "জন" : ""}
              </span>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-xs text-blue-800 block">{isBn ? "টিচার ম্যানেজমেন্টে প্রোফাইল" : "In Teacher Management"}</span>
              <span className="text-xl font-black text-blue-900">{teachers.length} {isBn ? "জন" : ""}</span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-xs text-emerald-800 block">{isBn ? "শতভাগ সিঙ্কড ও সক্রিয়" : "Fully Synced & Active"}</span>
              <span className="text-xl font-black text-emerald-900">
                {usersList.filter(u => (u.status === 'active' || u.approvalStatus === 'approved') && !syncCandidates.some(c => c.user.uid === u.uid)).length} {isBn ? "জন" : ""}
              </span>
            </div>

            <div className={`p-4 rounded-2xl border shadow-xs transition ${
              syncCandidates.length > 0 ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"
            }`}>
              <span className={`text-xs block ${syncCandidates.length > 0 ? "text-amber-800 font-bold" : "text-slate-500"}`}>
                {isBn ? "মেরামতযোগ্য অ্যাকাউন্ট" : "Accounts Needing Repair"}
              </span>
              <span className={`text-xl font-black ${syncCandidates.length > 0 ? "text-amber-900" : "text-slate-700"}`}>
                {syncCandidates.length} {isBn ? "টি রেকর্ড" : "records"}
              </span>
            </div>
          </div>

          {/* Feedback Success Message */}
          {repairSuccessMsg && (
            <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{repairSuccessMsg}</span>
            </div>
          )}

          {/* Controlled Repair Preview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-purple-600" />
                  <span>{isBn ? "অনুমোদিত ইউজার মডিউল সিঙ্ক ও মেরামত প্রিভিউ" : "User Module Synchronization & Repair Preview"}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isBn 
                    ? "অনুমোদিত হওয়া সত্ত্বেও যেসকল শিক্ষকের টিচার ম্যানেজমেন্ট, জিপিএস হাজিরা বা পে-রোল প্রোফাইল অনুপস্থিত, তা নিচে প্রদর্শিত হয়েছে।"
                    : "Detects approved users with missing teacher profiles, GPS attendance linkages, or payroll records."}
                </p>
              </div>

              {syncCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBatchRepairConfirm(true)}
                  disabled={repairing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 disabled:opacity-50 shadow-sm"
                >
                  {repairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{isBn ? "সকল ইউজার এক ক্লিকে সিঙ্ক ও মেরামত করুন" : "Sync & Repair All Users"}</span>
                </button>
              )}
            </div>

            {batchRepairProgress && (
              <div className="p-4 bg-purple-50 border-b border-purple-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                  <span>{batchRepairProgress.message}</span>
                  <span>{batchRepairProgress.current} / {batchRepairProgress.total}</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-purple-600 h-2 transition-all duration-300" 
                    style={{ width: `${(batchRepairProgress.current / batchRepairProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {syncCandidates.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-800">
                  {isBn ? "আলহামদুলিল্লাহ! সকল অ্যাকাউন্ট সম্পূর্ণ সিঙ্কড রয়েছে" : "All Accounts Perfectly Synchronized"}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isBn 
                    ? "সকল অনুমোদিত শিক্ষকের প্রোফাইল টিচার ম্যানেজমেন্ট, জিপিএস হাজিরা এবং বেতন ও পে-রোল মডিউলে সক্রিয়ভাবে যুক্ত আছে।"
                    : "Every approved teacher has an active profile linked across Teacher Management, Attendance, and Payroll."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">{isBn ? "ইউজার ও আইডি" : "User & UID"}</th>
                      <th className="py-3 px-4">{isBn ? "রোল ও যোগাযোগ" : "Role & Contact"}</th>
                      <th className="py-3 px-4">{isBn ? "সনাক্তকৃত সমস্যা" : "Detected Issues"}</th>
                      <th className="py-3 px-4">{isBn ? "প্রস্তাবিত স্বয়ংক্রিয় সমাধান" : "Proposed Action"}</th>
                      <th className="py-3 px-4 text-right">{isBn ? "পদক্ষেপ" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncCandidates.map((candidate, idx) => (
                      <tr key={candidate.user.uid} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{candidate.user.displayName}</p>
                          <span className="font-mono text-[10px] text-slate-400 block">{candidate.user.uid}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 uppercase block w-fit mb-1">
                            {candidate.user.role}
                          </span>
                          <span className="text-[11px] text-slate-600">{candidate.user.email || candidate.user.phoneNumber || '-'}</span>
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          {candidate.issues.map((iss, i) => (
                            <div key={i} className="flex items-center space-x-1.5 text-amber-700 text-[11px] font-medium">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>{iss}</span>
                            </div>
                          ))}
                        </td>
                        <td className="py-3.5 px-4">
                          {candidate.proposedAction === 'link_existing' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Link className="w-3.5 h-3.5 text-blue-600" />
                              <span>{isBn ? `বিদ্যমান প্রোফাইল লিংক: ${candidate.matchedTeacher?.teacherId}` : `Link Profile: ${candidate.matchedTeacher?.teacherId}`}</span>
                            </span>
                          ) : candidate.proposedAction === 'create_new_teacher' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                              <span>{isBn ? "নতুন শিক্ষক প্রোফাইল তৈরি ও সকল মডিউলে সিঙ্ক" : "Create Profile & Auto-Sync Modules"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                              <span>{isBn ? "পারমিশন ও মেটাডাটা সিঙ্ক" : "Sync Permissions & Metadata"}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleExecuteSingleRepair(candidate)}
                            disabled={repairing}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 disabled:opacity-50 shadow-2xs"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>{isBn ? "সিঙ্ক করুন" : "Sync"}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Batch Repair Confirmation Dialog Modal */}
          {showBatchRepairConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <Wrench className="w-6 h-6" />
                </div>
                <div className="text-center space-y-2">
                  <h4 className="text-base font-bold text-slate-900">
                    {isBn ? "অনুমোদিত ইউজার স্বয়ংক্রিয় সিঙ্ক ও মেরামত নিশ্চিতকরণ" : "Confirm Batch Synchronization & Repair"}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {isBn
                      ? `আপনি কি নিশ্চিত যে আপনি সনাক্তকৃত ${syncCandidates.length} জন অনুমোদিত ইউজারের প্রোফাইল সংশ্লিষ্ট সকল মডিউলে (টিচার ম্যানেজমেন্ট, জিপিএস হাজিরা এবং পে-রোল) স্বয়ংক্রিয়ভাবে তৈরি ও সিঙ্ক করতে চান? কোনো পূর্ববর্তী রেকর্ড মুছে যাবে না।`
                      : `Are you sure you want to provision and synchronize all ${syncCandidates.length} approved users across ERP modules? Existing history will be safely preserved.`}
                  </p>
                </div>

                <div className="flex items-center justify-center space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBatchRepairConfirm(false)}
                    disabled={repairing}
                    className="px-4 py-2 border rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                  >
                    {isBn ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBatchRepair}
                    disabled={repairing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    {repairing ? (isBn ? "সিঙ্ক হচ্ছে..." : "Syncing...") : (isBn ? "হ্যাঁ, মেরামত সম্পন্ন করুন" : "Yes, Execute Sync")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: APPROVER DELEGATION (Super Admin Only)                 */}
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
                <div key={adminUser.uid} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 flex flex-wrap items-center gap-2">
                      <span className="break-words">{adminUser.displayName}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                        {adminUser.role}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 break-all">{adminUser.email || adminUser.phoneNumber}</div>
                  </div>

                  <button
                    type="button"
                    disabled={isOwnerUser}
                    onClick={() => toggleApproverAuthority(adminUser.uid)}
                    className={`w-full sm:w-auto shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
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
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="break-words">{isBn ? "ইউজার অনুমোদন ও পারমিশন অ্যাসাইন" : "Review User & Assign Permissions"}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 break-all">
                  {selectedUser.displayName} • {selectedUser.email || selectedUser.phoneNumber || 'User'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="text-slate-400 hover:text-white text-lg font-bold p-1 shrink-0"
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

              {/* 1.5. TEACHER PROFILE LINKING (Requirement 1) */}
              {assignedRole === 'teacher' && (
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center space-x-1.5">
                      <Link className="w-4 h-4 text-amber-600" />
                      <span>{isBn ? "২. শিক্ষক প্রোফাইল লিংকিং (Teacher Profile Linking) *" : "2. Teacher Profile Linking *"}</span>
                    </label>
                    <span className="text-[11px] text-amber-800 font-semibold">
                      {isBn ? "GPS হাজিরা প্রদানের জন্য আবশ্যক" : "Required for GPS Attendance"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    {isBn 
                      ? "এই অ্যাকাউন্টের সাথে মাদরাসার শিক্ষক প্রোফাইল সংযুক্ত করুন। শিক্ষক প্রোফাইল লিঙ্ক না থাকলে ইউজার জিপিএস হাজিরা দিতে পারবেন না।"
                      : "Link this user account with a teacher profile to grant GPS attendance access."}
                  </p>

                  {/* Mode Switcher */}
                  <div className="flex bg-white/80 p-1 rounded-xl border border-amber-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setTeacherLinkMode('existing')}
                      className={`flex-1 py-1.5 rounded-lg transition ${
                        teacherLinkMode === 'existing' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:bg-amber-100/50'
                      }`}
                    >
                      {isBn ? "বিদ্যমান প্রোফাইল নির্বাচন" : "Select Existing Profile"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeacherLinkMode('new')}
                      className={`flex-1 py-1.5 rounded-lg transition ${
                        teacherLinkMode === 'new' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:bg-amber-100/50'
                      }`}
                    >
                      {isBn ? "+ নতুন প্রোফাইল তৈরি" : "+ Create New Profile"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeacherLinkMode('later')}
                      className={`flex-1 py-1.5 rounded-lg transition ${
                        teacherLinkMode === 'later' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:bg-amber-100/50'
                      }`}
                    >
                      {isBn ? "পরে লিঙ্ক করুন" : "Link Later"}
                    </button>
                  </div>

                  {/* Option A: Select Existing Unlinked Profile */}
                  {teacherLinkMode === 'existing' && (
                    <div className="space-y-3">
                      {teachers.filter(t => !t.userId || t.userId === '' || t.userId === selectedUser.uid).length === 0 ? (
                        <div className="p-3 bg-white rounded-xl border border-amber-200 text-center space-y-1.5">
                          <p className="font-bold text-amber-900">{isBn ? "কোনো আনলিঙ্কড শিক্ষক প্রোফাইল পাওয়া যায়নি" : "No unlinked teacher profiles found"}</p>
                          <p className="text-[11px] text-slate-500">{isBn ? "অনুগ্রহ করে '+ নতুন প্রোফাইল তৈরি' অপশনটি বেছে নিন।" : "Please choose '+ Create New Profile'."}</p>
                          <button
                            type="button"
                            onClick={() => setTeacherLinkMode('new')}
                            className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold"
                          >
                            {isBn ? "নতুন প্রোফাইল তৈরি করুন" : "Create New Profile"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700">
                            {isBn ? "আনলিঙ্কড শিক্ষক তালিকা থেকে নির্বাচন করুন:" : "Select Unlinked Teacher Profile:"}
                          </label>
                          <select
                            value={selectedTeacherDocId}
                            onChange={(e) => setSelectedTeacherDocId(e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-medium"
                          >
                            <option value="">{isBn ? "-- শিক্ষক প্রোফাইল বেছে নিন --" : "-- Choose Teacher Profile --"}</option>
                            {teachers
                              .filter(t => !t.userId || t.userId === '' || t.userId === selectedUser.uid)
                              .map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.fullName} ({t.teacherId}) - {t.designation} {t.phone ? `(${t.phone})` : ''} {t.userId === selectedUser.uid ? '✓ (Currently Linked)' : ''}
                                </option>
                              ))}
                          </select>

                          {/* Selected Teacher Details Verification Card */}
                          {selectedTeacherDocId && (
                            (() => {
                              const t = teachers.find(item => item.id === selectedTeacherDocId);
                              if (!t) return null;
                              return (
                                <div className="p-3 bg-white rounded-xl border border-amber-300 shadow-xs space-y-1.5 text-xs animate-fadeIn">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1">
                                    <span className="font-bold text-slate-900 break-words">{t.fullName}</span>
                                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] shrink-0">
                                      ID: {t.teacherId}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                                    <div><b>পদবী:</b> {t.designation || '—'}</div>
                                    <div><b>বিভাগ:</b> {t.department || '—'}</div>
                                    <div><b>মোবাইল:</b> {t.phone || '—'}</div>
                                    <div><b>বেসিক বেতন:</b> {t.baseSalary ? `${t.baseSalary} ৳` : '—'}</div>
                                  </div>
                                  <div className="text-[10px] text-emerald-700 font-semibold pt-1 border-t flex items-center space-x-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{isBn ? "যাচাইকৃত: অনুমোদনের সাথে সাথে এই প্রোফাইলটি লিঙ্ক হবে।" : "Verified: Profile will be linked upon approval."}</span>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Option B: Create New Profile On-the-fly */}
                  {teacherLinkMode === 'new' && (
                    <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-3 text-xs">
                      <span className="font-bold text-amber-900 block">{isBn ? "নতুন শিক্ষক প্রোফাইলের তথ্য প্রদান করুন:" : "New Teacher Information:"}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">{isBn ? "শিক্ষক আইডি (Teacher ID)*" : "Teacher ID*"}</label>
                          <input
                            type="text"
                            value={newTeacherForm.teacherId}
                            onChange={(e) => setNewTeacherForm({ ...newTeacherForm, teacherId: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">{isBn ? "পূর্ণ নাম (Full Name)*" : "Full Name*"}</label>
                          <input
                            type="text"
                            value={newTeacherForm.fullName}
                            onChange={(e) => setNewTeacherForm({ ...newTeacherForm, fullName: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">{isBn ? "পদবী (Designation)*" : "Designation*"}</label>
                          <input
                            type="text"
                            value={newTeacherForm.designation}
                            onChange={(e) => setNewTeacherForm({ ...newTeacherForm, designation: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">{isBn ? "বিভাগ (Department)" : "Department"}</label>
                          <input
                            type="text"
                            value={newTeacherForm.department}
                            onChange={(e) => setNewTeacherForm({ ...newTeacherForm, department: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">{isBn ? "মোবাইল নম্বর" : "Phone"}</label>
                          <input
                            type="text"
                            value={newTeacherForm.phone}
                            onChange={(e) => setNewTeacherForm({ ...newTeacherForm, phone: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">{isBn ? "বেসিক বেতন (মাসিক)" : "Base Salary (Monthly)"}</label>
                          <input
                            type="number"
                            value={newTeacherForm.baseSalary}
                            onChange={(e) => setNewTeacherForm({ ...newTeacherForm, baseSalary: Number(e.target.value) })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Option C: Link Later */}
                  {teacherLinkMode === 'later' && (
                    <div className="p-3 bg-amber-100/70 text-amber-900 border border-amber-300 rounded-xl text-xs space-y-1">
                      <p className="font-bold">{isBn ? "সতর্কতা: শিক্ষক প্রোফাইল পরে লিঙ্ক করা হবে" : "Warning: Linking Deferred"}</p>
                      <p className="text-[11px]">
                        {isBn 
                          ? "অ্যাকাউন্টটি অনুমোদিত হলেও কোনো শিক্ষক প্রোফাইল লিঙ্ক থাকবে না। ব্যবহারকারী সিস্টেমে লগইন করতে পারলেও শিক্ষক প্রোফাইল লিঙ্ক না করা পর্যন্ত GPS হাজিরা প্রদান করতে পারবেন না।"
                          : "User will be approved without a teacher profile. GPS attendance will be blocked until linked."}
                      </p>
                    </div>
                  )}
                </div>
              )}

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
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition text-center"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => openRejectModal(selectedUser)}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition text-center"
                >
                  {isBn ? "প্রত্যাখ্যান করুন" : "Reject"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
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
