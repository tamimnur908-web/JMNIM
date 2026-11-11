import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { SalaryPayment } from '../types';
import { formatBDT, formatSalaryMonth } from '../utils/formatters';
import { SignaturePad } from './SignaturePad';
import { uploadSignatureImage } from '../utils/signatureStorage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logAudit } from '../utils/auditLogger';

interface TeacherAcknowledgmentModalProps {
  payment: SalaryPayment;
  teacherName: string;
  teacherId: string;
  designation?: string;
  department?: string;
  userUid: string;
  settings: {
    institutionName: string;
    institutionNameEn: string;
  };
  language: 'bn' | 'en';
  onClose: () => void;
  onSuccess: (updatedPayment: SalaryPayment) => void;
}

export const TeacherAcknowledgmentModal: React.FC<TeacherAcknowledgmentModalProps> = ({
  payment,
  teacherName,
  teacherId,
  designation,
  department,
  userUid,
  settings,
  language,
  onClose,
  onSuccess
}) => {
  const isBn = language === 'bn';
  const [declared, setDeclared] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const declarationText = isBn
    ? 'আমি স্বীকার করছি যে, উপরে উল্লেখিত মাসের জন্য প্রদেয় বেতনের সম্পূর্ণ টাকা আমি বুঝে পেয়েছি। প্রদত্ত বেতন ও পরিশোধের বিবরণ আমার জানা ও সম্মতিক্রমে সঠিক।'
    : 'I hereby acknowledge that I have received the full salary amount stated above for the specified month. I confirm that the payment details and amount are correct to the best of my knowledge.';

  const handleOpenConfirmDialog = () => {
    if (!declared) {
      setErrorMessage(
        isBn
          ? 'অনুগ্রহ করে বেতন গ্রহণের স্বীকৃতি বাক্সে টিক দিন।'
          : 'Please check the salary receipt acknowledgment declaration.'
      );
      return;
    }
    if (!signatureData) {
      setErrorMessage(
        isBn
          ? 'অনুগ্রহ করে নিচে আপনার ডিজিটাল স্বাক্ষর অঙ্কন করুন।'
          : 'Please draw your digital signature below.'
      );
      return;
    }
    setErrorMessage(null);
    setShowConfirmDialog(true);
  };

  const handleFinalSubmit = async () => {
    if (!declared || !signatureData) return;
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Upload signature image to Firebase Storage (with base64 fallback)
      const signatureUrl = await uploadSignatureImage(signatureData, payment.id, teacherId);

      const now = new Date().toISOString();
      const receiptNumber = payment.receiptNumber || `REC-${payment.voucherNumber || payment.id.slice(-6)}`;

      const updatePayload: Partial<SalaryPayment> = {
        acknowledgmentStatus: 'acknowledged',
        signatureUrl,
        acknowledgedAt: now,
        acknowledgedByUid: userUid,
        acknowledgedByName: teacherName,
        acknowledgmentDeclaration: declarationText,
        acknowledgmentLanguage: language,
        updatedAt: now
      };

      if (!payment.receiptNumber) {
        updatePayload.receiptNumber = receiptNumber;
      }

      // 2. Update Firestore payment document with timeout protection
      await Promise.race([
        updateDoc(doc(db, 'salary_payments', payment.id), updatePayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error(isBn ? 'ডেটাবেজ আপডেট টাইমআউট হয়েছে।' : 'Database update timed out.')), 6000))
      ]);

      // 3. Log Audit Record
      await logAudit({
        action: 'Salary Receipt Acknowledged',
        module: 'Teacher Salary & Payroll',
        recordId: payment.id,
        recordType: 'SalaryPayment',
        performedBy: teacherName,
        performedByRole: 'teacher',
        performedByUid: userUid,
        newValue: {
          voucherNumber: payment.voucherNumber,
          month: payment.month,
          paidAmount: payment.paidAmount,
          receiptNumber,
          acknowledgedAt: now
        },
        details: `${teacherName} (${teacherId})-এর ${payment.month} মাসের বেতন প্রাপ্তি ই-স্বাক্ষরসহ স্বীকৃত হয়েছে (রশিদ: ${receiptNumber}, টাকা: ৳${payment.paidAmount})`
      });

      const updatedPayment: SalaryPayment = {
        ...payment,
        ...updatePayload
      };

      onSuccess(updatedPayment);
    } catch (err: any) {
      console.error("Error acknowledging salary:", err);
      setErrorMessage(
        (isBn ? 'স্বীকৃতি সংরক্ষণ ব্যর্থ হয়েছে: ' : 'Failed to save acknowledgment: ') +
        (err.message || 'Unknown error')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto animate-fadeIn">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'বেতন গ্রহণ নিশ্চিতকরণ ও ডিজিটাল স্বাক্ষর' : 'Salary Receipt Confirmation & Digital Sign'}
              </h3>
              <p className="text-xs text-slate-500">
                {isBn ? settings.institutionName : settings.institutionNameEn}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Read-Only Salary Breakdown Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
            <div>
              <span className="text-slate-400 block text-[10px]">{isBn ? 'শিক্ষক:' : 'Teacher:'}</span>
              <span className="font-bold text-slate-900">{teacherName}</span>
              <span className="text-[10px] text-blue-600 font-mono ml-1">({teacherId})</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">{isBn ? 'পদবি ও বিভাগ:' : 'Designation:'}</span>
              <span className="font-medium text-slate-800">{designation || '-'} {department ? `(${department})` : ''}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">{isBn ? 'বেতনের মাস:' : 'Salary Month:'}</span>
              <span className="font-bold text-blue-700">{formatSalaryMonth(payment.month, isBn)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">{isBn ? 'পরিশোধের তারিখ ও মাধ্যম:' : 'Payment Date & Method:'}</span>
              <span className="font-medium text-slate-800">{payment.paymentDate} ({payment.paymentMethod.toUpperCase()})</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">{isBn ? 'মূল বেতন:' : 'Base Salary:'}</span>
              <span className="font-bold text-slate-900">{formatBDT(payment.baseSalary, isBn)}</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">{isBn ? 'ভাতা ও বোনাস:' : 'Allowance & Bonus:'}</span>
              <span className="font-bold text-emerald-700">+{formatBDT(payment.allowances + payment.bonus, isBn)}</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">{isBn ? 'মোট কর্তন:' : 'Deductions:'}</span>
              <span className="font-bold text-rose-600">-{formatBDT(payment.advanceDeduction + payment.otherDeduction, isBn)}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 text-emerald-950 border border-emerald-300 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold block">{isBn ? 'প্রদেয় / পরিশোধিত নিট বেতন:' : 'Net Payable Amount:'}</span>
              <span className="text-[10px] text-emerald-700 font-mono">ভাউচার: {payment.voucherNumber}</span>
            </div>
            <span className="text-xl font-black text-emerald-800">{formatBDT(payment.paidAmount, isBn)}</span>
          </div>
        </div>

        {/* Declaration Checkbox */}
        <div className="bg-blue-50/50 border border-blue-200 p-3.5 rounded-xl space-y-2">
          <div className="flex items-start space-x-2.5">
            <input
              type="checkbox"
              id="declarationCheckbox"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="declarationCheckbox" className="text-xs font-medium text-slate-800 cursor-pointer select-none leading-relaxed">
              <b className="text-blue-900 block mb-0.5">{isBn ? 'বেতন গ্রহণের স্বীকৃতি:' : 'Salary Receipt Acknowledgment:'}</b>
              "{declarationText}"
            </label>
          </div>
        </div>

        {/* Digital Signature Pad */}
        <div className="space-y-1">
          <SignaturePad
            onSignatureChange={(dataUrl) => setSignatureData(dataUrl)}
            language={language}
            disabled={isSubmitting}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            {isBn ? 'বাতিল' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleOpenConfirmDialog}
            disabled={!declared || !signatureData || isSubmitting}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              declared && signatureData && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'স্বাক্ষরসহ বেতন গ্রহণ নিশ্চিত করুন' : 'Confirm Salary Receipt with Signature'}</span>
              </>
            )}
          </button>
        </div>

        {/* Confirmation Alert Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-900">
                  {isBn ? 'চূড়ান্ত নিশ্চিতকরণ' : 'Final Confirmation'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isBn
                    ? 'আপনি কি নিশ্চিত যে, প্রদত্ত বেতন সম্পূর্ণ বুঝে পেয়েছেন এবং এই স্বাক্ষরটি আপনার নিজের?'
                    : 'Are you sure that you have received the full salary and this signature is your own?'}
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  {isBn ? 'পুনর্বিবেচনা' : 'Review Again'}
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {isBn ? 'হ্যাঁ, নিশ্চিত করছি' : 'Yes, I Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};