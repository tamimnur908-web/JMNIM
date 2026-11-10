import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit3, 
  Trash2, 
  FileSpreadsheet,
  CheckCircle,
  Eye,
  UserCheck,
  UserX,
  Link,
  Unlink,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher, UserProfile } from '../types';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const TeacherManagementPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Notifications
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // View Details Modal
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);

  // Edit Teacher Modal
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Link / Unlink Account Modal for Existing Teachers
  const [linkingTeacher, setLinkingTeacher] = useState<Teacher | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearching, setLinkSearching] = useState(false);
  const [linkSearchResult, setLinkSearchResult] = useState<{
    status: 'idle' | 'not_found' | 'pending' | 'disabled' | 'already_linked' | 'valid';
    user?: UserProfile;
    linkedTeacher?: Teacher;
  }>({ status: 'idle' });

  // ================= TWO-STEP ADD TEACHER MODAL =================
  const [showAddModal, setShowAddModal] = useState(false);
  // 'select_method' | 'search_account' | 'form_linked' | 'form_unlinked'
  const [addStep, setAddStep] = useState<'select_method' | 'search_account' | 'form_linked' | 'form_unlinked'>('select_method');

  // Option A Search States
  const [searchAccountInput, setSearchAccountInput] = useState('');
  const [isSearchingAccount, setIsSearchingAccount] = useState(false);
  const [searchAccountResult, setSearchAccountResult] = useState<{
    status: 'idle' | 'not_found' | 'pending' | 'disabled' | 'already_linked' | 'valid';
    user?: UserProfile;
    linkedTeacher?: Teacher;
  }>({ status: 'idle' });

  // Selected existing user to link
  const [selectedUserToLink, setSelectedUserToLink] = useState<UserProfile | null>(null);

  // Teacher Form Data
  const [formData, setFormData] = useState({
    teacherId: `T-${Math.floor(100 + Math.random() * 900)}`,
    fullName: '',
    phone: '',
    email: '',
    designation: isBn ? 'উস্তাদ / শিক্ষক' : 'Teacher / Ustadh',
    department: isBn ? 'হিফজ ও কিতাব' : 'Hifz & Kitab',
    joiningDate: getTodayDateString(),
    baseSalary: 12000,
    employmentStatus: 'active' as const,
    salaryType: 'monthly' as const,
    notes: '',
  });

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'teachers'));
      const list: Teacher[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Teacher));
      list.sort((a, b) => (a.teacherId || '').localeCompare(b.teacherId || ''));
      setTeachers(list);
    } catch (err) {
      console.warn("Could not load teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const resetAddForm = () => {
    setAddStep('select_method');
    setSearchAccountInput('');
    setIsSearchingAccount(false);
    setSearchAccountResult({ status: 'idle' });
    setSelectedUserToLink(null);
    setFormData({
      teacherId: `T-${Math.floor(100 + Math.random() * 900)}`,
      fullName: '',
      phone: '',
      email: '',
      designation: isBn ? 'উস্তাদ / শিক্ষক' : 'Teacher / Ustadh',
      department: isBn ? 'হিফজ ও কিতাব' : 'Hifz & Kitab',
      joiningDate: getTodayDateString(),
      baseSalary: 12000,
      employmentStatus: 'active',
      salaryType: 'monthly',
      notes: '',
    });
  };

  const handleOpenAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  // Robust Search for Registered Accounts in Firestore 'users'
  const findRegisteredUser = async (rawQuery: string): Promise<{
    status: 'not_found' | 'pending' | 'disabled' | 'already_linked' | 'valid';
    user?: UserProfile;
    linkedTeacher?: Teacher;
  }> => {
    const clean = rawQuery.trim();
    if (!clean) return { status: 'not_found' };

    const lower = clean.toLowerCase();
    const digits = clean.replace(/\D/g, '');

    // Fetch all user accounts from 'users' collection
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers: UserProfile[] = [];
    usersSnap.forEach(d => allUsers.push({ uid: d.id, ...d.data() } as UserProfile));

    // 1. Search by exact email or Google account email
    let matchedUser = allUsers.find(u => u.email && u.email.toLowerCase() === lower);

    // 2. Search by phone number or internal phone auth email
    if (!matchedUser && digits.length >= 8) {
      matchedUser = allUsers.find(u => {
        if (u.phoneNumber) {
          const uDigits = u.phoneNumber.replace(/\D/g, '');
          if (uDigits === digits || uDigits.endsWith(digits) || digits.endsWith(uDigits)) return true;
        }
        if (u.email && u.email.includes(`phone_${digits}`)) return true;
        return false;
      });
    }

    // 3. Fallback: match by displayName if exact
    if (!matchedUser && clean.length >= 3) {
      matchedUser = allUsers.find(u => u.displayName && u.displayName.toLowerCase() === lower);
    }

    if (!matchedUser) {
      return { status: 'not_found' };
    }

    // Check account status: Pending Approval must not be bypassed!
    if (matchedUser.status === 'pending') {
      return { status: 'pending', user: matchedUser };
    }

    if (matchedUser.status === 'disabled' || matchedUser.status === 'rejected') {
      return { status: 'disabled', user: matchedUser };
    }

    // Check if this account is already linked to another teacher profile
    const alreadyLinked = teachers.find(t => t.userId === matchedUser?.uid);
    if (alreadyLinked) {
      return { status: 'already_linked', user: matchedUser, linkedTeacher: alreadyLinked };
    }

    return { status: 'valid', user: matchedUser };
  };

  // Search in Add Teacher Option A
  const handleExecuteAccountSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAccountInput.trim()) return;

    setIsSearchingAccount(true);
    setSearchAccountResult({ status: 'idle' });

    try {
      const res = await findRegisteredUser(searchAccountInput);
      setSearchAccountResult(res);

      if (res.status === 'valid' && res.user) {
        setSelectedUserToLink(res.user);
        // Pre-fill teacher form
        setFormData(prev => ({
          ...prev,
          fullName: res.user?.displayName || prev.fullName,
          phone: res.user?.phoneNumber || (res.user?.email?.startsWith('phone_') ? searchAccountInput.trim() : prev.phone),
          email: res.user?.email && !res.user?.email.endsWith('@auth.jmnim.internal') ? res.user.email : prev.email,
        }));
      }
    } catch (err: any) {
      console.error("Account search error:", err);
      setSearchAccountResult({ status: 'not_found' });
    } finally {
      setIsSearchingAccount(false);
    }
  };

  // Submit Handler for Option A (Linked to existing registered account)
  const handleSubmitLinkedTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToLink) return;

    try {
      const docRef = await addDoc(collection(db, 'teachers'), {
        ...formData,
        baseSalary: Number(formData.baseSalary),
        userId: selectedUserToLink.uid,
        linkedAt: new Date().toISOString(),
        linkedBy: currentUser?.displayName || currentUser?.email || 'Admin',
        createdAt: new Date().toISOString()
      });

      // Update user account document to link teacherId and assign teacher role if not admin
      const userRef = doc(db, 'users', selectedUserToLink.uid);
      await updateDoc(userRef, {
        teacherId: formData.teacherId,
        role: selectedUserToLink.role === 'admin' ? 'admin' : (selectedUserToLink.role === 'principal' ? 'principal' : 'teacher'),
        updatedAt: new Date().toISOString()
      });

      await logAudit({
        action: 'Teacher Added & Linked to Account',
        module: 'Teacher Management',
        recordId: docRef.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `নতুন শিক্ষক নিবন্ধন ও অ্যাকাউন্ট লিঙ্ক: ${formData.fullName} (${formData.teacherId}) linked to User UID: ${selectedUserToLink.uid} (${selectedUserToLink.email || selectedUserToLink.phoneNumber})`
      });

      setShowAddModal(false);
      setSuccessBanner(t.linkSuccessMsg);
      await loadTeachers();
    } catch (err: any) {
      alert((isBn ? 'শিক্ষক যোগ করতে সমস্যা: ' : 'Failed to add teacher: ') + err.message);
    }
  };

  // Submit Handler for Option B (Without Phone/Email - NO Auth Account created)
  const handleSubmitUnlinkedTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      alert(isBn ? 'শিক্ষকের পুরো নাম প্রদান আবশ্যক।' : 'Full Name is required.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'teachers'), {
        teacherId: formData.teacherId.trim(),
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim() || '',
        email: formData.email.trim() || '',
        designation: formData.designation.trim(),
        department: formData.department.trim() || '',
        joiningDate: formData.joiningDate,
        baseSalary: Number(formData.baseSalary) || 0,
        employmentStatus: formData.employmentStatus,
        salaryType: formData.salaryType,
        notes: formData.notes?.trim() || '',
        userId: null, // Explicitly no login account
        createdAt: new Date().toISOString()
      });

      await logAudit({
        action: 'Teacher Added Without Login Account',
        module: 'Teacher Management',
        recordId: docRef.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `ফোন/ইমেইল ছাড়া সাধারণ শিক্ষক প্রোফাইল তৈরি: ${formData.fullName} (${formData.teacherId}), পদবি: ${formData.designation}`
      });

      setShowAddModal(false);
      setSuccessBanner(t.unlinkedSuccessMsg);
      await loadTeachers();
    } catch (err: any) {
      alert((isBn ? 'শিক্ষক প্রোফাইল তৈরিতে সমস্যা: ' : 'Failed to create teacher profile: ') + err.message);
    }
  };

  // Account Linking for Existing Teacher
  const handleOpenLinkModal = (teacher: Teacher) => {
    setLinkingTeacher(teacher);
    setLinkSearchQuery('');
    setLinkSearchResult({ status: 'idle' });
  };

  const handleSearchForLinking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSearchQuery.trim()) return;

    setLinkSearching(true);
    setLinkSearchResult({ status: 'idle' });

    try {
      const res = await findRegisteredUser(linkSearchQuery);
      setLinkSearchResult(res);
    } catch (err) {
      setLinkSearchResult({ status: 'not_found' });
    } finally {
      setLinkSearching(false);
    }
  };

  const handleConfirmLinkAccount = async (targetUser: UserProfile) => {
    if (!linkingTeacher) return;

    try {
      await updateDoc(doc(db, 'teachers', linkingTeacher.id), {
        userId: targetUser.uid,
        linkedAt: new Date().toISOString(),
        linkedBy: currentUser?.displayName || 'Admin'
      });

      await updateDoc(doc(db, 'users', targetUser.uid), {
        teacherId: linkingTeacher.teacherId,
        updatedAt: new Date().toISOString()
      });

      await logAudit({
        action: 'Teacher Account Linked',
        module: 'Teacher Management',
        recordId: linkingTeacher.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক ${linkingTeacher.fullName} (${linkingTeacher.teacherId})-কে নিবন্ধিত ইউজার ${targetUser.displayName} (${targetUser.uid})-এর সাথে লিঙ্ক করা হয়েছে।`
      });

      setLinkingTeacher(null);
      setSuccessBanner(t.linkSuccessMsg);
      await loadTeachers();
    } catch (err: any) {
      alert((isBn ? 'লিঙ্ক করতে সমস্যা: ' : 'Failed to link account: ') + err.message);
    }
  };

  const handleUnlinkAccount = async (teacher: Teacher) => {
    if (!teacher.userId) return;
    if (!window.confirm(isBn 
      ? `আপনি কি নিশ্চিতভাবে ${teacher.fullName}-এর অ্যাকাউন্ট লিঙ্ক বাতিল করতে চান? এর ফলে তার শিক্ষক প্রোফাইল বহাল থাকবে কিন্তু লগইন লিঙ্ক বিচ্ছিন্ন হবে।`
      : `Are you sure you want to unlink the login account from ${teacher.fullName}? The teacher profile and history will be preserved.`)) {
      return;
    }

    try {
      const previousUid = teacher.userId;
      await updateDoc(doc(db, 'teachers', teacher.id), {
        userId: null,
        unlinkedAt: new Date().toISOString(),
        unlinkedBy: currentUser?.displayName || 'Admin'
      });

      try {
        await updateDoc(doc(db, 'users', previousUid), {
          teacherId: null,
          updatedAt: new Date().toISOString()
        });
      } catch (uErr) {
        // Safe fallback
      }

      await logAudit({
        action: 'Teacher Account Unlinked',
        module: 'Teacher Management',
        recordId: teacher.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক ${teacher.fullName} (${teacher.teacherId})-এর অ্যাকাউন্ট আনলিঙ্ক করা হয়েছে (Previous UID: ${previousUid})।`
      });

      if (viewingTeacher && viewingTeacher.id === teacher.id) {
        setViewingTeacher({ ...viewingTeacher, userId: undefined });
      }

      setSuccessBanner(isBn ? 'অ্যাকাউন্ট সফলভাবে আনলিঙ্ক করা হয়েছে।' : 'Account unlinked successfully.');
      await loadTeachers();
    } catch (err: any) {
      alert((isBn ? 'আনলিঙ্ক করতে ব্যর্থ: ' : 'Failed to unlink: ') + err.message);
    }
  };

  // Update existing teacher profile
  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    try {
      await updateDoc(doc(db, 'teachers', editingTeacher.id), {
        fullName: editingTeacher.fullName,
        phone: editingTeacher.phone,
        email: editingTeacher.email,
        designation: editingTeacher.designation,
        department: editingTeacher.department,
        baseSalary: Number(editingTeacher.baseSalary),
        employmentStatus: editingTeacher.employmentStatus,
        notes: editingTeacher.notes || ''
      });

      await logAudit({
        action: 'Teacher Profile Updated',
        module: 'Teacher Management',
        recordId: editingTeacher.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক তথ্য হালনাগাদ: ${editingTeacher.fullName} (${editingTeacher.teacherId})`
      });

      setEditingTeacher(null);
      setSuccessBanner(isBn ? 'শিক্ষক প্রোফাইল সফলভাবে হালনাগাদ হয়েছে।' : 'Teacher profile updated successfully.');
      await loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!window.confirm(isBn ? `আপনি কি নিশ্চিতভাবে ${name}-কে মুছে ফেলতে চান?` : `Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
      await logAudit({
        action: 'Teacher Deleted',
        module: 'Teacher Management',
        recordId: id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক রেকর্ড মোছা হয়েছে: ${name}`
      });
      await loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = filtered.map((t, idx) => ({
      'SL': idx + 1,
      'শিক্ষক আইডি': t.teacherId,
      'পূর্ণ নাম': t.fullName,
      'পদবি': t.designation,
      'বিভাগ': t.department || '-',
      'ফোন': t.phone || '-',
      'ইমেইল': t.email || '-',
      'মূল বেতন (৳)': t.baseSalary,
      'যোগদানের তারিখ': t.joiningDate,
      'লগইন অ্যাকাউন্ট অবস্থা': t.userId ? 'লগইন লিঙ্কযুক্ত' : 'অ্যাকাউন্ট নেই',
      'স্ট্যাটাস': t.employmentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    XLSX.writeFile(wb, `JMNIM_Teachers_${getTodayDateString()}.xlsx`);
  };

  const filtered = teachers.filter(item => 
    item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.teacherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.phone && item.phone.includes(searchTerm)) ||
    (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>{t.teacherListTitle}</span>
          </h2>
          <p className="text-xs text-slate-500">{t.teacherListSubtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          {(isSuperAdmin || role === 'admin' || role === 'principal') && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition w-fit"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.addNewTeacher}</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isBn ? 'এক্সেল এক্সপোর্ট' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-2">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full text-xs border-none focus:outline-none focus:ring-0 text-slate-700"
        />
      </div>

      {/* Teachers List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{t.teacherId}</th>
                <th className="py-3 px-3">{t.teacherName}</th>
                <th className="py-3 px-3">{t.designationAndDept}</th>
                <th className="py-3 px-3 text-right">{t.baseSalary}</th>
                <th className="py-3 px-3 text-center">{isBn ? 'লগইন অ্যাকাউন্ট' : 'Login Account'}</th>
                <th className="py-3 px-3 text-center">{t.status}</th>
                <th className="py-3 px-3 text-right">{t.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {isBn ? 'শিক্ষক তালিকা লোড হচ্ছে...' : 'Loading teachers...'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t.noDataFound}
                  </td>
                </tr>
              ) : (
                filtered.map((teacher, idx) => (
                  <tr key={teacher.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-700">{teacher.teacherId}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{teacher.fullName}</p>
                      <p className="text-[11px] text-slate-500">{teacher.phone || (teacher.email || '-')}</p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-800">{teacher.designation}</p>
                      <p className="text-[11px] text-slate-400">{teacher.department || '-'}</p>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {formatBDT(teacher.baseSalary, isBn)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {teacher.userId ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          <span>{t.linkedAccountBadge}</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center space-x-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            {t.unlinkedAccountBadge}
                          </span>
                          {(isSuperAdmin || role === 'admin' || role === 'principal') && (
                            <button
                              onClick={() => handleOpenLinkModal(teacher)}
                              className="text-blue-600 hover:text-blue-800 text-[10px] font-bold underline ml-1"
                              title={t.linkAccountBtn}
                            >
                              {t.linkAccountBtn}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        teacher.employmentStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {teacher.employmentStatus === 'active' ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setViewingTeacher(teacher)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="বিস্তারিত"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(isSuperAdmin || role === 'admin' || role === 'principal') && (
                          <>
                            <button
                              onClick={() => setEditingTeacher(teacher)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                              title="সম্পাদনা"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id, teacher.fullName)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="মুছুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD TEACHER (TWO DISTINCT METHODS)                                  */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <span>
                    {addStep === 'select_method' && t.addTeacherSelectMethodTitle}
                    {addStep === 'search_account' && t.addTeacherMethodRegisteredTitle}
                    {addStep === 'form_linked' && (isBn ? 'নিবন্ধিত অ্যাকাউন্ট দিয়ে শিক্ষক যোগ করুন' : 'Add Teacher with Registered Account')}
                    {addStep === 'form_unlinked' && t.addTeacherMethodUnlinkedTitle}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {addStep === 'select_method' && t.addTeacherSelectMethodDesc}
                  {addStep === 'search_account' && (isBn ? 'শিক্ষকের নিবন্ধিত ইমেইল বা মোবাইল নম্বর লিখে খুঁজুন।' : 'Search with the teacher\'s registered email or phone.')}
                  {addStep === 'form_linked' && (isBn ? 'অ্যাকাউন্ট তথ্যের সাথে শিক্ষক পদের তথ্য যাচাই করে সংরক্ষণ করুন।' : 'Review and complete the teacher profile.')}
                  {addStep === 'form_unlinked' && (isBn ? 'যেসব শিক্ষকের কোনো অনলাইন অ্যাকাউন্ট নেই, তাদের শিক্ষক প্রোফাইল তৈরি করুন।' : 'Create teacher profile without requiring a login account.')}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* STEP 1: METHOD SELECTION */}
            {addStep === 'select_method' && (
              <div className="space-y-3 py-2">
                {/* Option A Card */}
                <button
                  type="button"
                  onClick={() => setAddStep('search_account')}
                  className="w-full p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition group space-y-1 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-700">
                        {t.addTeacherMethodRegisteredTitle}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                  </div>
                  <p className="text-[11px] text-slate-500 pl-11">
                    {t.addTeacherMethodRegisteredDesc}
                  </p>
                </button>

                {/* Option B Card */}
                <button
                  type="button"
                  onClick={() => {
                    setAddStep('form_unlinked');
                    setFormData(prev => ({
                      ...prev,
                      teacherId: `T-${Math.floor(100 + Math.random() * 900)}`,
                      fullName: '',
                      phone: '',
                      email: '',
                    }));
                  }}
                  className="w-full p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 text-left transition group space-y-1 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
                        <UserX className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-amber-800">
                        {t.addTeacherMethodUnlinkedTitle}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
                  </div>
                  <p className="text-[11px] text-slate-500 pl-11">
                    {t.addTeacherMethodUnlinkedDesc}
                  </p>
                </button>
              </div>
            )}

            {/* STEP 2A: SEARCH REGISTERED ACCOUNT (Option A) */}
            {addStep === 'search_account' && (
              <div className="space-y-4 py-1">
                <form onSubmit={handleExecuteAccountSearch} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.searchAccountLabel}
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchAccountInput}
                          onChange={(e) => setSearchAccountInput(e.target.value)}
                          placeholder={t.searchAccountPlaceholder}
                          className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearchingAccount}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                      >
                        {isSearchingAccount && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>{t.searchAccountBtn}</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* SEARCH RESULTS */}
                {searchAccountResult.status === 'not_found' && (
                  <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs space-y-3 animate-fadeIn">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="font-semibold leading-relaxed">
                        {t.accountNotFoundMsg}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchAccountInput('');
                        setSearchAccountResult({ status: 'idle' });
                      }}
                      className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                    >
                      ← {t.searchAgainBtn}
                    </button>
                  </div>
                )}

                {searchAccountResult.status === 'pending' && (
                  <div className="p-4 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-start space-x-2">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-950">{isBn ? 'অ্যাকাউন্ট অনুমোদিত নয়' : 'Account Pending'}</p>
                        <p className="mt-1 leading-relaxed">{t.accountPendingMsg}</p>
                      </div>
                    </div>
                    {searchAccountResult.user && (
                      <div className="p-2 bg-white/70 rounded border border-amber-200 text-[11px]">
                        <b>{searchAccountResult.user.displayName}</b> ({searchAccountResult.user.email || searchAccountResult.user.phoneNumber})
                      </div>
                    )}
                  </div>
                )}

                {searchAccountResult.status === 'disabled' && (
                  <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{t.accountDisabledMsg}</span>
                  </div>
                )}

                {searchAccountResult.status === 'already_linked' && (
                  <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">{t.accountAlreadyLinkedMsg}</p>
                        {searchAccountResult.linkedTeacher && (
                          <p className="text-[11px] text-amber-800 mt-1">
                            {isBn ? 'যুক্ত শিক্ষক:' : 'Linked to:'} <b>{searchAccountResult.linkedTeacher.fullName}</b> ({searchAccountResult.linkedTeacher.teacherId})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Valid Active Registered Account Found */}
                {searchAccountResult.status === 'valid' && searchAccountResult.user && (
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-900 flex items-center space-x-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>{t.accountDetailsTitle}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                        {isBn ? 'সক্রিয় অ্যাকাউন্ট' : 'Active Account'}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-emerald-100 text-xs space-y-1">
                      <p className="font-bold text-slate-900 text-sm">
                        {searchAccountResult.user.displayName}
                      </p>
                      {searchAccountResult.user.email && (
                        <p className="text-slate-600 flex items-center space-x-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{searchAccountResult.user.email}</span>
                        </p>
                      )}
                      {searchAccountResult.user.phoneNumber && (
                        <p className="text-slate-600 flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{searchAccountResult.user.phoneNumber}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 font-mono pt-1">
                        UID: {searchAccountResult.user.uid}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAddStep('form_linked')}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center justify-center space-x-1"
                    >
                      <span>{isBn ? 'শিক্ষক প্রোফাইল তৈরিতে এগিয়ে যান' : 'Proceed to Teacher Form'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setAddStep('select_method')}
                    className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isBn ? 'পদ্ধতি নির্বাচন' : 'Change Method'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2B: TEACHER FORM LINKED TO REGISTERED ACCOUNT (Option A Form) */}
            {addStep === 'form_linked' && selectedUserToLink && (
              <form onSubmit={handleSubmitLinkedTeacher} className="space-y-3 text-xs">
                {/* Linked Account Indicator Capsule */}
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-600 font-bold block">{isBn ? 'সংযুক্ত অ্যাকাউন্ট:' : 'Linked Account:'}</span>
                    <span className="font-bold text-slate-900">{selectedUserToLink.displayName}</span>
                    <span className="text-[11px] text-slate-500 block">{selectedUserToLink.email || selectedUserToLink.phoneNumber}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                    UID: {selectedUserToLink.uid.slice(0, 8)}...
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{t.teacherId} *</label>
                    <input
                      type="text"
                      value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-blue-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{t.baseSalaryTaka} *</label>
                    <input
                      type="number"
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border rounded-lg font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{t.fullName} *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{t.designation} *</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{t.department}</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'মোবাইল ফোন' : 'Phone'}</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'ইমেইল' : 'Email'}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'যোগদানের তারিখ' : 'Joining Date'}</label>
                    <input
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{t.status}</label>
                    <select
                      value={formData.employmentStatus}
                      onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as any })}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white font-medium"
                    >
                      <option value="active">{t.active}</option>
                      <option value="inactive">{t.inactive}</option>
                      <option value="on_leave">{isBn ? 'ছুটিতে' : 'On Leave'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setAddStep('search_account')}
                    className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100 flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isBn ? 'পেছনে' : 'Back'}</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm"
                    >
                      {t.confirmLinkAndCreate}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 2C: FORM WITHOUT PHONE/EMAIL (Option B Form) */}
            {addStep === 'form_unlinked' && (
              <form onSubmit={handleSubmitUnlinkedTeacher} className="space-y-3 text-xs">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                  <span className="font-bold block">{t.addTeacherMethodUnlinkedTitle}:</span>
                  {isBn 
                    ? 'এই অপশনে কোনো লগইন অ্যাকাউন্ট তৈরি হবে না। শিক্ষক কেবল মাদরাসার উপস্থিতি, বেতন ও তালিকায় থাকবেন। পরবর্তীতে চাইলে অ্যাকাউন্ট লিঙ্ক করা যাবে।'
                    : 'This creates only a teacher record without a login account. Can later be linked to an online account if needed.'}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{t.teacherId} *</label>
                    <input
                      type="text"
                      value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-blue-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{t.baseSalaryTaka} *</label>
                    <input
                      type="number"
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border rounded-lg font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{t.fullName} *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder={isBn ? 'মুফতী / মাওলানা...' : 'Teacher Name...'}
                    className="w-full px-3 py-1.5 border rounded-lg font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{t.designation} *</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{t.department}</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">
                      {isBn ? 'মোবাইল ফোন (ঐচ্ছিক)' : 'Phone (Optional)'}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      {isBn ? 'ইমেইল (ঐচ্ছিক)' : 'Email (Optional)'}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="teacher@example.com"
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'যোগদানের তারিখ' : 'Joining Date'}</label>
                    <input
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{t.status}</label>
                    <select
                      value={formData.employmentStatus}
                      onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as any })}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white font-medium"
                    >
                      <option value="active">{t.active}</option>
                      <option value="inactive">{t.inactive}</option>
                      <option value="on_leave">{isBn ? 'ছুটিতে' : 'On Leave'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes'}</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={isBn ? 'প্রাসঙ্গিক তথ্য...' : 'Notes...'}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setAddStep('select_method')}
                    className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100 flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isBn ? 'পদ্ধতি নির্বাচন' : 'Change Method'}</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm"
                    >
                      {t.confirmCreateUnlinked}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LINK ACCOUNT TO EXISTING UNLINKED TEACHER                          */}
      {/* ========================================================================= */}
      {linkingTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Link className="w-5 h-5 text-blue-600" />
                <span>{isBn ? 'শিক্ষক প্রোফাইলে লগইন অ্যাকাউন্ট লিঙ্ক করুন' : 'Link Login Account to Teacher'}</span>
              </h3>
              <button onClick={() => setLinkingTeacher(null)} className="text-slate-400">✕</button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] text-slate-500 font-bold block">{isBn ? 'নির্বাচিত শিক্ষক:' : 'Target Teacher:'}</span>
              <p className="font-bold text-slate-900 text-sm">{linkingTeacher.fullName}</p>
              <p className="text-slate-600">{linkingTeacher.designation} • আইডি: <span className="font-mono text-blue-700 font-bold">{linkingTeacher.teacherId}</span></p>
            </div>

            <form onSubmit={handleSearchForLinking} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  {t.searchAccountLabel}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                    placeholder={t.searchAccountPlaceholder}
                    className="flex-1 px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                  <button
                    type="submit"
                    disabled={linkSearching}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                  >
                    {linkSearching ? '...' : t.searchAccountBtn}
                  </button>
                </div>
              </div>
            </form>

            {/* Results */}
            {linkSearchResult.status === 'not_found' && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs">
                {t.accountNotFoundMsg}
              </div>
            )}

            {linkSearchResult.status === 'pending' && (
              <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs">
                {t.accountPendingMsg}
              </div>
            )}

            {linkSearchResult.status === 'already_linked' && (
              <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs">
                {t.accountAlreadyLinkedMsg}
              </div>
            )}

            {linkSearchResult.status === 'valid' && linkSearchResult.user && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3 text-xs">
                <div>
                  <span className="font-bold text-emerald-900 block">{isBn ? 'সঠিক অ্যাকাউন্ট পাওয়া গেছে:' : 'Valid Account Found:'}</span>
                  <p className="font-bold text-slate-900 mt-1">{linkSearchResult.user.displayName}</p>
                  <p className="text-slate-600">{linkSearchResult.user.email || linkSearchResult.user.phoneNumber}</p>
                  <p className="text-[10px] text-slate-400 font-mono">UID: {linkSearchResult.user.uid}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleConfirmLinkAccount(linkSearchResult.user!)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {isBn ? 'এই অ্যাকাউন্টের সাথে লিঙ্ক নিশ্চিত করুন' : 'Confirm Link with this Account'}
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t text-xs">
              <button
                type="button"
                onClick={() => setLinkingTeacher(null)}
                className="px-4 py-2 border rounded-lg"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW DETAILS                                                       */}
      {/* ========================================================================= */}
      {viewingTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'শিক্ষক প্রোফাইল বিবরণ' : 'Teacher Profile'}</h3>
              <button onClick={() => setViewingTeacher(null)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl space-y-1.5">
                <p><b>আইডি:</b> <span className="font-mono text-blue-700 font-bold">{viewingTeacher.teacherId}</span></p>
                <p><b>পূর্ণ নাম:</b> {viewingTeacher.fullName}</p>
                <p><b>পদবি ও বিভাগ:</b> {viewingTeacher.designation} ({viewingTeacher.department || '-'})</p>
                <p><b>মোবাইল:</b> {viewingTeacher.phone || '-'}</p>
                <p><b>ইমেইল:</b> {viewingTeacher.email || '-'}</p>
                <p><b>মূল মাসিক বেতন:</b> <span className="font-bold text-emerald-700">{formatBDT(viewingTeacher.baseSalary, isBn)}</span></p>
                <p><b>যোগদানের তারিখ:</b> {viewingTeacher.joiningDate}</p>
                <p><b>বর্তমান অবস্থা:</b> <span className="capitalize">{viewingTeacher.employmentStatus}</span></p>
              </div>

              {/* Login Account Linking Information */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="font-bold text-slate-700 block">{isBn ? 'অনলাইন লগইন অ্যাকাউন্ট অবস্থা:' : 'Online Login Account Status:'}</span>
                {viewingTeacher.userId ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        ✓ {t.linkedAccountBadge}
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">UID: {viewingTeacher.userId}</p>
                    </div>
                    {(isSuperAdmin || role === 'admin') && (
                      <button
                        onClick={() => handleUnlinkAccount(viewingTeacher)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded border border-red-200 transition"
                      >
                        {t.unlinkAccountBtn}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      ⚠️ {t.unlinkedAccountBadge}
                    </span>
                    {(isSuperAdmin || role === 'admin' || role === 'principal') && (
                      <button
                        onClick={() => {
                          const target = viewingTeacher;
                          setViewingTeacher(null);
                          handleOpenLinkModal(target);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 rounded border border-blue-300 transition"
                      >
                        {t.linkAccountBtn}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingTeacher(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TEACHER                                                       */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'শিক্ষক তথ্য সম্পাদনা' : 'Edit Teacher'}</h3>
              <button onClick={() => setEditingTeacher(null)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t.fullName} *</label>
                <input
                  type="text"
                  value={editingTeacher.fullName}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, fullName: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t.designation} *</label>
                  <input
                    type="text"
                    value={editingTeacher.designation}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, designation: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t.department}</label>
                  <input
                    type="text"
                    value={editingTeacher.department || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, department: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'মোবাইল ফোন' : 'Phone'}</label>
                  <input
                    type="tel"
                    value={editingTeacher.phone || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'ইমেইল' : 'Email'}</label>
                  <input
                    type="email"
                    value={editingTeacher.email || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t.baseSalaryTaka} *</label>
                  <input
                    type="number"
                    value={editingTeacher.baseSalary}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t.status}</label>
                  <select
                    value={editingTeacher.employmentStatus}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, employmentStatus: e.target.value as any })}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white"
                  >
                    <option value="active">{t.active}</option>
                    <option value="inactive">{t.inactive}</option>
                    <option value="on_leave">{isBn ? 'ছুটিতে' : 'On Leave'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">{isBn ? 'মন্তব্য' : 'Notes'}</label>
                <input
                  type="text"
                  value={editingTeacher.notes || ''}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 border rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
