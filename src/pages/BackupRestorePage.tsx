import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Database, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  ArrowRight, 
  RotateCcw,
  History,
  FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MadrasaClass, Student, Teacher, FeePayment, CashTransaction, AuditLog } from '../types';
import { fetchClasses } from '../utils/classManager';
import { logAudit, createNotification } from '../utils/auditLogger';
import { formatBDT, formatNumber, formatDate, getTodayDateString } from '../utils/formatters';

type ImportCategory = 'students' | 'fees' | 'teachers' | 'cashbook';

interface ColumnMapping {
  systemField: string;
  label: string;
  required: boolean;
  mappedFileColumn: string;
}

export const BackupRestorePage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<'import' | 'backup' | 'audit'>('import');

  // ================= IMPORT WIZARD STATES =================
  const [importCategory, setImportCategory] = useState<ImportCategory>('students');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [validatedRows, setValidatedRows] = useState<{
    data: any;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    isDuplicate: boolean;
    excluded: boolean;
  }[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null);

  // ================= DATABASE BACKUP & RESTORE STATES =================
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // ================= AUDIT LOGS STATES =================
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Field definitions per category
  const getFieldDefinitions = (cat: ImportCategory): ColumnMapping[] => {
    switch (cat) {
      case 'students':
        return [
          { systemField: 'studentId', label: isBn ? 'শিক্ষার্থী আইডি' : 'Student ID', required: true, mappedFileColumn: '' },
          { systemField: 'fullName', label: isBn ? 'পূর্ণ নাম' : 'Full Name', required: true, mappedFileColumn: '' },
          { systemField: 'className', label: isBn ? 'জামাত / শ্রেণি' : 'Class', required: true, mappedFileColumn: '' },
          { systemField: 'roll', label: isBn ? 'রোল নং' : 'Roll', required: true, mappedFileColumn: '' },
          { systemField: 'residentialCategory', label: isBn ? 'আবাসিক ধরন (আবাসিক/অনাবাসিক/ডে-কেয়ার)' : 'Residential Category', required: false, mappedFileColumn: '' },
          { systemField: 'monthlyFee', label: isBn ? 'মাসিক বেতন' : 'Monthly Fee', required: false, mappedFileColumn: '' },
          { systemField: 'guardianName', label: isBn ? 'অভিভাবকের নাম' : 'Guardian Name', required: false, mappedFileColumn: '' },
          { systemField: 'guardianPhone', label: isBn ? 'অভিভাবকের ফোন' : 'Guardian Phone', required: false, mappedFileColumn: '' },
          { systemField: 'address', label: isBn ? 'ঠিকানা' : 'Address', required: false, mappedFileColumn: '' },
        ];
      case 'fees':
        return [
          { systemField: 'studentId', label: isBn ? 'শিক্ষার্থী আইডি' : 'Student ID', required: true, mappedFileColumn: '' },
          { systemField: 'studentName', label: isBn ? 'শিক্ষার্থীর নাম' : 'Student Name', required: false, mappedFileColumn: '' },
          { systemField: 'month', label: isBn ? 'মাস (যেমন: নভেম্বর ২০২৪)' : 'Month', required: true, mappedFileColumn: '' },
          { systemField: 'amount', label: isBn ? 'মোট ফি পরিমাণ' : 'Fee Amount', required: true, mappedFileColumn: '' },
          { systemField: 'paidAmount', label: isBn ? 'পরিশোধিত টাকা' : 'Paid Amount', required: true, mappedFileColumn: '' },
          { systemField: 'paymentDate', label: isBn ? 'পরিশোধের তারিখ (YYYY-MM-DD)' : 'Date', required: false, mappedFileColumn: '' },
          { systemField: 'receiptNumber', label: isBn ? 'রসিদ নম্বর (যদি থাকে)' : 'Receipt No', required: false, mappedFileColumn: '' }
        ];
      case 'teachers':
        return [
          { systemField: 'teacherId', label: isBn ? 'শিক্ষক আইডি' : 'Teacher ID', required: true, mappedFileColumn: '' },
          { systemField: 'fullName', label: isBn ? 'শিক্ষকের নাম' : 'Full Name', required: true, mappedFileColumn: '' },
          { systemField: 'phone', label: isBn ? 'মোবাইল ফোন' : 'Phone', required: true, mappedFileColumn: '' },
          { systemField: 'designation', label: isBn ? 'পদবি' : 'Designation', required: false, mappedFileColumn: '' },
          { systemField: 'department', label: isBn ? 'বিভাগ' : 'Department', required: false, mappedFileColumn: '' },
          { systemField: 'baseSalary', label: isBn ? 'মূল মাসিক বেতন' : 'Base Salary', required: false, mappedFileColumn: '' }
        ];
      case 'cashbook':
        return [
          { systemField: 'date', label: isBn ? 'তারিখ (YYYY-MM-DD)' : 'Date', required: true, mappedFileColumn: '' },
          { systemField: 'type', label: isBn ? 'ধরন (income/expense বা জমা/খরচ)' : 'Type', required: true, mappedFileColumn: '' },
          { systemField: 'category', label: isBn ? 'খাত / ক্যাটাগরি' : 'Category', required: true, mappedFileColumn: '' },
          { systemField: 'amount', label: isBn ? 'টাকার পরিমাণ' : 'Amount', required: true, mappedFileColumn: '' },
          { systemField: 'partyName', label: isBn ? 'দাতা / গ্রহীতা' : 'Party Name', required: false, mappedFileColumn: '' },
          { systemField: 'description', label: isBn ? 'বিবরণ' : 'Description', required: false, mappedFileColumn: '' }
        ];
    }
  };

  // Initialize mappings when category changes
  useEffect(() => {
    setColumnMappings(getFieldDefinitions(importCategory));
    setWizardStep(1);
    setRawRows([]);
    setFileHeaders([]);
    setValidatedRows([]);
    setImportSummary(null);
  }, [importCategory]);

  // Load Audit Logs when Audit tab is opened
  useEffect(() => {
    if (activeTab === 'audit') {
      const loadLogs = async () => {
        setAuditLoading(true);
        try {
          const snap = await getDocs(collection(db, 'audit_logs'));
          const list: AuditLog[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as AuditLog));
          list.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
          setAuditLogs(list);
        } catch (err) {
          console.warn("Could not load audit logs:", err);
        } finally {
          setAuditLoading(false);
        }
      };
      loadLogs();
    }
  }, [activeTab]);

  // Step 1: File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length < 2) {
          alert(isBn ? 'এক্সেল ফাইলে কোনো ডাটা পাওয়া যায়নি।' : 'File contains no data rows.');
          return;
        }

        const headers = (data[0] || []).map(h => String(h).trim());
        setFileHeaders(headers);

        const rows = XLSX.utils.sheet_to_json(ws);
        setRawRows(rows);

        // Auto-guess initial column mapping
        const initialDef = getFieldDefinitions(importCategory);
        const mapped = initialDef.map(field => {
          const matchedHeader = headers.find(h => 
            h.toLowerCase().includes(field.systemField.toLowerCase()) ||
            h.toLowerCase().includes(field.label.toLowerCase()) ||
            (field.systemField === 'fullName' && (h.includes('নাম') || h.includes('Name'))) ||
            (field.systemField === 'roll' && (h.includes('রোল') || h.includes('Roll'))) ||
            (field.systemField === 'studentId' && (h.includes('আইডি') || h.includes('ID'))) ||
            (field.systemField === 'className' && (h.includes('শ্রেণি') || h.includes('ক্লাস') || h.includes('Class')))
          );
          return {
            ...field,
            mappedFileColumn: matchedHeader || ''
          };
        });

        setColumnMappings(mapped);
        setWizardStep(2);
      } catch (err: any) {
        alert((isBn ? 'ফাইল পড়তে সমস্যা: ' : 'Error reading file: ') + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Step 2 -> Step 3: Validate and Check Duplicates
  const handleProceedToValidation = async () => {
    // Check if required fields mapped
    const unmappedRequired = columnMappings.filter(m => m.required && !m.mappedFileColumn);
    if (unmappedRequired.length > 0) {
      alert((isBn ? 'অনুগ্রহ করে আবশ্যিক ফিল্ডগুলো ম্যাপ করুন: ' : 'Please map required fields: ') + unmappedRequired.map(u => u.label).join(', '));
      return;
    }

    // Load existing items for duplicate detection
    let existingIds: Set<string> = new Set();
    if (importCategory === 'students') {
      const snap = await getDocs(collection(db, 'students'));
      snap.forEach(d => existingIds.add(String(d.data().studentId).toLowerCase().trim()));
    } else if (importCategory === 'teachers') {
      const snap = await getDocs(collection(db, 'teachers'));
      snap.forEach(d => existingIds.add(String(d.data().teacherId).toLowerCase().trim()));
    }

    const validated = rawRows.map((row) => {
      const mappedData: any = {};
      const errors: string[] = [];
      const warnings: string[] = [];
      let isDuplicate = false;

      columnMappings.forEach(mapping => {
        if (mapping.mappedFileColumn && row[mapping.mappedFileColumn] !== undefined) {
          mappedData[mapping.systemField] = row[mapping.mappedFileColumn];
        }
      });

      // Validation logic per category
      if (importCategory === 'students') {
        const id = String(mappedData.studentId || '').trim();
        if (!id) errors.push('শিক্ষার্থী আইডি অনুপস্থিত');
        if (!mappedData.fullName) errors.push('নাম অনুপস্থিত');
        if (!mappedData.className) errors.push('শ্রেণি অনুপস্থিত');

        if (id && existingIds.has(id.toLowerCase())) {
          isDuplicate = true;
          warnings.push('এই আইডি ডাটাবেজে ইতিমধ্যে বিদ্যমান (ডুপ্লিকেট)');
        }

        // Standardize residential category
        const catRaw = String(mappedData.residentialCategory || '').toLowerCase();
        if (catRaw.includes('অনাবাসিক') || catRaw.includes('non')) {
          mappedData.residentialCategory = 'non_residential';
        } else if (catRaw.includes('ডে') || catRaw.includes('day')) {
          mappedData.residentialCategory = 'day_care';
        } else {
          mappedData.residentialCategory = 'residential';
        }

        mappedData.monthlyFee = Number(mappedData.monthlyFee) || 1500;
        mappedData.roll = String(mappedData.roll || '০১');
      }

      return {
        data: mappedData,
        isValid: errors.length === 0,
        errors,
        warnings,
        isDuplicate,
        excluded: isDuplicate // default exclude duplicates to prevent silent overwrite
      };
    });

    setValidatedRows(validated);
    setWizardStep(3);
  };

  // Step 3 -> Step 4: Execute Import
  const handleExecuteImport = async () => {
    setIsImporting(true);
    let importedCount = 0;
    let skippedCount = 0;

    try {
      const rowsToImport = validatedRows.filter(r => !r.excluded && r.isValid);

      for (const item of rowsToImport) {
        if (importCategory === 'students') {
          const newStudent: Omit<Student, 'id'> = {
            studentId: String(item.data.studentId).trim(),
            fullName: String(item.data.fullName).trim(),
            guardianName: String(item.data.guardianName || '').trim(),
            guardianPhone: String(item.data.guardianPhone || '').trim(),
            address: String(item.data.address || '').trim(),
            classId: 'imported',
            className: String(item.data.className).trim(),
            roll: String(item.data.roll).trim(),
            residentialCategory: item.data.residentialCategory,
            admissionDate: getTodayDateString(),
            sessionId: settings.currentSessionId || '2024-2025',
            sessionName: settings.currentSessionId || '2024-2025',
            monthlyFee: Number(item.data.monthlyFee || 1500),
            status: 'active',
            isArchived: false,
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, 'students'), newStudent);
          importedCount++;

        } else if (importCategory === 'fees') {
          const receiptNumber = item.data.receiptNumber || `REC-IMP-${Date.now().toString().slice(-4)}-${importedCount}`;
          await addDoc(collection(db, 'fee_payments'), {
            receiptNumber,
            studentId: item.data.studentId,
            studentName: item.data.studentName || 'Imported Student',
            classId: 'imported',
            className: 'Imported',
            feeType: 'মাসিক ফি (ইমপোর্টেড)',
            month: item.data.month,
            amount: Number(item.data.amount || 0),
            discount: 0,
            fine: 0,
            netAmount: Number(item.data.amount || 0),
            paidAmount: Number(item.data.paidAmount || 0),
            dueAmount: Math.max(0, Number(item.data.amount || 0) - Number(item.data.paidAmount || 0)),
            paymentDate: item.data.paymentDate || getTodayDateString(),
            paymentMethod: 'cash',
            collectorName: 'Excel Import Wizard',
            createdAt: new Date().toISOString()
          });
          importedCount++;

        } else if (importCategory === 'teachers') {
          await addDoc(collection(db, 'teachers'), {
            teacherId: String(item.data.teacherId).trim(),
            fullName: String(item.data.fullName).trim(),
            phone: String(item.data.phone).trim(),
            designation: item.data.designation || 'উস্তাদ',
            department: item.data.department || 'সাধারণ',
            baseSalary: Number(item.data.baseSalary || 12000),
            joiningDate: getTodayDateString(),
            employmentStatus: 'active',
            salaryType: 'monthly',
            createdAt: new Date().toISOString()
          });
          importedCount++;

        } else if (importCategory === 'cashbook') {
          await addDoc(collection(db, 'cash_transactions'), {
            voucherNo: `IMP-${Date.now().toString().slice(-4)}-${importedCount}`,
            type: String(item.data.type).toLowerCase().includes('in') || String(item.data.type).includes('জমা') ? 'income' : 'expense',
            category: item.data.category || 'পূর্ববর্তী লেনদেন',
            amount: Number(item.data.amount || 0),
            date: item.data.date || getTodayDateString(),
            paymentMethod: 'cash',
            partyName: item.data.partyName || 'Imported',
            description: item.data.description || 'এক্সেল থেকে আমদানিকৃত রেকর্ড',
            recordedBy: 'Excel Import',
            createdAt: new Date().toISOString()
          });
          importedCount++;
        }
      }

      skippedCount = validatedRows.length - importedCount;
      setImportSummary({ imported: importedCount, skipped: skippedCount });

      // Audit Log
      await logAudit({
        action: `Excel Data Imported (${importCategory})`,
        module: 'Backup & Restore',
        performedBy: currentUser?.displayName || 'User',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `এক্সেল উইজার্ডের মাধ্যমে ${importCategory} ডাটা আমদানি সম্পন্ন: ${importedCount} টি রেকর্ড যুক্ত, ${skippedCount} টি স্কিপ করা হয়েছে।`
      });

      // Notification
      await createNotification({
        title: isBn ? 'এক্সেল ডাটা আমদানি সম্পন্ন' : 'Excel Import Completed',
        message: `${importCategory} এর ${importedCount} টি রেকর্ড সফলভাবে সিস্টেমে যুক্ত হয়েছে।`,
        type: 'import_summary'
      });

      setWizardStep(4);
    } catch (err: any) {
      alert((isBn ? 'আমদানি প্রক্রিয়া ব্যর্থ: ' : 'Import failed: ') + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Full Database Backup as JSON
  const handleDownloadFullDatabaseBackup = async () => {
    setBackupLoading(true);
    try {
      const collectionsToExport = [
        'students',
        'teachers',
        'madrasa_classes',
        'sections',
        'fee_payments',
        'cash_transactions',
        'salary_payments',
        'teacher_attendance_events',
        'notices',
        'institution_settings',
        'audit_logs'
      ];

      const fullBackup: Record<string, any[]> = {};

      for (const collName of collectionsToExport) {
        const snap = await getDocs(collection(db, collName));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        fullBackup[collName] = list;
      }

      const jsonStr = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `JMNIM_Database_Backup_${getTodayDateString()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      await logAudit({
        action: 'Database Backup Downloaded',
        module: 'Backup & Restore',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: 'সম্পূর্ণ ডাটাবেজের JSON ব্যাকআপ ডাউনলোড করা হয়েছে।'
      });
    } catch (err: any) {
      alert((isBn ? 'ব্যাকআপ তৈরিতে সমস্যা: ' : 'Failed to create backup: ') + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'ব্যাকআপ, রিস্টোর ও এক্সেল ইমপোর্ট উইজার্ড' : 'Backup, Restore & Excel Import Wizard'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'বিদ্যমান এক্সেল ফাইল থেকে শিক্ষার্থী, শিক্ষক, বকেয়া ও হিসাবের ডাটা আমদানি এবং সিস্টেমের সার্বিক ব্যাকআপ' 
              : 'Excel/CSV Import Wizard with column mapping, duplicate detection, and full JSON backups'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'import'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{isBn ? 'এক্সেল / CSV ইমপোর্ট উইজার্ড (Import Wizard)' : 'Excel Import Wizard'}</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'backup'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>{isBn ? 'ডাটাবেজ ব্যাকআপ (JSON Backup)' : 'Database Backup'}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{isBn ? 'সিস্টেম অডিট ট্রেইল ও লগ' : 'System Audit Trail'}</span>
        </button>
      </div>

      {/* TAB 1: EXCEL / CSV IMPORT WIZARD (Requirement 7) */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between border-b pb-4">
            {[
              { num: 1, title: isBn ? 'ফাইল আপলোড' : 'Upload File' },
              { num: 2, title: isBn ? 'কলাম ম্যাপিং' : 'Column Mapping' },
              { num: 3, title: isBn ? 'প্রিভিউ ও ভ্যালিডেশন' : 'Preview & Validate' },
              { num: 4, title: isBn ? 'আমদানি সারাংশ' : 'Summary' },
            ].map((st, i) => (
              <div key={st.num} className="flex items-center space-x-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  wizardStep >= st.num ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {st.num}
                </span>
                <span className={`text-xs font-semibold hidden sm:inline ${wizardStep >= st.num ? 'text-slate-900' : 'text-slate-400'}`}>
                  {st.title}
                </span>
                {i < 3 && <span className="text-slate-300 mx-1 hidden sm:inline">→</span>}
              </div>
            ))}
          </div>

          {/* STEP 1: Select Type & Upload */}
          {wizardStep === 1 && (
            <div className="space-y-4 max-w-xl mx-auto py-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'আমদানির ধরন নির্বাচন করুন:' : 'Select Import Type:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'students', label: isBn ? '১. শিক্ষার্থী তালিকা ও ব্যক্তিগত তথ্য' : 'Students List' },
                    { id: 'fees', label: isBn ? '২. পূর্বের ফি ও বকেয়া হিসাব' : 'Fee Records & Balances' },
                    { id: 'teachers', label: isBn ? '৩. শিক্ষক তালিকা ও মূল বেতন' : 'Teachers Directory' },
                    { id: 'cashbook', label: isBn ? '৪. আয়-ব্যয় হিসাব ও ক্যাশ লেনদেন' : 'Cashbook Transactions' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setImportCategory(cat.id as ImportCategory)}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
                        importCategory === cat.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 hover:border-blue-500 transition bg-slate-50/50">
                <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                <div>
                  <label htmlFor="file-upload" className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-700 underline">
                    {isBn ? 'এক্সেল (.xlsx) অথবা .csv ফাইল আপলোড করুন' : 'Click to upload Excel (.xlsx) or .csv file'}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isBn ? 'আপনার এক্সেল ফাইলের কলাম বিন্যাস যেমনই হোক, পরের ধাপে কলাম ম্যাপ করতে পারবেন।' : 'Flexible columns mapping supported in the next step.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isBn ? 'কলাম ম্যাপিং (Column Mapping)' : 'Column Mapping'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isBn 
                      ? 'আপনার এক্সেল ফাইলের কোন কলামটি সিস্টেমের কোন তথ্যের সাথে যুক্ত হবে তা নির্বাচন করুন।' 
                      : 'Match each website field with your uploaded Excel header column.'}
                  </p>
                </div>

                <button
                  onClick={() => setWizardStep(1)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 shrink-0 self-start sm:self-center"
                >
                  ← {isBn ? 'ফাইল পরিবর্তন' : 'Change File'}
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b font-bold text-slate-700">
                      <th className="p-3">{isBn ? 'ওয়েবসাইট ফিল্ড' : 'Website Field'}</th>
                      <th className="p-3">{isBn ? 'আবশ্যকতা' : 'Requirement'}</th>
                      <th className="p-3">{isBn ? 'আপনার এক্সেল কলাম' : 'Your Excel Column'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {columnMappings.map((mapping, idx) => (
                      <tr key={mapping.systemField} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">{mapping.label}</td>
                        <td className="p-3">
                          {mapping.required ? (
                            <span className="text-red-600 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded">
                              {isBn ? 'বাধ্যতামূলক' : 'Required'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">
                              {isBn ? 'ঐচ্ছিক' : 'Optional'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={mapping.mappedFileColumn}
                            onChange={(e) => {
                              const updated = [...columnMappings];
                              updated[idx].mappedFileColumn = e.target.value;
                              setColumnMappings(updated);
                            }}
                            className="w-full max-w-xs text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="">{isBn ? '-- কলাম নির্বাচন করুন --' : '-- Select Excel Column --'}</option>
                            {fileHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={handleProceedToValidation}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md"
                >
                  <span>{isBn ? 'পরবর্তী: প্রিভিউ ও ভ্যালিডেশন' : 'Next: Preview & Validation'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Validation (Detect Duplicates & Errors) */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isBn ? 'ডাটা প্রিভিউ, ডুপ্লিকেট শনাক্তকরণ ও ভ্যালিডেশন' : 'Preview, Duplicate Detection & Validation'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isBn 
                      ? 'ত্রুটিযুক্ত বা পূর্বে বিদ্যমান রেকর্ডগুলো পরীক্ষা করুন। প্রয়োজনে কোনো সারি বাদ দিতে পারবেন।' 
                      : 'Review errors and duplicates. Uncheck any row to exclude it.'}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-600">
                    {isBn ? `মোট সারি: ${validatedRows.length} | গ্রহণযোগ্য: ${validatedRows.filter(r => r.isValid && !r.excluded).length}` : `Total: ${validatedRows.length}`}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5 text-center w-10">আমদানি?</th>
                      <th className="p-2.5">আইডি</th>
                      <th className="p-2.5">নাম</th>
                      <th className="p-2.5">শ্রেণি / খাত</th>
                      <th className="p-2.5 text-center">স্ট্যাটাস ও ওয়ার্নিং</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validatedRows.map((row, idx) => (
                      <tr key={idx} className={row.excluded ? 'bg-slate-100 opacity-60' : (row.isDuplicate ? 'bg-amber-50/50' : '')}>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={!row.excluded}
                            onChange={(e) => {
                              const updated = [...validatedRows];
                              updated[idx].excluded = !e.target.checked;
                              setValidatedRows(updated);
                            }}
                            className="rounded text-blue-600"
                          />
                        </td>
                        <td className="p-2.5 font-mono font-bold text-blue-700">
                          {row.data.studentId || row.data.teacherId || row.data.voucherNo || '-'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {row.data.fullName || row.data.studentName || row.data.partyName || '-'}
                        </td>
                        <td className="p-2.5 text-slate-700">
                          {row.data.className || row.data.category || '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          {row.isDuplicate ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              ⚠️ ডুপ্লিকেট (বাদ দেওয়া হয়েছে)
                            </span>
                          ) : row.isValid ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ সঠিক
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                              ✕ {row.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  ← {isBn ? 'কলাম পরিবর্তন' : 'Back'}
                </button>

                <button
                  onClick={handleExecuteImport}
                  disabled={isImporting || validatedRows.filter(r => !r.excluded && r.isValid).length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  {isImporting ? (isBn ? 'আমদানি হচ্ছে...' : 'Importing...') : (isBn ? `নির্বাচিত ${validatedRows.filter(r => !r.excluded && r.isValid).length} টি রেকর্ড আমদানি করুন` : 'Import Selected Records')}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Import Summary */}
          {wizardStep === 4 && importSummary && (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  {isBn ? 'অভিনন্দন! আমদানি সফলভাবে সম্পন্ন হয়েছে' : 'Import Successfully Completed'}
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  {isBn 
                    ? `${importSummary.imported} টি রেকর্ড সফলভাবে ডাটাবেজে সংরক্ষণ করা হয়েছে। ডুপ্লিকেট বা বাদ দেওয়া রেকর্ড: ${importSummary.skipped} টি।`
                    : `Successfully imported ${importSummary.imported} records. Skipped ${importSummary.skipped} records.`}
                </p>
              </div>

              <div className="flex justify-center space-x-3 pt-2">
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setRawRows([]);
                    setValidatedRows([]);
                    setImportSummary(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {isBn ? 'অন্য ফাইল আমদানি করুন' : 'Import Another File'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FULL JSON DATABASE BACKUP */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
          <div className="border-b pb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>{isBn ? 'সম্পূর্ণ ডাটাবেজ ব্যাকআপ (Full Database Snapshot)' : 'Full Database Snapshot'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isBn 
                ? 'মাদরাসার সকল শিক্ষার্থী, শিক্ষক, ফি কালেকশন, ক্যাশ লেনদেন, ক্লাস ও সেটিংসের সম্পূর্ণ ব্যাকআপ JSON ফরম্যাটে সংরক্ষণ করুন।' 
                : 'Download all collections as a consolidated JSON backup file.'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                ↓
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {isBn ? 'এক-ক্লিকে ফুল ব্যাকআপ ফাইল ডাউনলোড' : 'Download Full JSON Snapshot'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isBn ? 'যেকোনো আকস্মিক ডেটা বিপর্যয় রোধে নিয়মিত ব্যাকআপ ফাইল সংরক্ষণ করুন।' : 'Always keep a copy saved locally for business continuity.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadFullDatabaseBackup}
              disabled={backupLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>{backupLoading ? (isBn ? 'ব্যাকআপ প্রস্তুত হচ্ছে...' : 'Preparing...') : (isBn ? 'ব্যাকআপ ডাউনলোড করুন (.json)' : 'Download Backup File')}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOGS (Requirement 8) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <History className="w-5 h-5 text-blue-600" />
                <span>{isBn ? 'অপরিবর্তনযোগ্য সিস্টেম অডিট ট্রেইল (Audit Trail Logs)' : 'Immutable Audit Trail'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {isBn 
                  ? 'কে কোন রেকর্ড কখন পরিবর্তন করেছেন, আগের মান ও নতুন মান, এবং অনুমোদনকারীর বিস্তারিত তালিকা' 
                  : 'Immutable action logs showing performer, timestamp, diffs, and approval decisions'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {auditLogs.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b font-bold text-slate-700">
                  <th className="py-2.5 px-3">সময়সূচি</th>
                  <th className="py-2.5 px-3">মডিউল ও অ্যাকশন</th>
                  <th className="py-2.5 px-3">ব্যবহারকারী ও রোল</th>
                  <th className="py-2.5 px-3">বিবরণ ও কারণ</th>
                  <th className="py-2.5 px-3 text-center">অনুমোদন স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {isBn ? 'অডিট লগ লোড হচ্ছে...' : 'Loading audit logs...'}
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {isBn ? 'কোনো অডিট লগ পাওয়া যায়নি।' : 'No audit logs found.'}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                        {formatDate(log.timestamp, isBn)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900 block">{log.action}</span>
                        <span className="text-[10px] text-blue-600">{log.module}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-800 block">{log.performedBy}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({log.performedByRole || 'user'})</span>
                      </td>
                      <td className="py-2 px-3 max-w-sm">
                        <p className="text-slate-700">{log.details}</p>
                        {log.reason && (
                          <p className="text-[10px] text-amber-700 italic">কারণ: {log.reason}</p>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {log.approvalStatus || 'auto'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
