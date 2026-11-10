import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { 
  Settings, 
  MapPin, 
  Clock, 
  Save, 
  CheckCircle, 
  Building, 
  Layers, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  Receipt,
  Sparkles,
  PenTool,
  Upload,
  Type,
  RotateCcw,
  ShieldCheck,
  Eye,
  FileCheck2
} from 'lucide-react';
import { GpsMapPicker } from '../components/GpsMapPicker';
import { SignaturePad } from '../components/SignaturePad';
import { AuthoritySignatureBlock } from '../components/AuthoritySignatureBlock';
import { formatNumber, formatBDT } from '../utils/formatters';
import { MadrasaClass, Section, FeePricingMethod } from '../types';
import { 
  fetchClasses, 
  fetchSections, 
  createClass, 
  updateClass, 
  removeClass, 
  createSection, 
  removeSection 
} from '../utils/classManager';
import { logAudit } from '../utils/auditLogger';

export const SettingsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings, updateSettings } = useSettings();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<'profile' | 'fees' | 'classes' | 'signatory'>('profile');

  // Signatory State (Requirement: Muhtamim / Head Accountant Signature)
  const [signatoryName, setSignatoryName] = useState(settings.authorizedSignatoryName || 'মাওলানা তামিম নূর');
  const [signatoryTitle, setSignatoryTitle] = useState(settings.authorizedSignatoryTitle || 'মুহতামিম / প্রধান হিসাবরক্ষক');
  const [signatureType, setSignatureType] = useState<'drawn' | 'image' | 'text'>(
    settings.authorizedSignatoryType || 'text'
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>(settings.authorizedSignatorySignatureUrl || '');
  const [sealUrl, setSealUrl] = useState<string>(settings.authorizedSignatorySealUrl || '');
  const [savingSignatory, setSavingSignatory] = useState(false);

  // Form Data for Profile & GPS
  const [formData, setFormData] = useState({
    institutionName: settings.institutionName,
    institutionNameEn: settings.institutionNameEn,
    establishedYear: settings.establishedYear,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    gpsLat: settings.gpsLat,
    gpsLng: settings.gpsLng,
    allowedRadiusMeters: settings.allowedRadiusMeters,
    dailyCheckInTime: settings.dailyCheckInTime,
    dailyCheckOutTime: settings.dailyCheckOutTime,
    lateGraceMinutes: settings.lateGraceMinutes,
    autoCheckOutEnabled: settings.autoCheckOutEnabled ?? true,
    autoCheckOutWaitingMinutes: settings.autoCheckOutWaitingMinutes ?? 30,
    autoCheckOutNotifyAdmin: settings.autoCheckOutNotifyAdmin ?? true,
    autoCheckOutNotifyTeacher: settings.autoCheckOutNotifyTeacher ?? true,
    missedCheckOutNotifyAdmin: settings.missedCheckOutNotifyAdmin ?? true,
    missedCheckOutNotifyTeacher: settings.missedCheckOutNotifyTeacher ?? true,
  });

  // Fee Pricing Model
  const [feePricingMethod, setFeePricingMethod] = useState<FeePricingMethod>(settings.feePricingMethod || 'general');
  const [generalFees, setGeneralFees] = useState({
    residential: settings.generalFees?.residential || 3500,
    non_residential: settings.generalFees?.non_residential || 1500,
    day_care: settings.generalFees?.day_care || 2200,
  });

  // Class & Section Management
  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // New Class Form
  const [newClassName, setNewClassName] = useState('');
  const [newClassNameEn, setNewClassNameEn] = useState('');
  const [newClassOrder, setNewClassOrder] = useState(1);
  const [newClassFees, setNewClassFees] = useState({ residential: 3500, non_residential: 1500, day_care: 2200 });

  // Edit Class Form
  const [editingClass, setEditingClass] = useState<MadrasaClass | null>(null);

  // Section Management
  const [selectedClassForSection, setSelectedClassForSection] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadClassesAndSections = async () => {
    setLoadingClasses(true);
    try {
      const cls = await fetchClasses();
      setClasses(cls);
      if (cls.length > 0 && !selectedClassForSection) {
        setSelectedClassForSection(cls[0].id);
      }
      const sec = await fetchSections();
      setSections(sec);
    } catch (err) {
      console.warn("Error loading classes:", err);
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    loadClassesAndSections();
  }, []);

  useEffect(() => {
    setSignatoryName(settings.authorizedSignatoryName || 'মাওলানা তামিম নূর');
    setSignatoryTitle(settings.authorizedSignatoryTitle || 'মুহতামিম / প্রধান হিসাবরক্ষক');
    setSignatureType(settings.authorizedSignatoryType || (settings.authorizedSignatorySignatureUrl ? 'image' : 'text'));
    setSignatureDataUrl(settings.authorizedSignatorySignatureUrl || '');
    setSealUrl(settings.authorizedSignatorySealUrl || '');
  }, [settings]);

  const handleSaveSignatory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatoryName.trim()) {
      setErrorMsg(isBn ? 'স্বাক্ষরকারীর নাম আবশ্যক!' : 'Signatory name is required!');
      return;
    }

    setSavingSignatory(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const now = new Date().toISOString();
      await updateSettings({
        authorizedSignatoryName: signatoryName.trim(),
        authorizedSignatoryTitle: signatoryTitle.trim() || 'মুহতামিম / প্রধান হিসাবরক্ষক',
        authorizedSignatoryType: signatureType,
        authorizedSignatorySignatureUrl: signatureType === 'text' ? '' : signatureDataUrl,
        authorizedSignatorySealUrl: sealUrl,
        authorizedSignatoryUpdatedBy: currentUser?.displayName || 'Admin',
        authorizedSignatoryUpdatedAt: now
      });

      await logAudit({
        action: 'Authority Signature Updated',
        module: 'Settings',
        recordId: 'institution_settings_default',
        recordType: 'InstitutionSettings',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `মুহতামিম ও কর্তৃপক্ষের স্বাক্ষর সেটিংস হালনাগাদ: নাম: "${signatoryName}", পদবি: "${signatoryTitle}", মাধ্যম: "${signatureType}"`
      });

      setSuccessMsg(isBn ? 'কর্তৃপক্ষের স্বাক্ষর ও সিল সফলভাবে সংরক্ষিত হয়েছে!' : 'Authority signature and seal saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving authority signature.');
    } finally {
      setSavingSignatory(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateSettings({
        ...formData,
        gpsLat: Number(formData.gpsLat),
        gpsLng: Number(formData.gpsLng),
        allowedRadiusMeters: Number(formData.allowedRadiusMeters),
        lateGraceMinutes: Number(formData.lateGraceMinutes),
        autoCheckOutWaitingMinutes: Number(formData.autoCheckOutWaitingMinutes || 30),
      });

      await logAudit({
        action: 'Institution Settings Updated',
        module: 'Institution Settings',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: 'মাদরাসার সাধারণ পরিচিতি ও জিপিএস স্থানাঙ্ক হালনাগাদ করা হয়েছে।'
      });

      setSuccessMsg(t.settingsSavedSuccess);
    } catch (err: any) {
      setErrorMsg((isBn ? 'সংরক্ষণে ব্যর্থ: ' : 'Failed to save: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFeeSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateSettings({
        feePricingMethod,
        generalFees: {
          residential: Number(generalFees.residential),
          non_residential: Number(generalFees.non_residential),
          day_care: Number(generalFees.day_care),
        }
      });

      await logAudit({
        action: 'Fee Pricing Rules Updated',
        module: 'Institution Settings',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `ফি নির্ধারণ পদ্ধতি পরিবর্তন: ${feePricingMethod}, সাধারণ ডিফল্ট রেট হালনাগাদ করা হয়েছে।`
      });

      setSuccessMsg(isBn ? 'ফি নির্ধারণ পদ্ধতি ও ডিফল্ট রেট সফলভাবে সংরক্ষিত হয়েছে!' : 'Fee pricing rules saved successfully!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Add Class Handler
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await createClass({
        name: newClassName.trim(),
        nameEn: newClassNameEn.trim() || undefined,
        order: Number(newClassOrder) || (classes.length + 1),
        fees: newClassFees
      });

      await logAudit({
        action: 'Class Created',
        module: 'Class Management',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `নতুন শ্রেণি তৈরি: "${newClassName.trim()}"`
      });

      setNewClassName('');
      setNewClassNameEn('');
      setNewClassOrder(classes.length + 2);
      await loadClassesAndSections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Edit Class Handler
  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    try {
      await updateClass(editingClass.id, {
        name: editingClass.name,
        nameEn: editingClass.nameEn,
        order: editingClass.order,
        fees: editingClass.fees
      });

      setEditingClass(null);
      await loadClassesAndSections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Class Handler (Protected against linked records)
  const handleDeleteClass = async (classId: string, className: string) => {
    if (!window.confirm(isBn ? `আপনি কি নিশ্চিতভাবে "${className}" ক্লাসটি মুছে ফেলতে চান?` : `Are you sure you want to remove "${className}"?`)) return;

    try {
      const result = await removeClass(classId);
      if (!result.success) {
        alert(result.message);
        return;
      }

      await logAudit({
        action: 'Class Deleted',
        module: 'Class Management',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শ্রেণি মুছে ফেলা হয়েছে: "${className}"`
      });

      await loadClassesAndSections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Section Handler
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForSection || !newSectionName.trim()) return;

    try {
      await createSection(selectedClassForSection, newSectionName.trim());
      setNewSectionName('');
      await loadClassesAndSections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Section Handler (Protected)
  const handleDeleteSection = async (secId: string, secName: string) => {
    if (!window.confirm(isBn ? `আপনি কি "${secName}" শাখাটি মুছে ফেলতে চান?` : `Delete section "${secName}"?`)) return;
    try {
      const result = await removeSection(secId);
      if (!result.success) {
        alert(result.message);
        return;
      }
      await loadClassesAndSections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>{isBn ? 'প্রতিষ্ঠান ও সিস্টেম কনফিগারেশন' : 'Institution & System Settings'}</span>
        </h2>
        <p className="text-xs text-slate-500">
          {isBn 
            ? 'মাদরাসার পরিচিতি, জিপিএস জিওফেন্স, ফ্লেক্সিবল মাসিক ফি পলিসি এবং শ্রেণি ও শাখা নিয়ন্ত্রণ' 
            : 'Institution profile, geofence, dynamic classes, and flexible fee rules'}
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{isBn ? 'মাদরাসা পরিচিতি ও জিপিএস জিওফেন্স' : 'Profile & GPS Geofence'}</span>
        </button>

        <button
          onClick={() => setActiveTab('fees')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'fees'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{isBn ? 'ডিফল্ট মাসিক ফি পলিসি' : 'Default Fee Policy'}</span>
        </button>

        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'classes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isBn ? 'শ্রেণি ও শাখা ব্যবস্থাপনা' : 'Classes & Sections'}</span>
        </button>

        <button
          onClick={() => setActiveTab('signatory')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'signatory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>{isBn ? 'মুহতামিমের স্বাক্ষর ও সিল' : 'Authority Signature & Seal'}</span>
        </button>
      </div>

      {/* TAB 1: Profile & GPS Geofence */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          {/* Madrasa Basic Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>{t.institutionProfile}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.nameBangla}</label>
                <input
                  type="text"
                  value={formData.institutionName}
                  onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.nameEnglish}</label>
                <input
                  type="text"
                  value={formData.institutionNameEn}
                  onChange={(e) => setFormData({ ...formData, institutionNameEn: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.address}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.establishedYear}</label>
                <input
                  type="text"
                  value={formData.establishedYear}
                  onChange={(e) => setFormData({ ...formData, establishedYear: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.phone}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.email}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* GPS Map Picker */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>{t.gpsMapPickerTitle}</span>
            </h3>

            <GpsMapPicker
              lat={formData.gpsLat}
              lng={formData.gpsLng}
              radius={formData.allowedRadiusMeters}
              onChange={(lat, lng) => setFormData({ ...formData, gpsLat: lat, gpsLng: lng })}
              onRadiusChange={(radius) => setFormData({ ...formData, allowedRadiusMeters: radius })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.madrasaLatInput}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.gpsLat}
                  onChange={(e) => setFormData({ ...formData, gpsLat: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.madrasaLngInput}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.gpsLng}
                  onChange={(e) => setFormData({ ...formData, gpsLng: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.allowedRadiusInput}</label>
                <input
                  type="number"
                  value={formData.allowedRadiusMeters}
                  onChange={(e) => setFormData({ ...formData, allowedRadiusMeters: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Shift Timings */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{t.shiftTimingsAndPolicy}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.dailyCheckInInput}</label>
                <input
                  type="time"
                  value={formData.dailyCheckInTime}
                  onChange={(e) => setFormData({ ...formData, dailyCheckInTime: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.dailyCheckOutInput}</label>
                <input
                  type="time"
                  value={formData.dailyCheckOutTime}
                  onChange={(e) => setFormData({ ...formData, dailyCheckOutTime: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.lateGraceInput}</label>
                <input
                  type="number"
                  value={formData.lateGraceMinutes}
                  onChange={(e) => setFormData({ ...formData, lateGraceMinutes: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Auto Check-out & Missed Check-out System (Requirement 4 & 5) */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>{isBn ? 'স্বয়ংক্রিয় চেক-আউট (Auto Check-Out) ও নোটিফিকেশন কনফিগারেশন' : 'Automatic Check-Out & Missed Check-out Settings'}</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isBn 
                      ? 'শিক্ষক নির্ধারিত সময়ে চেক-আউট না করলে মিসড চেক-আউট নোটিফিকেশন প্রেরণ এবং অতিরিক্ত সময় পর অটো চেক-আউট কার্যকর করার নিয়মাবলী।' 
                      : 'Configure automatic check-out threshold and missed check-out notification rules.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoCheckOutEnabled}
                    onChange={(e) => setFormData({ ...formData, autoCheckOutEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-700">
                    {formData.autoCheckOutEnabled ? (isBn ? 'সক্রিয়' : 'Enabled') : (isBn ? 'নিষ্ক্রিয়' : 'Disabled')}
                  </span>
                </label>
              </div>

              {formData.autoCheckOutEnabled && (
                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {isBn ? 'অতিরিক্ত অটো চেক-আউট অপেক্ষার সময় (মিনিট):' : 'Additional Waiting Period (Minutes):'}
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="240"
                        value={formData.autoCheckOutWaitingMinutes}
                        onChange={(e) => setFormData({ ...formData, autoCheckOutWaitingMinutes: Number(e.target.value) })}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                        required
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        {isBn 
                          ? `উদাহরণ: নির্ধারিত প্রস্থান ${formData.dailyCheckOutTime} হলে এবং +${formData.autoCheckOutWaitingMinutes} মিনিট অপেক্ষার পর শিক্ষক চেক-আউট না করলে স্বয়ংক্রিয়ভাবে সেশন ক্লোজ হবে।`
                          : `E.g., if checkout is ${formData.dailyCheckOutTime}, attendance auto-closes after +${formData.autoCheckOutWaitingMinutes} mins.`}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-800">
                        {isBn ? 'নোটিফিকেশন অনুমতি সেটিংস:' : 'Notification Settings:'}
                      </label>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.missedCheckOutNotifyAdmin}
                            onChange={(e) => setFormData({ ...formData, missedCheckOutNotifyAdmin: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-0"
                          />
                          <span>{isBn ? 'মিসড চেক-আউট হলে অ্যাডমিনদের নোটিফিকেশন দিন' : 'Notify Admins on Missed Check-Out'}</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.missedCheckOutNotifyTeacher}
                            onChange={(e) => setFormData({ ...formData, missedCheckOutNotifyTeacher: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-0"
                          />
                          <span>{isBn ? 'মিসড চেক-আউট হলে সংশ্লিষ্ট শিক্ষককে সতর্কবার্তা দিন' : 'Notify Teacher on Missed Check-Out'}</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.autoCheckOutNotifyAdmin}
                            onChange={(e) => setFormData({ ...formData, autoCheckOutNotifyAdmin: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-0"
                          />
                          <span>{isBn ? 'অটো চেক-আউট কার্যকর হলে অ্যাডমিনদের রিপোর্ট নোটিফিকেশন দিন' : 'Notify Admins on Auto Check-Out'}</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.autoCheckOutNotifyTeacher}
                            onChange={(e) => setFormData({ ...formData, autoCheckOutNotifyTeacher: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-0"
                          />
                          <span>{isBn ? 'অটো চেক-আউট কার্যকর হলে শিক্ষককে কনফার্মেশন দিন' : 'Notify Teacher on Auto Check-Out'}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? t.saving : t.saveSettings}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Flexible Monthly Fee Policy (Requirement 4) */}
      {activeTab === 'fees' && (
        <form onSubmit={handleFeeSettingsSubmit} className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'মাসিক ফি পলিসি ও নির্ধারণ পদ্ধতি' : 'Monthly Fee Pricing System'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isBn 
                  ? 'অ্যাডমিন হিসেবে আপনি সাধারণ ডিফল্ট ফি (Method A) অথবা শ্রেণিভিত্তিক ডিফল্ট ফি (Method B) বেছে নিতে পারেন।' 
                  : 'Choose between General Default Rates (Method A) or Class-wise Default Rates (Method B).'}
              </p>
            </div>

            {/* Pricing Method Selector (Method A vs Method B) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFeePricingMethod('general')}
                className={`p-4 rounded-xl border text-left transition ${
                  feePricingMethod === 'general'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    feePricingMethod === 'general' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                  }`}>
                    {feePricingMethod === 'general' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span>{isBn ? 'পদ্ধতি ক: সাধারণ ডিফল্ট ফি (Method A)' : 'Method A: General Default Fee'}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 pl-6">
                  {isBn 
                    ? 'আবাসিক, অনাবাসিক এবং ডে-কেয়ারের জন্য একটি সুনির্দিষ্ট একক ডিফল্ট হার থাকবে যা সকল শ্রেণির জন্য প্রযোজ্য।' 
                    : 'One uniform default rate for Residential, Non-Residential and Day-care applied to all classes.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFeePricingMethod('class_wise')}
                className={`p-4 rounded-xl border text-left transition ${
                  feePricingMethod === 'class_wise'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    feePricingMethod === 'class_wise' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                  }`}>
                    {feePricingMethod === 'class_wise' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span>{isBn ? 'পদ্ধতি খ: শ্রেণিভিত্তিক ডিফল্ট ফি (Method B)' : 'Method B: Class-wise Default Fee'}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 pl-6">
                  {isBn 
                    ? 'প্রতিটি ক্লাসের নিজস্ব আলাদা আবাসিক, অনাবাসিক ও ডে-কেয়ার রেট থাকবে। (শ্রেণি ট্যাব থেকে শ্রেণিভিত্তিক রেট সেট করুন)' 
                    : 'Each class has its own tailored Residential, Non-Residential, and Day-care monthly rates.'}
                </p>
              </button>
            </div>

            {/* General Default Rates Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{isBn ? 'সার্বজনীন ডিফল্ট মাসিক ফি হার (General Default Rates)' : 'General Default Monthly Rates'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isBn ? '১. আবাসিক ডিফল্ট ফি (৳)' : 'Residential Monthly Fee (BDT)'}
                  </label>
                  <input
                    type="number"
                    value={generalFees.residential}
                    onChange={(e) => setGeneralFees({ ...generalFees, residential: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isBn ? '২. অনাবাসিক ডিফল্ট ফি (৳)' : 'Non-Residential Monthly Fee (BDT)'}
                  </label>
                  <input
                    type="number"
                    value={generalFees.non_residential}
                    onChange={(e) => setGeneralFees({ ...generalFees, non_residential: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isBn ? '৩. ডে-কেয়ার ডিফল্ট ফি (৳)' : 'Day-care Monthly Fee (BDT)'}
                  </label>
                  <input
                    type="number"
                    value={generalFees.day_care}
                    onChange={(e) => setGeneralFees({ ...generalFees, day_care: Number(e.target.value) })}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                {isBn 
                  ? 'নতুন শিক্ষার্থী ভর্তির সময় এই রেটগুলো স্বয়ংক্রিয়ভাবে লোড হবে। প্রতিটি শিক্ষার্থীর জন্য আলাদা ছাড় বা ওভাররাইড করার সুবিধাও থাকবে।' 
                  : 'These rates load automatically during student admission, and can still be overridden individually.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? t.saving : (isBn ? 'ফি পলিসি সংরক্ষণ করুন' : 'Save Fee Policy')}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Dynamic Class & Section Management (Requirement 2) */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          {/* Add New Class Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>{isBn ? 'নতুন জামাত / শ্রেণি তৈরি করুন' : 'Create New Class'}</span>
            </h3>

            <form onSubmit={handleAddClass} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'শ্রেণির নাম (বাংলায়) *' : 'Class Name (Bangla) *'}</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="যেমন: শরহে বেকায়া"
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'শ্রেণির নাম (ইংরেজিতে)' : 'Class Name (English)'}</label>
                  <input
                    type="text"
                    value={newClassNameEn}
                    onChange={(e) => setNewClassNameEn(e.target.value)}
                    placeholder="Sharhe Beqaya"
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'ক্রম / সিরিয়াল' : 'Order'}</label>
                  <input
                    type="number"
                    value={newClassOrder}
                    onChange={(e) => setNewClassOrder(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              {/* Class-wise fee rates for Method B */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-[11px] text-slate-700 block mb-2">
                  {isBn ? 'শ্রেণিভিত্তিক ডিফল্ট মাসিক ফি (Method B এর জন্য প্রযোজ্য):' : 'Class-wise Default Rates (For Method B):'}
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500">আবাসিক (৳)</label>
                    <input
                      type="number"
                      value={newClassFees.residential}
                      onChange={(e) => setNewClassFees({ ...newClassFees, residential: Number(e.target.value) })}
                      className="w-full px-2 py-1 border rounded text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">অনাবাসিক (৳)</label>
                    <input
                      type="number"
                      value={newClassFees.non_residential}
                      onChange={(e) => setNewClassFees({ ...newClassFees, non_residential: Number(e.target.value) })}
                      className="w-full px-2 py-1 border rounded text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">ডে-কেয়ার (৳)</label>
                    <input
                      type="number"
                      value={newClassFees.day_care}
                      onChange={(e) => setNewClassFees({ ...newClassFees, day_care: Number(e.target.value) })}
                      className="w-full px-2 py-1 border rounded text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {isBn ? 'শ্রেণি যোগ করুন' : 'Add Class'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Classes List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h4 className="font-bold text-xs text-slate-800">
                {isBn ? 'বর্তমান সক্রিয় শ্রেণি ও শাখাসমূহ' : 'Existing Classes & Sections Directory'}
              </h4>
            </div>

            <div className="divide-y divide-slate-100">
              {classes.map((c) => {
                const classSections = sections.filter(s => s.classId === c.id);

                return (
                  <div key={c.id} className="p-4 hover:bg-slate-50 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                          {c.order}
                        </span>
                        <span className="font-bold text-sm text-slate-900">{c.name}</span>
                        {c.nameEn && <span className="text-xs text-slate-400">({c.nameEn})</span>}
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setEditingClass(c)}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="সম্পাদনা"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClass(c.id, c.name)}
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Class Fees */}
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
                      <span>আবাসিক: <b>{formatBDT(c.fees?.residential || 3500, isBn)}</b></span>
                      <span>অনাবাসিক: <b>{formatBDT(c.fees?.non_residential || 1500, isBn)}</b></span>
                      <span>ডে-কেয়ার: <b>{formatBDT(c.fees?.day_care || 2200, isBn)}</b></span>
                    </div>

                    {/* Section Badges */}
                    <div className="flex items-center space-x-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">শাখা:</span>
                      {classSections.length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">কোনো শাখা নেই</span>
                      ) : (
                        classSections.map(s => (
                          <span key={s.id} className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            <span>{s.name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSection(s.id, s.name)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Section to Class Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800">
              {isBn ? 'শ্রেণিতে নতুন শাখা (Section) যুক্ত করুন' : 'Add Section to Class'}
            </h4>

            <form onSubmit={handleAddSection} className="flex flex-col sm:flex-row gap-3 text-xs">
              <select
                value={selectedClassForSection}
                onChange={(e) => setSelectedClassForSection(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white font-semibold flex-1"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder={isBn ? 'শাখার নাম (যেমন: ক, খ, বা নূর, মাদানী)' : 'Section name...'}
                className="px-3 py-2 border rounded-lg flex-1"
                required
              />

              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs whitespace-nowrap"
              >
                {isBn ? '+ শাখা যুক্ত করুন' : '+ Add Section'}
              </button>
            </form>
          </div>

          {/* Edit Class Modal */}
          {editingClass && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900">{isBn ? 'শ্রেণি সম্পাদনা' : 'Edit Class'}</h3>
                  <button onClick={() => setEditingClass(null)} className="text-slate-400">✕</button>
                </div>

                <form onSubmit={handleUpdateClass} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'শ্রেণির নাম' : 'Name'}</label>
                    <input
                      type="text"
                      value={editingClass.name}
                      onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">{isBn ? 'ক্রম' : 'Order'}</label>
                    <input
                      type="number"
                      value={editingClass.order}
                      onChange={(e) => setEditingClass({ ...editingClass, order: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <span className="font-bold block text-slate-700">{isBn ? 'শ্রেণিভিত্তিক ডিফল্ট ফি (Method B):' : 'Fees:'}</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px]">আবাসিক</label>
                        <input
                          type="number"
                          value={editingClass.fees?.residential || 3500}
                          onChange={(e) => setEditingClass({
                            ...editingClass,
                            fees: { ...editingClass.fees, residential: Number(e.target.value) } as any
                          })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px]">অনাবাসিক</label>
                        <input
                          type="number"
                          value={editingClass.fees?.non_residential || 1500}
                          onChange={(e) => setEditingClass({
                            ...editingClass,
                            fees: { ...editingClass.fees, non_residential: Number(e.target.value) } as any
                          })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px]">ডে-কেয়ার</label>
                        <input
                          type="number"
                          value={editingClass.fees?.day_care || 2200}
                          onChange={(e) => setEditingClass({
                            ...editingClass,
                            fees: { ...editingClass.fees, day_care: Number(e.target.value) } as any
                          })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setEditingClass(null)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      {isBn ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                    >
                      {isBn ? 'সংরক্ষণ' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Authority Signature & Seal Management */}
      {activeTab === 'signatory' && (
        <form onSubmit={handleSaveSignatory} className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <PenTool className="w-4 h-4 text-blue-600" />
                  <span>{isBn ? 'মুহতামিম ও কর্তৃপক্ষের অফিসিয়াল স্বাক্ষর ও সিল' : 'Authority Signature & Seal Settings'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isBn 
                    ? 'সমস্ত শিক্ষক বেতন ভাউচার, পে-স্লিপ, রসিদ এবং নোটিশ বোর্ডে এই স্বাক্ষর ডিফল্ট হিসেবে মুদ্রিত হবে।' 
                    : 'This official signature will appear by default on all payslips, vouchers, receipts, and notices.'}
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {isBn ? 'অফিসিয়াল অথরাইজড সিগনেচার' : 'Official Authorized Signature'}
              </span>
            </div>

            {/* 1. Signatory Name & Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'স্বাক্ষরকারীর নাম *' : 'Signatory Full Name *'}
                </label>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder={isBn ? 'যেমন: মাওলানা তামিম নূর' : 'e.g. Maulana Tamim Nur'}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-900"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {isBn ? 'স্বাক্ষর রেখার ঠিক নিচে এই ব্যক্তির নাম প্রদর্শিত হবে' : 'This name appears directly beneath the signature line'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'পদবি (Designation / Title) *' : 'Designation / Title *'}
                </label>
                <input
                  type="text"
                  value={signatoryTitle}
                  onChange={(e) => setSignatoryTitle(e.target.value)}
                  placeholder={isBn ? 'যেমন: মুহতামিম / প্রধান হিসাবরক্ষক' : 'e.g. Muhtamim / Head Accountant'}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-900"
                  required
                />
                {/* Presets */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    'মুহতামিম / প্রধান হিসাবরক্ষক',
                    'মুহতামিম ও পরিচালক',
                    'প্রধান শিক্ষক / মুহতামিম',
                    'প্রধান হিসাবরক্ষক'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSignatoryTitle(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition ${
                        signatoryTitle === preset
                          ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Signature Method Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {isBn ? 'স্বাক্ষর প্রদানের মাধ্যম নির্বাচন করুন:' : 'Select Signature Input Method:'}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSignatureType('drawn')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                    signatureType === 'drawn'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold ring-2 ring-blue-200'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <PenTool className="w-5 h-5 text-blue-600" />
                  <span className="text-xs">{isBn ? 'ডিজিটাল অঙ্কন' : 'Draw Digital'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSignatureType('image')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                    signatureType === 'image'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold ring-2 ring-blue-200'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs">{isBn ? 'ছবি আপলোড' : 'Upload Image'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSignatureType('text')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                    signatureType === 'text'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold ring-2 ring-blue-200'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Type className="w-5 h-5 text-amber-600" />
                  <span className="text-xs">{isBn ? 'স্টাইলিশ ফন্ট' : 'Stylized Text'}</span>
                </button>
              </div>
            </div>

            {/* 3. Signature Input Pad / Uploader */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              {signatureType === 'drawn' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {isBn ? 'এখানে মাউস বা আঙুল দিয়ে মুহতামিম সাহেবের স্বাক্ষর অঙ্কন করুন:' : 'Draw signature on the canvas:'}
                    </span>
                    {signatureDataUrl && (
                      <button
                        type="button"
                        onClick={() => setSignatureDataUrl('')}
                        className="text-xs text-rose-600 hover:underline flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isBn ? 'মুছে ফেলুন' : 'Clear'}</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-white rounded-xl p-2 border border-slate-300">
                    <SignaturePad
                      language={language}
                      onSignatureChange={(url) => setSignatureDataUrl(url || '')}
                    />
                  </div>
                </div>
              )}

              {signatureType === 'image' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-1/2">
                      <label className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white flex flex-col items-center justify-center space-y-1 text-slate-600 hover:text-blue-600 cursor-pointer transition">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="font-bold text-xs">{isBn ? 'স্বাক্ষরের ছবি আপলোড করুন' : 'Choose Signature Image'}</span>
                        <span className="text-[10px] text-slate-400">PNG / JPG / WebP (Max 2MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setSignatureDataUrl(ev.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>

                    <div className="w-full sm:w-1/2 p-4 bg-white rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[90px]">
                      {signatureDataUrl ? (
                        <div className="space-y-2">
                          <img
                            src={signatureDataUrl}
                            alt="Uploaded Signature"
                            className="h-14 max-w-[200px] object-contain mx-auto"
                          />
                          <button
                            type="button"
                            onClick={() => setSignatureDataUrl('')}
                            className="text-[10px] text-rose-600 hover:underline flex items-center justify-center space-x-1 mx-auto"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{isBn ? 'ছবি মুছুন' : 'Remove Image'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          {isBn ? 'কোনো ছবি আপলোড করা হয়নি' : 'No image uploaded yet'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {signatureType === 'text' && (
                <div className="space-y-2 text-center py-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">{isBn ? 'কম্পিউটারাইজড কলিগ্রাফিক স্বাক্ষর স্টাইল' : 'Calligraphic Font Signature'}</span>
                  <div className="font-serif italic text-blue-950 text-xl font-bold border-b border-dotted border-blue-900 pb-1 inline-block px-4">
                    {signatoryName || 'Jamia Madinatoon Noor'}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono font-medium flex items-center justify-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isBn ? 'দাপ্তরিক অনুমোদিত ডিজিটাল স্বাক্ষর' : 'Officially Authorized Digital Signature'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Madrasa Official Seal / Stamp */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="font-bold text-slate-800 text-xs block">
                  {isBn ? 'মাদরাসার অফিসিয়াল সিল / স্ট্যাম্প (ঐচ্ছিক)' : 'Official Madrasa Seal / Stamp (Optional)'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {isBn ? 'স্বাক্ষরের পাশে মাদরাসার গোলাকার অফিসিয়াল সিল প্রদর্শনের জন্য' : 'Display madrasa circular stamp alongside signature'}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                {sealUrl && (
                  <img
                    src={sealUrl}
                    alt="Seal"
                    className="w-12 h-12 object-contain rounded-full border border-slate-300 p-0.5 bg-white"
                  />
                )}

                <label className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition">
                  {sealUrl ? (isBn ? 'সিল পরিবর্তন' : 'Change Seal') : (isBn ? 'সিল আপলোড' : 'Upload Seal')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setSealUrl(ev.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>

                {sealUrl && (
                  <button
                    type="button"
                    onClick={() => setSealUrl('')}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="সিল মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 5. Live Document Preview Box */}
            <div className="border border-slate-300 rounded-2xl p-4 bg-gradient-to-b from-white to-slate-50/50 shadow-inner">
              <div className="flex items-center space-x-1.5 text-slate-500 font-bold text-[11px] mb-3">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'লাইভ প্রিভিউ: সমস্ত নোটিশ, বেতন ভাউচার ও স্লিপে যেভাবে প্রদর্শিত হবে' : 'Live Preview: As shown on notices and payslips'}</span>
              </div>

              <div className="flex justify-end p-6 bg-white rounded-xl border border-slate-200">
                <div className="flex flex-col items-center justify-end text-center relative max-w-[220px]">
                  {sealUrl && (
                    <img
                      src={sealUrl}
                      alt="Seal"
                      className="absolute -top-3 -right-6 w-14 h-14 object-contain opacity-70 pointer-events-none"
                    />
                  )}

                  <div className="h-14 flex items-center justify-center">
                    {signatureType === 'text' || !signatureDataUrl ? (
                      <span className="font-serif italic text-blue-900 text-sm font-bold border-b border-dotted border-blue-900 pb-0.5">
                        {signatoryName || 'Jamia Madinatoon Noor'}
                      </span>
                    ) : (
                      <img
                        src={signatureDataUrl}
                        alt={signatoryName}
                        className="h-12 max-w-[160px] object-contain mx-auto"
                      />
                    )}
                  </div>

                  <div className="border-t border-slate-500 w-44 pt-1 text-[11px] font-bold text-slate-900">
                    {signatoryTitle || 'মুহতামিম / প্রধান হিসাবরক্ষক'}
                  </div>
                  <p className="text-[10px] text-slate-700 font-semibold">
                    {signatoryName}
                  </p>
                  <p className="text-[8px] text-slate-400">
                    {settings.institutionName}
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingSignatory}
                className="flex items-center space-x-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition disabled:opacity-50"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>
                  {savingSignatory 
                    ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') 
                    : (isBn ? 'মুহতামিমের স্বাক্ষর নিশ্চিত ও সংরক্ষণ করুন' : 'Save Authority Signature')}
                </span>
              </button>
            </div>

          </div>
        </form>
      )}
    </div>
  );
};
