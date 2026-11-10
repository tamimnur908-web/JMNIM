import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  UserPlus, 
  CheckCircle, 
  Printer, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { MadrasaClass, Section, ResidentialCategory, Student, AdmissionRecord } from '../types';
import { fetchClasses, fetchSections, calculateDefaultMonthlyFee } from '../utils/classManager';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const AdmissionPage: React.FC<{ onNavigateToStudents?: () => void }> = ({ onNavigateToStudents }) => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form states
  const [studentId, setStudentId] = useState(`S-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [fullName, setFullName] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianRelation, setGuardianRelation] = useState(isBn ? 'পিতা' : 'Father');
  const [address, setAddress] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [roll, setRoll] = useState('০১');
  const [residentialCategory, setResidentialCategory] = useState<ResidentialCategory>('residential');
  
  // Fees
  const [calculatedDefaultFee, setCalculatedDefaultFee] = useState<number>(3500);
  const [isFeeOverridden, setIsFeeOverridden] = useState<boolean>(false);
  const [overrideFee, setOverrideFee] = useState<number>(3500);
  const [admissionFee, setAdmissionFee] = useState<number>(2000);
  const [paidAmount, setPaidAmount] = useState<number>(2000);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [admissionNotes, setAdmissionNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<AdmissionRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Classes
  useEffect(() => {
    const loadClassesData = async () => {
      setLoadingConfig(true);
      try {
        const clsList = await fetchClasses();
        setClasses(clsList);
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id);
        }
      } catch (err) {
        console.warn("Could not load classes:", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    loadClassesData();
  }, []);

  // Load Sections when Class changes
  useEffect(() => {
    const loadSectionsData = async () => {
      if (!selectedClassId) {
        setSections([]);
        return;
      }
      try {
        const secList = await fetchSections(selectedClassId);
        setSections(secList);
        if (secList.length > 0) {
          setSelectedSectionId(secList[0].id);
        } else {
          setSelectedSectionId('');
        }
      } catch (err) {
        console.warn("Could not load sections:", err);
      }
    };
    loadSectionsData();
  }, [selectedClassId]);

  // Recalculate Default Monthly Fee when Class, Pricing Method, or Residential Category changes
  useEffect(() => {
    const targetClass = classes.find(c => c.id === selectedClassId);
    const fee = calculateDefaultMonthlyFee(settings, targetClass, residentialCategory);
    setCalculatedDefaultFee(fee);
    if (!isFeeOverridden) {
      setOverrideFee(fee);
    }
  }, [selectedClassId, residentialCategory, classes, settings, isFeeOverridden]);

  const activeMonthlyFee = isFeeOverridden ? overrideFee : calculatedDefaultFee;

  const handleGenerateNewId = () => {
    setStudentId(`S-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg(isBn ? 'শিক্ষার্থীর নাম আবশ্যক।' : 'Student name is required.');
      return;
    }
    if (!guardianPhone.trim()) {
      setErrorMsg(isBn ? 'অভিভাবকের ফোন নম্বর আবশ্যক।' : 'Guardian phone number is required.');
      return;
    }
    if (!selectedClassId) {
      setErrorMsg(isBn ? 'ক্লাস নির্বাচন করুন।' : 'Please select a class.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Check for duplicate studentId
      const idQuery = query(collection(db, 'students'), where('studentId', '==', studentId.trim()));
      const idSnap = await getDocs(idQuery);
      if (!idSnap.empty) {
        throw new Error(isBn ? `এই আইডি (${studentId}) পূর্বে নিবন্ধিত হয়েছে। অনুগ্রহ করে নতুন আইডি ব্যবহার করুন।` : `Student ID ${studentId} already exists.`);
      }

      const targetClass = classes.find(c => c.id === selectedClassId);
      const targetSection = sections.find(s => s.id === selectedSectionId);
      const className = targetClass ? targetClass.name : 'অজানা শ্রেণি';
      const sectionName = targetSection ? targetSection.name : '';
      const today = getTodayDateString();

      // 2. Create Student Record
      const newStudent: Omit<Student, 'id'> = {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        fullNameEn: fullNameEn.trim() || undefined,
        dob: dob || undefined,
        gender,
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianRelation: guardianRelation || undefined,
        address: address.trim(),
        classId: selectedClassId,
        className,
        sectionId: selectedSectionId || undefined,
        sectionName: sectionName || undefined,
        roll: roll.trim(),
        residentialCategory,
        admissionDate: today,
        sessionId: settings.currentSessionId || '2024-2025',
        sessionName: settings.currentSessionId || '2024-2025',
        monthlyFee: Number(activeMonthlyFee),
        isFeeOverridden: isFeeOverridden,
        status: 'active',
        isArchived: false,
        createdAt: new Date().toISOString()
      };

      const studentDocRef = await addDoc(collection(db, 'students'), newStudent);

      // 3. Create Admission Record
      const receiptNumber = `ADM-${Date.now().toString().slice(-6)}`;
      const admissionRecord: Omit<AdmissionRecord, 'id'> = {
        admissionNumber: studentId.trim(),
        studentId: studentId.trim(),
        studentName: fullName.trim(),
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        classId: selectedClassId,
        className,
        sectionName: sectionName || undefined,
        residentialCategory,
        sessionId: settings.currentSessionId || '2024-2025',
        admissionFee: Number(admissionFee),
        monthlyFee: Number(activeMonthlyFee),
        paidAmount: Number(paidAmount),
        paymentMethod,
        date: today,
        status: 'approved',
        receiptNumber,
        notes: admissionNotes || undefined
      };

      await addDoc(collection(db, 'admissions'), admissionRecord);

      // 4. If paid amount > 0, log in fee payments and cash transactions
      if (Number(paidAmount) > 0) {
        const feePayment = {
          receiptNumber,
          studentId: studentId.trim(),
          studentName: fullName.trim(),
          classId: selectedClassId,
          className,
          residentialCategory,
          feeType: isBn ? 'ভর্তি ফি ও প্রাথমিক পেমেন্ট' : 'Admission & Initial Fee',
          amount: Number(admissionFee),
          discount: 0,
          fine: 0,
          netAmount: Number(admissionFee),
          paidAmount: Number(paidAmount),
          dueAmount: Math.max(0, Number(admissionFee) - Number(paidAmount)),
          paymentDate: today,
          paymentMethod,
          collectorName: currentUser?.displayName || (isSuperAdmin ? 'Super Admin' : 'Staff'),
          remarks: `Admission of ${fullName.trim()} (${studentId})`,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'fee_payments'), feePayment);

        // Also add to Cash Transactions (Income)
        await addDoc(collection(db, 'cash_transactions'), {
          voucherNo: `VCH-${receiptNumber}`,
          type: 'income',
          category: isBn ? 'নতুন ভর্তি ফি' : 'Admission Fee',
          amount: Number(paidAmount),
          date: today,
          paymentMethod,
          partyName: fullName.trim(),
          description: `ভর্তি ফি আদায় - ${fullName.trim()} (${studentId}), শ্রেণি: ${className}`,
          recordedBy: currentUser?.displayName || 'Staff',
          linkedPaymentId: receiptNumber,
          createdAt: new Date().toISOString()
        });
      }

      // 5. Audit log
      await logAudit({
        action: 'Student Admitted',
        module: 'New Admission',
        recordId: studentDocRef.id,
        recordType: 'Student',
        performedBy: currentUser?.displayName || currentUser?.email || 'User',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        newValue: newStudent,
        details: `নতুন শিক্ষার্থী ভর্তি সম্পন্ন: ${fullName.trim()} (${studentId}), শ্রেণি: ${className}, ক্যাটাগরি: ${residentialCategory}, মাসিক বেতন: ৳${activeMonthlyFee}`
      });

      setSuccessReceipt({ id: studentDocRef.id, ...admissionRecord });

    } catch (err: any) {
      console.error("Admission error:", err);
      setErrorMsg(err.message || 'ভর্তি প্রক্রিয়াকরণে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    handleGenerateNewId();
    setFullName('');
    setFullNameEn('');
    setGuardianName('');
    setGuardianPhone('');
    setAddress('');
    setDob('');
    setRoll('০১');
    setIsFeeOverridden(false);
    setAdmissionNotes('');
    setSuccessReceipt(null);
    setErrorMsg(null);
  };

  const printReceipt = () => {
    window.print();
  };

  const categoryLabels = {
    residential: isBn ? 'আবাসিক' : 'Residential',
    non_residential: isBn ? 'অনাবাসিক' : 'Non-Residential',
    day_care: isBn ? 'ডে-কেয়ার' : 'Day-care'
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'নতুন শিক্ষার্থী ভর্তি ফরম' : 'New Student Admission Form'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'শিক্ষার্থীর যাবতীয় তথ্য, শ্রেণি ও শাখা, আবাসিক ক্যাটাগরি এবং প্রযোজ্য মাসিক ফি নির্ধারণ করে ভর্তি করুন' 
              : 'Enroll student with residential category, dynamic class & section, and flexible monthly fee'}
          </p>
        </div>

        {onNavigateToStudents && (
          <button
            type="button"
            onClick={onNavigateToStudents}
            className="px-3.5 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
          >
            ← {isBn ? 'শিক্ষার্থী তালিকায় যান' : 'Go to Student List'}
          </button>
        )}
      </div>

      {/* Success Receipt Modal/View */}
      {successReceipt && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-4 no-print">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  {isBn ? 'ভর্তি সফলভাবে সম্পন্ন হয়েছে!' : 'Admission Successfully Completed!'}
                </h3>
                <p className="text-xs text-emerald-700">
                  {isBn ? 'শিক্ষার্থী প্রোফাইল ও মানি রসিদ সফলভাবে সিস্টেমে যুক্ত হয়েছে।' : 'Student profile and money receipt have been added.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={printReceipt}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>{isBn ? 'রসিদ প্রিন্ট করুন' : 'Print Receipt'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                {isBn ? 'আরেকজন ভর্তি করুন' : 'Admit Another Student'}
              </button>
            </div>
          </div>

          {/* Printable Admission Slip */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 print:p-0 print:border-none print:bg-white">
            <div className="text-center border-b border-slate-300 pb-3">
              <h1 className="text-lg font-bold text-slate-900">
                {isBn ? settings.institutionName : settings.institutionNameEn}
              </h1>
              <p className="text-xs text-slate-600">
                {settings.address} • ফোন: {settings.phone}
              </p>
              <div className="inline-block mt-2 px-3 py-0.5 bg-slate-200 text-slate-800 rounded-full text-[11px] font-bold">
                {isBn ? 'ভর্তি মানি রসিদ (Admission Receipt)' : 'Admission Money Receipt'}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">{isBn ? 'রসিদ নং' : 'Receipt No'}:</span>
                <span className="font-bold text-slate-900">{successReceipt.receiptNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isBn ? 'শিক্ষার্থী আইডি' : 'Student ID'}:</span>
                <span className="font-bold text-blue-700">{successReceipt.studentId}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isBn ? 'তারিখ' : 'Date'}:</span>
                <span className="font-medium text-slate-900">{successReceipt.date}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isBn ? 'শিক্ষাবর্ষ' : 'Session'}:</span>
                <span className="font-medium text-slate-900">{successReceipt.sessionId}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}:</span>
                <span className="font-bold text-slate-900">{successReceipt.studentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{isBn ? 'অভিভাবকের নাম ও ফোন' : 'Guardian Name & Phone'}:</span>
                <span className="font-medium text-slate-900">{successReceipt.guardianName} ({successReceipt.guardianPhone})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{isBn ? 'জামাত / শ্রেণি' : 'Class / Jamath'}:</span>
                <span className="font-bold text-slate-900">
                  {successReceipt.className} {successReceipt.sectionName ? `(শাখা: ${successReceipt.sectionName})` : ''}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{isBn ? 'আবাসিক ধরন' : 'Residential Category'}:</span>
                <span className="font-bold text-amber-800">
                  {categoryLabels[successReceipt.residentialCategory]}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{isBn ? 'নির্ধারিত মাসিক বেতন' : 'Approved Monthly Fee'}:</span>
                <span className="font-bold text-emerald-700">{formatBDT(successReceipt.monthlyFee, isBn)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{isBn ? 'ভর্তি ফি' : 'Admission Fee'}:</span>
                <span className="font-bold text-slate-900">{formatBDT(successReceipt.admissionFee, isBn)}</span>
              </div>
              <div className="flex justify-between py-1 bg-emerald-50 px-2 rounded">
                <span className="font-bold text-emerald-900">{isBn ? 'আদায়কৃত টাকা' : 'Paid Amount'}:</span>
                <span className="font-bold text-emerald-900">{formatBDT(successReceipt.paidAmount, isBn)} ({successReceipt.paymentMethod})</span>
              </div>
            </div>

            <div className="pt-8 flex justify-between text-xs text-slate-600 border-t border-slate-200">
              <div className="text-center">
                <div className="border-t border-slate-400 w-32 pt-1">
                  {isBn ? 'অভিভাবকের স্বাক্ষর' : 'Guardian Signature'}
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-slate-400 w-32 pt-1">
                  {isBn ? 'আদায়কারীর স্বাক্ষর' : 'Authorized Signature'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Admission Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Academic & Identification Information */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
            <span>{isBn ? '১. একাডেমিক ও শ্রেণি নির্বাচন' : '1. Academic & Class Assignment'}</span>
            <span className="text-[11px] font-normal text-slate-400">
              {isBn ? 'সেশন: ' + (settings.currentSessionId || '২০২৪-২০২৫') : 'Session: ' + settings.currentSessionId}
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Student ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'শিক্ষার্থী আইডি (Student ID) *' : 'Student ID *'}
              </label>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700"
                  required
                />
                <button
                  type="button"
                  onClick={handleGenerateNewId}
                  title="Generate new ID"
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dynamic Class Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'জামাত / শ্রেণি (Class) *' : 'Class / Jamath *'}
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Section Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'শাখা (Section)' : 'Section'}
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">{isBn ? '-- সাধারণ / কোনো শাখা নেই --' : '-- General / None --'}</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Roll Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'রোল নং (Roll No) *' : 'Roll No *'}
              </label>
              <input
                type="text"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                placeholder="০১"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Residential Category Radio / Cards (Mandatory Requirement 3) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'আবাসিক ধরন (Residential Category) *' : 'Residential Category *'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'residential', label: isBn ? 'আবাসিক' : 'Residential', desc: isBn ? 'মাদরাসায় সার্বক্ষণিক অবস্থান ও খাদ্য' : 'Full-time boarding' },
                  { id: 'non_residential', label: isBn ? 'অনাবাসিক' : 'Non-Residential', desc: isBn ? 'ক্লাস শেষে বাসায় প্রস্থান' : 'Day scholar' },
                  { id: 'day_care', label: isBn ? 'ডে-কেয়ার' : 'Day-care', desc: isBn ? 'সকাল থেকে আসর/মাগরিব পর্যন্ত' : 'Extended day care' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setResidentialCategory(cat.id as ResidentialCategory)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      residentialCategory === cat.id
                        ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        residentialCategory === cat.id ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                      }`}>
                        {residentialCategory === cat.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{cat.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 pl-5">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Personal & Guardian Details */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            {isBn ? '২. শিক্ষার্থীর ব্যক্তিগত ও অভিভাবকের বিবরণ' : '2. Student & Guardian Information'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'শিক্ষার্থীর পূর্ণ নাম (বাংলায়) *' : 'Full Name (Bangla) *'}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isBn ? 'যেমন: মুহাম্মাদ আব্দুল্লাহ' : 'Muhammad Abdullah'}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'শিক্ষার্থীর পূর্ণ নাম (ইংরেজিতে)' : 'Full Name (English)'}
              </label>
              <input
                type="text"
                value={fullNameEn}
                onChange={(e) => setFullNameEn(e.target.value)}
                placeholder="Muhammad Abdullah"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'পিতা / অভিভাবকের নাম *' : 'Father / Guardian Name *'}
              </label>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder={isBn ? 'যেমন: মো: রফিকুল ইসলাম' : 'Md. Rafiqul Islam'}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'অভিভাবকের মোবাইল নম্বর *' : 'Guardian Mobile Phone *'}
              </label>
              <input
                type="tel"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'অভিভাবকের সাথে সম্পর্ক' : 'Relation with Guardian'}
              </label>
              <input
                type="text"
                value={guardianRelation}
                onChange={(e) => setGuardianRelation(e.target.value)}
                placeholder={isBn ? 'পিতা / মাতা / ভাই' : 'Father / Mother / Brother'}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'জন্ম তারিখ (ঐচ্ছিক)' : 'Date of Birth (Optional)'}
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isBn ? 'স্থায়ী / বর্তমান ঠিকানা' : 'Permanent / Present Address'}
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder={isBn ? 'গ্রাম/বাড়ি, ডাকঘর, থানা, জেলা' : 'Village, Post, Thana, District'}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 3. Flexible Monthly Fee & Admission Payments (Requirement 4) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? '৩. মাসিক বেতন ও ভর্তি ফি নির্ধারণ' : '3. Monthly Fee & Admission Payment'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {settings.feePricingMethod === 'class_wise'
                  ? (isBn ? 'বর্তমান সক্রিয় মোড: শ্রেণিভিত্তিক ফি (Method B)' : 'Active mode: Class-wise Fee (Method B)')
                  : (isBn ? 'বর্তমান সক্রিয় মোড: সাধারণ ডিফল্ট ফি (Method A)' : 'Active mode: General Default Fee (Method A)')}
              </p>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {isBn ? 'অটো-লোডেড রেট: ' : 'Auto Loaded Rate: '}
                <b>{formatBDT(calculatedDefaultFee, isBn)}</b>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Monthly Fee Box with Override option */}
            <div className="sm:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    {isBn ? 'প্রযোজ্য নিয়মিত মাসিক বেতন' : 'Applicable Regular Monthly Fee'}
                  </span>
                  <p className="text-[10px] text-slate-500">
                    {isBn ? 'এই শিক্ষার্থীর স্থায়ী প্রোফাইলে এই পরিমাণ ফি সংরক্ষিত হবে।' : 'This fee will be stored permanently in student profile.'}
                  </p>
                </div>

                <label className="flex items-center space-x-2 text-xs font-semibold text-blue-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeeOverridden}
                    onChange={(e) => {
                      setIsFeeOverridden(e.target.checked);
                      if (!e.target.checked) setOverrideFee(calculatedDefaultFee);
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isBn ? 'বিশেষ ফি / কনসেশন ওভাররাইড' : 'Custom Override Fee'}</span>
                </label>
              </div>

              {isFeeOverridden ? (
                <div className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-amber-300">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-amber-900 mb-0.5">
                      {isBn ? 'ওভাররাইডকৃত বিশেষ মাসিক বেতন (৳)' : 'Overridden Monthly Fee (BDT)'}
                    </label>
                    <input
                      type="number"
                      value={overrideFee}
                      onChange={(e) => setOverrideFee(Number(e.target.value))}
                      className="w-full text-sm font-bold text-slate-900 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded max-w-xs">
                    {isBn 
                      ? 'ভবিষ্যতে ইনস্টিটিউট সেটিংস পরিবর্তন হলেও এই শিক্ষার্থীর ফি অপরিবর্তিত থাকবে।'
                      : 'This rate will remain intact even if institute default rates change later.'}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-bold text-emerald-800 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 flex items-center justify-between">
                  <span>{isBn ? 'ডিফল্ট হার অনুযায়ী নির্ধারিত:' : 'Calculated by Default Rules:'}</span>
                  <span className="text-base">{formatBDT(calculatedDefaultFee, isBn)}</span>
                </div>
              )}
            </div>

            {/* Admission Fee & Initial Payment */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBn ? 'ভর্তি ফি (Admission Fee) ৳' : 'Admission Fee ৳'}
                </label>
                <input
                  type="number"
                  value={admissionFee}
                  onChange={(e) => setAdmissionFee(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBn ? 'আজকের আদায়কৃত টাকা (Paid) ৳' : 'Paid Amount Today ৳'}
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isBn ? 'পরিশোধ মাধ্যম (Payment Method)' : 'Payment Method'}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="bank">ব্যাংক (Bank)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2 no-print">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
          >
            {isBn ? 'রিসেট' : 'Reset'}
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-2"
          >
            {submitting ? (
              <span>{isBn ? 'ভর্তি হচ্ছে...' : 'Processing...'}</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{isBn ? 'ভর্তি সম্পন্ন করুন ও রসিদ তৈরি করুন' : 'Complete Admission & Generate Receipt'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
