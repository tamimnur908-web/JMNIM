import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  addDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  GraduationCap, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Archive, 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  FileSpreadsheet, 
  Layers, 
  Plus, 
  ShieldAlert,
  Send,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  Student, 
  MadrasaClass, 
  Section, 
  ResidentialCategory, 
  StudentApprovalRequest 
} from '../types';
import { fetchClasses, fetchSections, canDeleteClass } from '../utils/classManager';
import { formatBDT, formatNumber, formatDate } from '../utils/formatters';
import { logAudit, createNotification } from '../utils/auditLogger';

export const StudentManagementPage: React.FC<{ onNavigateToAdmission?: () => void }> = ({ onNavigateToAdmission }) => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'archived' | 'all'>('active');

  // Active Tab: 'list' or 'approvals'
  const [activeTab, setActiveTab] = useState<'list' | 'approvals'>('list');
  const [approvalRequests, setApprovalRequests] = useState<StudentApprovalRequest[]>([]);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);

  // Modals
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Super Admin Direct Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});

  // Non-Super Admin Approval Request Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<'edit' | 'delete'>('edit');
  const [requestReason, setRequestReason] = useState<string>('');
  const [proposedChanges, setProposedChanges] = useState<Partial<Student>>({});

  // Super Admin Delete / Archive Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteMode, setDeleteMode] = useState<'archive' | 'permanent'>('archive');
  const [deleteReason, setDeleteReason] = useState<string>('');

  // Class & Section Management Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassOrder, setNewClassOrder] = useState<number>(1);
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [classModalSelectedClass, setClassModalSelectedClass] = useState<string>('');

  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Classes & Sections
      const clsList = await fetchClasses();
      setClasses(clsList);
      const secList = await fetchSections();
      setSections(secList);

      // 2. Students
      const studentSnap = await getDocs(collection(db, 'students'));
      const sList: Student[] = [];
      studentSnap.forEach(d => {
        sList.push({ id: d.id, ...d.data() } as Student);
      });
      // Sort by roll / studentId
      sList.sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));
      setStudents(sList);

      // 3. Approval Requests
      const appSnap = await getDocs(collection(db, 'student_approval_requests'));
      const aList: StudentApprovalRequest[] = [];
      appSnap.forEach(d => {
        aList.push({ id: d.id, ...d.data() } as StudentApprovalRequest);
      });
      aList.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setApprovalRequests(aList);
      setApprovalsCount(aList.filter(r => r.status === 'pending').length);

    } catch (err) {
      console.warn("Could not load student data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter students
  const filteredStudents = students.filter(s => {
    // Status filter
    if (filterStatus === 'active' && s.isArchived) return false;
    if (filterStatus === 'archived' && !s.isArchived) return false;

    // Class filter
    if (filterClassId !== 'all' && s.classId !== filterClassId) return false;

    // Category filter
    if (filterCategory !== 'all' && s.residentialCategory !== filterCategory) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = s.fullName?.toLowerCase().includes(q);
      const matchId = s.studentId?.toLowerCase().includes(q);
      const matchRoll = s.roll?.toLowerCase().includes(q);
      const matchPhone = s.guardianPhone?.includes(q);
      if (!matchName && !matchId && !matchRoll && !matchPhone) return false;
    }
    return true;
  });

  // Action: Open Edit
  const handleInitiateEdit = (student: Student) => {
    setSelectedStudent(student);
    if (isSuperAdmin) {
      setEditFormData({
        fullName: student.fullName,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        classId: student.classId,
        className: student.className,
        sectionId: student.sectionId,
        sectionName: student.sectionName,
        roll: student.roll,
        residentialCategory: student.residentialCategory,
        monthlyFee: student.monthlyFee,
        address: student.address
      });
      setIsEditModalOpen(true);
    } else {
      // Non-Super Admin: Open Request Form
      setRequestType('edit');
      setRequestReason('');
      setProposedChanges({
        fullName: student.fullName,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        classId: student.classId,
        className: student.className,
        sectionId: student.sectionId,
        roll: student.roll,
        residentialCategory: student.residentialCategory,
        monthlyFee: student.monthlyFee,
        address: student.address
      });
      setIsRequestModalOpen(true);
    }
  };

  // Action: Open Delete / Archive
  const handleInitiateDelete = (student: Student) => {
    setSelectedStudent(student);
    if (isSuperAdmin) {
      setStudentToDelete(student);
      setDeleteMode('archive');
      setDeleteReason('');
      setIsDeleteDialogOpen(true);
    } else {
      // Non-Super Admin: Submit Delete Request
      setRequestType('delete');
      setRequestReason('');
      setProposedChanges({});
      setIsRequestModalOpen(true);
    }
  };

  // Super Admin: Direct Save Edit
  const handleSaveDirectEdit = async () => {
    if (!selectedStudent) return;
    try {
      const targetClass = classes.find(c => c.id === editFormData.classId);
      const targetSection = sections.find(s => s.id === editFormData.sectionId);
      
      const updatedData: Partial<Student> = {
        ...editFormData,
        className: targetClass ? targetClass.name : selectedStudent.className,
        sectionName: targetSection ? targetSection.name : (editFormData.sectionName || ''),
        monthlyFee: Number(editFormData.monthlyFee || selectedStudent.monthlyFee),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'students', selectedStudent.id), updatedData);

      // Audit Log
      await logAudit({
        action: 'Student Updated (Direct)',
        module: 'Student Management',
        recordId: selectedStudent.id,
        recordType: 'Student',
        performedBy: currentUser?.displayName || 'Super Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        previousValue: selectedStudent,
        newValue: updatedData,
        details: `শিক্ষার্থী তথ্য সরাসরি হালনাগাদ: ${selectedStudent.fullName} (${selectedStudent.studentId})`
      });

      setIsEditModalOpen(false);
      setNotificationMsg({
        type: 'success',
        text: isBn ? 'শিক্ষার্থীর তথ্য সফলভাবে হালনাগাদ করা হয়েছে।' : 'Student updated successfully.'
      });
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'হালনাগাদ করতে ব্যর্থ: ' : 'Failed to update: ') + err.message);
    }
  };

  // Super Admin: Execute Delete or Archive
  const handleConfirmSuperAdminDelete = async () => {
    if (!studentToDelete) return;
    try {
      if (deleteMode === 'archive') {
        // Soft-delete / Archive (Safe, retains all historical records)
        await updateDoc(doc(db, 'students', studentToDelete.id), {
          isArchived: true,
          status: 'archived',
          archivedAt: new Date().toISOString(),
          archivedReason: deleteReason || 'আর্কাইভকৃত'
        });

        await logAudit({
          action: 'Student Archived',
          module: 'Student Management',
          recordId: studentToDelete.id,
          recordType: 'Student',
          performedBy: currentUser?.displayName || 'Super Admin',
          performedByRole: role || 'admin',
          performedByUid: currentUser?.uid,
          details: `শিক্ষার্থী আর্কাইভ করা হয়েছে (পূর্বের সকল ফি ও রেকর্ড অক্ষত): ${studentToDelete.fullName} (${studentToDelete.studentId})`,
          reason: deleteReason
        });

        setNotificationMsg({
          type: 'success',
          text: isBn ? 'শিক্ষার্থীকে নিরাপদে আর্কাইভ করা হয়েছে। সকল ঐতিহাসিক রেকর্ড অক্ষত রয়েছে।' : 'Student archived safely. All history preserved.'
        });
      } else {
        // Permanent Delete
        await deleteDoc(doc(db, 'students', studentToDelete.id));

        await logAudit({
          action: 'Student Permanently Deleted',
          module: 'Student Management',
          recordId: studentToDelete.id,
          recordType: 'Student',
          performedBy: currentUser?.displayName || 'Super Admin',
          performedByRole: role || 'admin',
          performedByUid: currentUser?.uid,
          details: `স্থায়ীভাবে শিক্ষার্থী মোছা হয়েছে: ${studentToDelete.fullName} (${studentToDelete.studentId})`,
          reason: deleteReason
        });

        setNotificationMsg({
          type: 'success',
          text: isBn ? 'শিক্ষার্থী রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়েছে।' : 'Student permanently deleted.'
        });
      }

      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'মুছে ফেলতে ব্যর্থ: ' : 'Failed to delete: ') + err.message);
    }
  };

  // Non-Super Admin: Submit Request to Super Admin
  const handleSubmitApprovalRequest = async () => {
    if (!selectedStudent) return;
    if (!requestReason.trim()) {
      alert(isBn ? 'আবেদনের সুনির্দিষ্ট কারণ উল্লেখ করুন।' : 'Please specify a reason for this request.');
      return;
    }

    try {
      const targetClass = classes.find(c => c.id === proposedChanges.classId);
      const targetSection = sections.find(s => s.id === proposedChanges.sectionId);

      const requestObj: Omit<StudentApprovalRequest, 'id'> = {
        type: requestType,
        studentId: selectedStudent.studentId,
        studentDocId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        currentData: selectedStudent,
        proposedData: requestType === 'edit' ? {
          ...proposedChanges,
          className: targetClass ? targetClass.name : selectedStudent.className,
          sectionName: targetSection ? targetSection.name : (proposedChanges.sectionName || ''),
        } : undefined,
        reason: requestReason.trim(),
        requesterUid: currentUser?.uid || '',
        requesterName: currentUser?.displayName || currentUser?.email || 'Staff',
        requesterEmail: currentUser?.email || '',
        requesterRole: role || 'teacher',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'student_approval_requests'), requestObj);

      // Super Admin Notification
      await createNotification({
        title: isBn ? `নতুন শিক্ষার্থী ${requestType === 'edit' ? 'সম্পাদনা' : 'মুছে ফেলার'} অনুমোদন আবেদন` : `New Student ${requestType} Approval Request`,
        message: `${currentUser?.displayName || 'ব্যবহারকারী'} শিক্ষার্থী ${selectedStudent.fullName} (${selectedStudent.studentId})-এর জন্য ${requestType === 'edit' ? 'সম্পাদনা' : 'মুছে ফেলার'} আবেদন করেছেন।`,
        type: 'approval_request',
        linkPage: 'students'
      });

      // Audit Log
      await logAudit({
        action: `Student ${requestType === 'edit' ? 'Edit' : 'Delete'} Requested`,
        module: 'Student Approval Workflow',
        recordId: selectedStudent.id,
        recordType: 'Student',
        performedBy: currentUser?.displayName || 'Staff',
        performedByRole: role || 'teacher',
        performedByUid: currentUser?.uid,
        reason: requestReason,
        details: `শিক্ষার্থী ${selectedStudent.fullName} (${selectedStudent.studentId})-এর জন্য ${requestType} অনুমোদন আবেদন জমা দেওয়া হয়েছে।`
      });

      setIsRequestModalOpen(false);
      setNotificationMsg({
        type: 'success',
        text: isBn 
          ? 'আবেদনটি সফলভাবে সুপার অ্যাডমিনের নিকট অনুমোদনের জন্য জমা দেওয়া হয়েছে।' 
          : 'Request submitted successfully for Super Admin approval.'
      });
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'অনুরোধ পাঠাতে সমস্যা: ' : 'Failed to submit request: ') + err.message);
    }
  };

  // Super Admin: Review Approval Request (Approve or Reject)
  const handleReviewRequest = async (request: StudentApprovalRequest, approved: boolean, note: string = '') => {
    try {
      if (approved) {
        // Execute operation
        if (request.type === 'edit' && request.proposedData) {
          await updateDoc(doc(db, 'students', request.studentDocId), {
            ...request.proposedData,
            updatedAt: new Date().toISOString()
          });
        } else if (request.type === 'delete') {
          // Soft-delete / Archive
          await updateDoc(doc(db, 'students', request.studentDocId), {
            isArchived: true,
            status: 'archived',
            archivedAt: new Date().toISOString(),
            archivedReason: `অনুমোদিত ডিলিট রিকোয়েস্ট (${request.reason})`
          });
        }

        // Update Request Doc
        await updateDoc(doc(db, 'student_approval_requests', request.id), {
          status: 'approved',
          reviewerUid: currentUser?.uid,
          reviewerName: currentUser?.displayName || 'Super Admin',
          reviewedAt: new Date().toISOString(),
          reviewNote: note || 'অনুমোদিত'
        });

        // Audit Log
        await logAudit({
          action: `Student ${request.type} Approved`,
          module: 'Student Approval Workflow',
          recordId: request.studentDocId,
          recordType: 'Student',
          performedBy: currentUser?.displayName || 'Super Admin',
          performedByRole: 'admin',
          performedByUid: currentUser?.uid,
          approvalStatus: 'approved',
          approvedBy: currentUser?.displayName || 'Super Admin',
          details: `সুপার অ্যাডমিন কর্তৃক শিক্ষার্থী ${request.studentName} (${request.studentId})-এর ${request.type} আবেদন অনুমোদিত ও কার্যকর করা হয়েছে।`
        });

      } else {
        // Rejected: Do NOT change student data
        await updateDoc(doc(db, 'student_approval_requests', request.id), {
          status: 'rejected',
          reviewerUid: currentUser?.uid,
          reviewerName: currentUser?.displayName || 'Super Admin',
          reviewedAt: new Date().toISOString(),
          reviewNote: note || 'প্রত্যাখ্যাত'
        });

        // Audit Log
        await logAudit({
          action: `Student ${request.type} Rejected`,
          module: 'Student Approval Workflow',
          recordId: request.studentDocId,
          recordType: 'Student',
          performedBy: currentUser?.displayName || 'Super Admin',
          performedByRole: 'admin',
          performedByUid: currentUser?.uid,
          approvalStatus: 'rejected',
          approvedBy: currentUser?.displayName || 'Super Admin',
          details: `সুপার অ্যাডমিন কর্তৃক শিক্ষার্থী ${request.studentName} (${request.studentId})-এর ${request.type} আবেদন বাতিল করা হয়েছে। শিক্ষার্থী ডাটা অপরিবর্তিত আছে।`
        });
      }

      setNotificationMsg({
        type: 'success',
        text: approved 
          ? (isBn ? 'আবেদন অনুমোদিত হয়েছে এবং ডাটাবেজ আপডেট হয়েছে।' : 'Request approved and applied.')
          : (isBn ? 'আবেদন প্রত্যাখ্যান করা হয়েছে। শিক্ষার্থী তথ্য অক্ষত রয়েছে।' : 'Request rejected. Student record untouched.')
      });
      await loadData();
    } catch (err: any) {
      alert((isBn ? 'প্রক্রিয়া ব্যর্থ: ' : 'Failed: ') + err.message);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredStudents.map((s, idx) => ({
      'ক্র / SL': idx + 1,
      'শিক্ষার্থী আইডি': s.studentId,
      'পূর্ণ নাম': s.fullName,
      'ইংরেজি নাম': s.fullNameEn || '',
      'জামাত / শ্রেণি': s.className,
      'শাখা': s.sectionName || '',
      'রোল নং': s.roll,
      'আবাসিক ধরন': s.residentialCategory === 'residential' ? 'আবাসিক' : (s.residentialCategory === 'day_care' ? 'ডে-কেয়ার' : 'অনাবাসিক'),
      'মাসিক বেতন (৳)': s.monthlyFee,
      'অভিভাবকের নাম': s.guardianName,
      'অভিভাবকের ফোন': s.guardianPhone,
      'ভর্তির তারিখ': s.admissionDate,
      'স্ট্যাটাস': s.isArchived ? 'আর্কাইভকৃত' : 'সক্রিয়',
      'ঠিকানা': s.address || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `JMNIM_Students_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const categoryBadgeColors = {
    residential: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    non_residential: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    day_care: 'bg-amber-50 text-amber-800 border-amber-200'
  };

  const categoryLabels = {
    residential: isBn ? 'আবাসিক' : 'Residential',
    non_residential: isBn ? 'অনাবাসিক' : 'Non-Residential',
    day_care: isBn ? 'ডে-কেয়ার' : 'Day-care'
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'শিক্ষার্থী ব্যবস্থাপনা (Student Management)' : 'Student Management'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'ডায়নামিক শ্রেণি ও শাখা, আবাসিক ক্যাটাগরি, রোল এবং সুপার অ্যাডমিন ওয়ার্কফ্লো সহযোগে শিক্ষার্থী নিয়ন্ত্রণ' 
              : 'Complete directory with dynamic classes, residential categories, and approval workflows'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onNavigateToAdmission && (
            <button
              onClick={onNavigateToAdmission}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? 'নতুন ভর্তি' : 'New Admission'}</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isBn ? 'এক্সেল এক্সপোর্ট' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          notificationMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{notificationMsg.text}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Tabs: Student Directory vs Super Admin Approval Queue */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'list'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {isBn ? 'শিক্ষার্থী তালিকা' : 'Student List'} ({filteredStudents.length})
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'approvals'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>{isBn ? 'অনুমোদন অপেক্ষমাণ (Approval Requests)' : 'Approval Requests'}</span>
          {approvalsCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">
              {approvalsCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Student List */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isBn ? 'নাম, আইডি, রোল বা ফোন নম্বর...' : 'Search by name, ID, roll or phone...'}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Class Filter */}
            <div>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">{isBn ? 'সকল শ্রেণি / জামাত' : 'All Classes'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Residential Category Filter (Requirement 3) */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">{isBn ? 'সকল আবাসিক ধরন' : 'All Categories'}</option>
                <option value="residential">{isBn ? 'আবাসিক (Residential)' : 'Residential'}</option>
                <option value="non_residential">{isBn ? 'অনাবাসিক (Non-Residential)' : 'Non-Residential'}</option>
                <option value="day_care">{isBn ? 'ডে-কেয়ার (Day-care)' : 'Day-care'}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="active">{isBn ? 'সক্রিয় শিক্ষার্থী' : 'Active Students'}</option>
                <option value="archived">{isBn ? 'আর্কাইভকৃত / প্রাক্তন' : 'Archived Students'}</option>
                <option value="all">{isBn ? 'সকল রেকর্ড (Active + Archived)' : 'All Records'}</option>
              </select>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3">{isBn ? 'শিক্ষার্থী আইডি' : 'Student ID'}</th>
                    <th className="py-3 px-3">{isBn ? 'নাম ও অভিভাবক' : 'Name & Guardian'}</th>
                    <th className="py-3 px-3">{isBn ? 'শ্রেণি ও শাখা' : 'Class & Section'}</th>
                    <th className="py-3 px-3 text-center">{isBn ? 'রোল' : 'Roll'}</th>
                    <th className="py-3 px-3">{isBn ? 'আবাসিক ধরন' : 'Residential Category'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'মাসিক বেতন' : 'Monthly Fee'}</th>
                    <th className="py-3 px-3 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                    <th className="py-3 px-3 text-right">{isBn ? 'পদক্ষেপ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        {isBn ? 'তথ্য লোড হচ্ছে...' : 'Loading data...'}
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        {isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">{s.studentId}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{s.fullName}</p>
                          <p className="text-[11px] text-slate-500">{s.guardianName} ({s.guardianPhone})</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-medium text-slate-800">{s.className}</p>
                          {s.sectionName && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              শাখা: {s.sectionName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">{s.roll}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${categoryBadgeColors[s.residentialCategory || 'residential']}`}>
                            {categoryLabels[s.residentialCategory || 'residential']}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          {formatBDT(s.monthlyFee, isBn)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {s.isArchived ? (
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                              {isBn ? 'আর্কাইভকৃত' : 'Archived'}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                              {isBn ? 'সক্রিয়' : 'Active'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* View Profile Button */}
                            <button
                              onClick={() => {
                                setSelectedStudent(s);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="প্রোফাইল দেখুন"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleInitiateEdit(s)}
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title={isSuperAdmin ? "সরাসরি সম্পাদনা" : "সম্পাদনা আবেদন"}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete/Archive Button */}
                            <button
                              onClick={() => handleInitiateDelete(s)}
                              className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title={isSuperAdmin ? "আর্কাইভ / ডিলিট" : "মুছে ফেলার আবেদন"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Super Admin Approval Queue (Requirement 5) */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>{isBn ? 'শিক্ষার্থী সম্পাদনা ও ডিলিট অনুমোদন অনুরোধসমূহ' : 'Student Change Approval Requests'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {isSuperAdmin 
                  ? (isBn ? 'সুপার অ্যাডমিন হিসেবে আপনি আবেদনগুলো পর্যালোচনা করে অনুমোদন অথবা বাতিল করতে পারবেন।' : 'As Super Admin, review and approve or reject requested changes.')
                  : (isBn ? 'অন্যান্য কর্মীদের জমাকৃত অনুরোধ এখানে প্রদর্শিত হচ্ছে (শুধু সুপার অ্যাডমিন সিদ্ধান্ত নিতে পারবেন)।' : 'Requests submitted by staff (only Super Admin can decide).')}
              </p>
            </div>
          </div>

          {approvalRequests.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {isBn ? 'কোনো অপেক্ষমাণ অনুমোদন নেই।' : 'No approval requests found.'}
            </div>
          ) : (
            <div className="space-y-3">
              {approvalRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        req.type === 'edit' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {req.type === 'edit' ? (isBn ? 'সম্পাদনা আবেদন' : 'Edit Request') : (isBn ? 'মুছে ফেলার আবেদন' : 'Delete Request')}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{req.studentName} ({req.studentId})</span>
                    </div>

                    <div>
                      {req.status === 'pending' && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                          {isBn ? 'অপেক্ষমাণ' : 'Pending'}
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                          {isBn ? 'অনুমোদিত' : 'Approved'}
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold">
                          {isBn ? 'বাতিল' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-100">
                    <div>
                      <p><b>{isBn ? 'আবেদনকারী:' : 'Requester:'}</b> {req.requesterName} ({req.requesterRole})</p>
                      <p><b>{isBn ? 'তারিখ ও সময়:' : 'Time:'}</b> {formatDate(req.createdAt, isBn)}</p>
                      <p><b>{isBn ? 'আবেদনের কারণ:' : 'Reason:'}</b> <span className="text-amber-900">{req.reason}</span></p>
                    </div>

                    {req.type === 'edit' && req.proposedData && (
                      <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
                        <p className="font-bold text-slate-700">{isBn ? 'প্রস্তাবিত পরিবর্তনসমূহ:' : 'Proposed Changes:'}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          নাম: {req.proposedData.fullName} • শ্রেণি: {req.proposedData.className} • রোল: {req.proposedData.roll} • মাসিক ফি: ৳{req.proposedData.monthlyFee}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Decision Actions for Super Admin */}
                  {req.status === 'pending' && (
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      {isSuperAdmin ? (
                        <>
                          <button
                            onClick={() => handleReviewRequest(req, false, 'অনুরোধ প্রত্যাখ্যান করা হয়েছে')}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition"
                          >
                            {isBn ? 'প্রত্যাখ্যান করুন' : 'Reject'}
                          </button>
                          <button
                            onClick={() => handleReviewRequest(req, true, 'অনুমোদিত')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{isBn ? 'অনুমোদন ও কার্যকর করুন' : 'Approve & Execute'}</span>
                          </button>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          {isBn ? 'শুধুমাত্র সুপার অ্যাডমিন অনুমোদন করতে পারবেন।' : 'Only Super Admin can approve this request.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Student Detail View */}
      {isDetailModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'শিক্ষার্থীর পূর্ণাঙ্গ প্রোফাইল' : 'Student Full Profile'}
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-500 block">{isBn ? 'শিক্ষার্থী আইডি' : 'Student ID'}:</span>
                  <span className="font-bold text-blue-700 text-sm">{selectedStudent.studentId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'রোল নং' : 'Roll'}:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedStudent.roll}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'পূর্ণ নাম' : 'Name'}:</span>
                  <span className="font-bold text-slate-900">{selectedStudent.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'ইংরেজি নাম' : 'English Name'}:</span>
                  <span className="font-medium text-slate-700">{selectedStudent.fullNameEn || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'শ্রেণি ও শাখা' : 'Class & Section'}:</span>
                  <span className="font-bold text-slate-900">{selectedStudent.className} {selectedStudent.sectionName ? `(${selectedStudent.sectionName})` : ''}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'আবাসিক ধরন' : 'Category'}:</span>
                  <span className="font-bold text-amber-800">{categoryLabels[selectedStudent.residentialCategory]}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'স্থায়ী মাসিক ফি' : 'Monthly Fee'}:</span>
                  <span className="font-bold text-emerald-700 text-sm">{formatBDT(selectedStudent.monthlyFee, isBn)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isBn ? 'ভর্তির তারিখ' : 'Admission Date'}:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.admissionDate}</span>
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <p><b>{isBn ? 'অভিভাবকের নাম:' : 'Guardian:'}</b> {selectedStudent.guardianName}</p>
                <p><b>{isBn ? 'অভিভাবকের মোবাইল:' : 'Phone:'}</b> {selectedStudent.guardianPhone}</p>
                <p><b>{isBn ? 'ঠিকানা:' : 'Address:'}</b> {selectedStudent.address || '-'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Super Admin Direct Edit Modal */}
      {isEditModalOpen && selectedStudent && isSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'শিক্ষার্থী সম্পাদনা (Super Admin Direct Edit)' : 'Super Admin Direct Edit'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'পূর্ণ নাম' : 'Full Name'}</label>
                <input
                  type="text"
                  value={editFormData.fullName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'জামাত / শ্রেণি' : 'Class'}</label>
                  <select
                    value={editFormData.classId}
                    onChange={(e) => setEditFormData({ ...editFormData, classId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'রোল নং' : 'Roll'}</label>
                  <input
                    type="text"
                    value={editFormData.roll || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, roll: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'আবাসিক ধরন' : 'Category'}</label>
                  <select
                    value={editFormData.residentialCategory}
                    onChange={(e) => setEditFormData({ ...editFormData, residentialCategory: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="residential">{isBn ? 'আবাসিক' : 'Residential'}</option>
                    <option value="non_residential">{isBn ? 'অনাবাসিক' : 'Non-Residential'}</option>
                    <option value="day_care">{isBn ? 'ডে-কেয়ার' : 'Day-care'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'মাসিক বেতন (৳)' : 'Monthly Fee'}</label>
                  <input
                    type="number"
                    value={editFormData.monthlyFee || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, monthlyFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'অভিভাবকের নাম' : 'Guardian Name'}</label>
                  <input
                    type="text"
                    value={editFormData.guardianName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, guardianName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">{isBn ? 'অভিভাবকের ফোন' : 'Guardian Phone'}</label>
                  <input
                    type="text"
                    value={editFormData.guardianPhone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, guardianPhone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveDirectEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
              >
                {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Non-Super Admin Approval Request Modal (Requirement 5) */}
      {isRequestModalOpen && selectedStudent && !isSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {requestType === 'edit' 
                    ? (isBn ? 'সম্পাদনা অনুমোদন আবেদন (Submit to Super Admin)' : 'Submit Edit Request')
                    : (isBn ? 'মুছে ফেলার অনুমোদন আবেদন (Submit to Super Admin)' : 'Submit Delete Request')}
                </h3>
              </div>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs space-y-1">
              <p className="font-bold">
                {isBn ? 'বিজ্ঞপ্তি: শুধুমাত্র সুপার অ্যাডমিন সরাসরি শিক্ষার্থী পরিবর্তন বা মুছতে পারেন।' : 'Note: Only Super Admin can directly edit or delete students.'}
              </p>
              <p>
                {isBn 
                  ? 'আপনার আবেদনটি কারণসহ সুপার অ্যাডমিনের ড্যাশবোর্ডে যাবে। তিনি অনুমোদন করলে কার্যকর হবে।'
                  : 'Your request will be submitted to Super Admin with your identity and reason for review.'}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">{isBn ? 'নির্বাচিত শিক্ষার্থী:' : 'Student:'}</span>
                <span className="font-bold text-slate-900">{selectedStudent.fullName} ({selectedStudent.studentId})</span>
              </div>

              {requestType === 'edit' && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'প্রস্তাবিত নাম:' : 'Proposed Name:'}</label>
                    <input
                      type="text"
                      value={proposedChanges.fullName || ''}
                      onChange={(e) => setProposedChanges({ ...proposedChanges, fullName: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'প্রস্তাবিত রোল:' : 'Proposed Roll:'}</label>
                    <input
                      type="text"
                      value={proposedChanges.roll || ''}
                      onChange={(e) => setProposedChanges({ ...proposedChanges, roll: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  {isBn ? 'আবেদনের সুস্পষ্ট কারণ উল্লেখ করুন *' : 'Reason for this request *'}
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  placeholder={isBn ? 'যেমন: অভিভাবকের অনুরোধে রোল সংশোধন / মাদরাসা ত্যাগের কারণে আর্কাইভ...' : 'Please specify the exact reason...'}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSubmitApprovalRequest}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
              >
                {isBn ? 'আবেদন পাঠান' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Super Admin Delete & Archive Protection Dialog (Requirement 6) */}
      {isDeleteDialogOpen && studentToDelete && isSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border-2 border-red-500">
            <div className="flex items-center space-x-3 text-red-600 border-b border-red-100 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isBn ? 'সুপার অ্যাডমিন সতর্কতা: শিক্ষার্থী অপসারণ' : 'Super Admin Warning: Delete Protection'}
                </h3>
                <p className="text-xs text-red-600 font-semibold">
                  {isBn ? 'এটি একটি অত্যন্ত সংবেদনশীল পদক্ষেপ!' : 'This is a sensitive irreversible action!'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{isBn ? 'শিক্ষার্থীর নাম:' : 'Student Name:'}</span>
                <span className="font-bold text-slate-900">{studentToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isBn ? 'শিক্ষার্থী আইডি:' : 'Student ID:'}</span>
                <span className="font-mono font-bold text-blue-700">{studentToDelete.studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isBn ? 'শ্রেণি:' : 'Class:'}</span>
                <span className="font-medium text-slate-800">{studentToDelete.className}</span>
              </div>
            </div>

            {/* Mode selection: Archive (Recommended) vs Permanent Delete */}
            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-800 block">
                {isBn ? 'পদক্ষেপের ধরন নির্বাচন করুন:' : 'Select Action Type:'}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteMode('archive')}
                  className={`p-3 rounded-xl border text-left transition ${
                    deleteMode === 'archive'
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
                    <Archive className="w-4 h-4 text-emerald-600" />
                    <span>{isBn ? 'আর্কাইভ করুন (নিরাপদ)' : 'Archive (Recommended)'}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {isBn 
                      ? 'অতীতের উপস্থিতি, ফি রসিদ ও রিপোর্ট অক্ষত থাকবে। শিক্ষার্থী নিষ্ক্রিয় দেখাবে।'
                      : 'Preserves all historical fees, receipts and attendance.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteMode('permanent')}
                  className={`p-3 rounded-xl border text-left transition ${
                    deleteMode === 'permanent'
                      ? 'border-red-600 bg-red-50 ring-2 ring-red-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-red-800">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>{isBn ? 'স্থায়ীভাবে মুছুন' : 'Permanent Delete'}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {isBn ? 'ডাটাবেজ থেকে সম্পূর্ণ মুছে যাবে। এটি ফিরিয়ে আনা অসম্ভব।' : 'Completely removed from database. Cannot be undone.'}
                  </p>
                </button>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {isBn ? 'অপসারণের কারণ (অডিট ট্রেইলের জন্য):' : 'Reason (for audit trail):'}
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={isBn ? 'যেমন: মাদরাসা পরিবর্তন / ছাত্রের ছাড়পত্র' : 'Reason for removal...'}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Strict Cancel vs Confirm Buttons (Requirement 6) */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setStudentToDelete(null);
                }}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                {isBn ? 'বাতিল (Cancel)' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmSuperAdminDelete}
                className={`px-5 py-2 text-white rounded-lg text-xs font-bold shadow-md transition ${
                  deleteMode === 'archive'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleteMode === 'archive' 
                  ? (isBn ? 'নিরাপদে আর্কাইভ নিশ্চিত করুন' : 'Confirm Safe Archive')
                  : (isBn ? 'স্থায়ীভাবে মুছে ফেলুন' : 'Confirm Permanent Deletion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
