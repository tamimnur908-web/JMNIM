import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  PenTool, 
  Upload, 
  Type, 
  Check, 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle,
  Eye,
  FileCheck2
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { logAudit } from '../utils/auditLogger';
import { SignaturePad } from './SignaturePad';

interface AuthoritySignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthoritySignatureModal: React.FC<AuthoritySignatureModalProps> = ({
  isOpen,
  onClose
}) => {
  const { settings, updateSettings } = useSettings();
  const { language } = useLanguage();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [signatoryName, setSignatoryName] = useState(settings.authorizedSignatoryName || 'মাওলানা তামিম নূর');
  const [signatoryTitle, setSignatoryTitle] = useState(settings.authorizedSignatoryTitle || 'মুহতামিম / প্রধান হিসাবরক্ষক');
  const [signatureType, setSignatureType] = useState<'drawn' | 'image' | 'text'>(
    settings.authorizedSignatoryType || 'text'
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>(settings.authorizedSignatorySignatureUrl || '');
  const [sealUrl, setSealUrl] = useState<string>(settings.authorizedSignatorySealUrl || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sealInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when settings change or modal opens
  useEffect(() => {
    if (isOpen) {
      setSignatoryName(settings.authorizedSignatoryName || 'মাওলানা তামিম নূর');
      setSignatoryTitle(settings.authorizedSignatoryTitle || 'মুহতামিম / প্রধান হিসাবরক্ষক');
      setSignatureType(settings.authorizedSignatoryType || (settings.authorizedSignatorySignatureUrl ? 'image' : 'text'));
      setSignatureDataUrl(settings.authorizedSignatorySignatureUrl || '');
      setSealUrl(settings.authorizedSignatorySealUrl || '');
      setSaveSuccess(false);
      setErrorMsg(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(isBn ? 'অনুগ্রহ করে শুধুমাত্র ছবি ফাইল নির্বাচন করুন (PNG, JPG, WebP)।' : 'Please select a valid image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(isBn ? 'ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট হতে পারে।' : 'Image size cannot exceed 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSignatureDataUrl(result);
      setSignatureType('image');
    };
    reader.readAsDataURL(file);
  };

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(isBn ? 'অনুগ্রহ করে শুধুমাত্র ছবি ফাইল নির্বাচন করুন।' : 'Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSealUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatoryName.trim()) {
      setErrorMsg(isBn ? 'স্বাক্ষরকারীর নাম আবশ্যক!' : 'Signatory name is required!');
      return;
    }

    setSaving(true);
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
        module: 'Institution Settings',
        recordId: 'institution_settings_default',
        recordType: 'InstitutionSettings',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `কর্তৃপক্ষের স্বাক্ষর হালনাগাদ করা হয়েছে: নাম: "${signatoryName}", পদবি: "${signatoryTitle}", মাধ্যম: "${signatureType}"`
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to save authority signature:", err);
      setErrorMsg(err.message || 'Error saving signature settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <PenTool className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isBn ? 'মুহতামিম ও কর্তৃপক্ষের অফিসিয়াল স্বাক্ষর সেটিংস' : 'Authority & Muhtamim Signature Settings'}
              </h3>
              <p className="text-xs text-slate-300">
                {isBn ? 'সমস্ত নোটিশ, বেতন ভাউচার ও স্লিপে এই স্বাক্ষর ডিফল্ট হিসেবে প্রদর্শিত হবে' : 'This signature appears by default on all notices and payslips'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center space-x-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">
                {isBn ? 'কর্তৃপক্ষের স্বাক্ষর সফলভাবে সংরক্ষিত হয়েছে এবং সমস্ত রশিদে যুক্ত করা হয়েছে!' : 'Authority signature saved successfully!'}
              </span>
            </div>
          )}

          {/* 1. Signatory Name & Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isBn ? 'স্বাক্ষরকারীর পূর্ণ নাম *' : 'Signatory Full Name *'}
              </label>
              <input
                type="text"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                placeholder={isBn ? 'যেমন: মাওলানা তামিম নূর' : 'e.g. Maulana Tamim Nur'}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {isBn ? 'স্বাক্ষর রেখার নিচে এই নাম মুদ্রিত হবে' : 'Printed under the signature line'}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isBn ? 'পদবি (Designation) *' : 'Designation / Title *'}
              </label>
              <input
                type="text"
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                placeholder={isBn ? 'যেমন: মুহতামিম / প্রধান হিসাবরক্ষক' : 'e.g. Muhtamim / Head Accountant'}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                required
              />
              {/* Quick Preset Buttons */}
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

          {/* 2. Signature Method Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-2">
              {isBn ? 'স্বাক্ষরের মাধ্যম নির্বাচন করুন:' : 'Select Signature Input Method:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
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
                <span className="text-[11px]">{isBn ? 'ডিজিটাল অঙ্কন' : 'Draw Digital'}</span>
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
                <span className="text-[11px]">{isBn ? 'ছবি আপলোড' : 'Upload Image'}</span>
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
                <span className="text-[11px]">{isBn ? 'স্টাইলিশ ফন্ট' : 'Stylized Text'}</span>
              </button>
            </div>
          </div>

          {/* 3. Signature Input Area */}
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
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white flex flex-col items-center justify-center space-y-1 text-slate-600 hover:text-blue-600 transition"
                    >
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="font-bold text-xs">{isBn ? 'স্বাক্ষরের ছবি নির্বাচন করুন' : 'Choose Signature Image'}</span>
                      <span className="text-[10px] text-slate-400">PNG / JPG / WebP (Max 2MB)</span>
                    </button>
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
                          <span>{isBn ? 'ছবি পরিবর্তন / মুছুন' : 'Remove Image'}</span>
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
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">
                  {isBn ? 'মাদরাসার অফিসিয়াল সিল / স্ট্যাম্প (ঐচ্ছিক)' : 'Official Madrasa Seal / Stamp (Optional)'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {isBn ? 'স্বাক্ষরের পাশে মাদরাসার গোলাকার অফিসিয়াল সিল প্রদর্শনের জন্য' : 'Display madrasa circular stamp alongside signature'}
                </span>
              </div>
              <input
                type="file"
                ref={sealInputRef}
                onChange={handleSealUpload}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
              />
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => sealInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-slate-700 text-xs font-semibold shadow-2xs transition"
                >
                  {sealUrl ? (isBn ? 'সিল পরিবর্তন' : 'Change Seal') : (isBn ? 'সিল আপলোড' : 'Upload Seal')}
                </button>
                {sealUrl && (
                  <button
                    type="button"
                    onClick={() => setSealUrl('')}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="সিল মুছুন"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {sealUrl && (
              <div className="flex items-center space-x-3 pt-2 border-t border-slate-200">
                <img
                  src={sealUrl}
                  alt="Madrasa Seal"
                  className="w-12 h-12 object-contain rounded-full border border-slate-300 p-0.5 bg-white"
                />
                <span className="text-xs text-emerald-700 font-medium">✓ {isBn ? 'অফিসিয়াল সিল সক্রিয় রয়েছে' : 'Official seal active'}</span>
              </div>
            )}
          </div>

          {/* 5. Live Document Preview Box */}
          <div className="border border-slate-300 rounded-2xl p-4 bg-gradient-to-b from-white to-slate-50/50 shadow-inner">
            <div className="flex items-center space-x-1.5 text-slate-500 font-bold text-[11px] mb-3">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBn ? 'লাইভ প্রিভিউ: ভাউচার, নোটিশ ও রশিদে যেভাবে দেখা যাবে' : 'Live Preview: As shown on payslips and vouchers'}</span>
            </div>

            <div className="flex justify-end p-4 bg-white rounded-xl border border-slate-200">
              <div className="flex flex-col items-center justify-end text-center relative max-w-[200px]">
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
                      className="h-12 max-w-[150px] object-contain mx-auto"
                    />
                  )}
                </div>

                <div className="border-t border-slate-500 w-40 pt-1 text-[11px] font-bold text-slate-900">
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>
                {saving 
                  ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') 
                  : (isBn ? 'স্বাক্ষর নিশ্চিত ও সংরক্ষণ করুন' : 'Save Authority Signature')}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
