import React from 'react';
import { Printer, X, CheckCircle2, ShieldCheck, AlertCircle, FileText } from 'lucide-react';
import { SalaryPayment } from '../types';
import { formatBDT, formatSalaryMonth, formatDate } from '../utils/formatters';

interface SalaryReceiptModalProps {
  payment: SalaryPayment;
  onClose: () => void;
  settings: {
    institutionName: string;
    institutionNameEn: string;
    address: string;
    phone: string;
  };
  language: 'bn' | 'en';
}

export const SalaryReceiptModal: React.FC<SalaryReceiptModalProps> = ({
  payment,
  onClose,
  settings,
  language
}) => {
  const isBn = language === 'bn';
  const isAcknowledged = payment.acknowledgmentStatus === 'acknowledged';
  const isLegacy = !payment.acknowledgmentStatus || payment.acknowledgmentStatus === 'legacy';

  const receiptNo = payment.receiptNumber || `REC-${payment.voucherNumber || payment.id.slice(-6)}`;

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString(isBn ? 'bn-BD' : 'en-US', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto print:shadow-none print:p-0 print:max-w-none print:w-full print:border-none">
        
        {/* Modal Controls Header (Hidden on Print) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 no-print">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {isAcknowledged
                  ? (isBn ? 'ডিজিটাল স্বাক্ষরিত বেতন প্রাপ্তি রশিদ' : 'Digitally Signed Salary Receipt')
                  : (isBn ? 'শিক্ষক বেতন ভাউচার ও পে-স্লিপ' : 'Teacher Salary Voucher & Payslip')}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {receiptNo}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রিন্ট রশিদ' : 'Print Receipt'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div id="salary-printable-receipt" className="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-xs print:bg-white print:border-none print:p-0 print:space-y-4">
          
          {/* Institutional Header */}
          <div className="text-center border-b border-slate-300 pb-3 relative">
            <div className="flex items-center justify-center space-x-3 mb-1">
              <img src="/logo.png" alt="Madrasa Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {isBn ? settings.institutionName : settings.institutionNameEn}
                </h1>
                <p className="text-[11px] font-semibold text-slate-600">
                  {isBn ? settings.institutionNameEn : settings.institutionName}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {settings.address} • ফোন: {settings.phone}
            </p>

            <div className="mt-2 inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
              <span>{isBn ? 'মাসিক বেতন প্রাপ্তি রশিদ ও ভাউচার' : 'Monthly Salary Receipt & Voucher'}</span>
            </div>
          </div>

          {/* Status Alert Banner */}
          {isAcknowledged ? (
            <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-lg flex items-center justify-between text-emerald-900">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-xs">
                  {isBn ? 'বেতন গ্রহণ নিশ্চিতকৃত ও শিক্ষক কর্তৃক স্বাক্ষরিত' : 'Salary Receipt Confirmed & Teacher Signed'}
                </span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                {isBn ? 'যাচাইকৃত ই-স্বাক্ষর' : 'Verified E-Signature'}
              </span>
            </div>
          ) : isLegacy ? (
            <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg flex items-center space-x-2 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-xs">
                {isBn
                  ? 'পুরোনো বেতন রেকর্ড - ডিজিটাল স্বাক্ষর সংরক্ষিত নেই'
                  : 'Legacy Payment - No Digital Acknowledgment'}
              </span>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg flex items-center space-x-2 text-blue-900">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-xs">
                {isBn
                  ? 'বেতন পরিশোধিত - শিক্ষকের ডিজিটাল প্রাপ্তি স্বীকৃতি অপেক্ষমান'
                  : 'Salary Paid - Awaiting Teacher Digital Acknowledgment'}
              </span>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-white rounded-lg border border-slate-200 text-[11px]">
            <div>
              <span className="text-slate-400 block">{isBn ? 'রশিদ / রেফারেন্স নং:' : 'Receipt / Ref No:'}</span>
              <span className="font-mono font-bold text-slate-900">{receiptNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block">{isBn ? 'ভাউচার নম্বর:' : 'Voucher No:'}</span>
              <span className="font-mono font-semibold text-slate-800">{payment.voucherNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block">{isBn ? 'বেতনের মাস:' : 'Salary Month:'}</span>
              <span className="font-bold text-blue-700">{formatSalaryMonth(payment.month, isBn)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">{isBn ? 'শিক্ষকের নাম ও আইডি:' : 'Teacher Name & ID:'}</span>
              <span className="font-bold text-slate-900">{payment.teacherName} ({payment.teacherId})</span>
            </div>
            <div>
              <span className="text-slate-400 block">{isBn ? 'পদবি ও বিভাগ:' : 'Designation & Dept:'}</span>
              <span className="text-slate-700">{payment.designation || '-'} {payment.department ? `(${payment.department})` : ''}</span>
            </div>
            <div>
              <span className="text-slate-400 block">{isBn ? 'পরিশোধের তারিখ ও মাধ্যম:' : 'Payment Date & Method:'}</span>
              <span className="font-semibold text-slate-900">
                {payment.paymentDate} ({payment.paymentMethod.toUpperCase()})
              </span>
            </div>
          </div>

          {/* Salary Breakdown Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5">{isBn ? 'বিবরণ' : 'Description'}</th>
                  <th className="p-2.5 text-right">{isBn ? 'পরিমাণ (টাকা)' : 'Amount (BDT)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-2.5 text-slate-800">{isBn ? 'মূল বেতন (Basic Salary)' : 'Basic Salary'}</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">{formatBDT(payment.baseSalary, isBn)}</td>
                </tr>
                {payment.allowances > 0 && (
                  <tr>
                    <td className="p-2.5 text-slate-800">{isBn ? 'ভাতা (House / Medical Allowance)' : 'Allowances'}</td>
                    <td className="p-2.5 text-right font-semibold text-emerald-700">+{formatBDT(payment.allowances, isBn)}</td>
                  </tr>
                )}
                {payment.bonus > 0 && (
                  <tr>
                    <td className="p-2.5 text-slate-800">{isBn ? 'বোনাস / ইনসেন্টিভ (Bonus)' : 'Bonus'}</td>
                    <td className="p-2.5 text-right font-semibold text-emerald-700">+{formatBDT(payment.bonus, isBn)}</td>
                  </tr>
                )}
                {payment.advanceDeduction > 0 && (
                  <tr>
                    <td className="p-2.5 text-slate-800">{isBn ? 'অগ্রিম বেতন কর্তন (Advance Deduction)' : 'Advance Deduction'}</td>
                    <td className="p-2.5 text-right font-semibold text-rose-600">-{formatBDT(payment.advanceDeduction, isBn)}</td>
                  </tr>
                )}
                {payment.otherDeduction > 0 && (
                  <tr>
                    <td className="p-2.5 text-slate-800">{isBn ? 'অন্যান্য কর্তন (Other Deduction)' : 'Other Deduction'}</td>
                    <td className="p-2.5 text-right font-semibold text-rose-600">-{formatBDT(payment.otherDeduction, isBn)}</td>
                  </tr>
                )}
                <tr className="bg-emerald-50 text-emerald-950 font-black border-t-2 border-emerald-300">
                  <td className="p-2.5 text-sm">{isBn ? 'সর্বমোট পরিশোধিত টাকা (Net Paid Amount):' : 'Net Paid Amount:'}</td>
                  <td className="p-2.5 text-right text-base text-emerald-800">{formatBDT(payment.paidAmount, isBn)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Teacher Acknowledgment & Digital Signature Evidence */}
          {isAcknowledged && (
            <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                {isBn ? 'শিক্ষকের ডিজিটাল প্রাপ্তি স্বীকৃতি ও ঘোষণা' : 'Teacher Digital Acknowledgment Declaration'}
              </span>
              <p className="text-[11px] italic text-slate-700 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                "{payment.acknowledgmentDeclaration || (isBn
                  ? 'আমি স্বীকার করছি যে, উপরে উল্লেখিত মাসের জন্য প্রদেয় বেতনের সম্পূর্ণ টাকা আমি বুঝে পেয়েছি। প্রদত্ত বেতন ও পরিশোধের বিবরণ আমার জানা ও সম্মতিক্রমে সঠিক।'
                  : 'I hereby acknowledge that I have received the full salary amount stated above for the specified month. I confirm that the payment details and amount are correct to the best of my knowledge.')}"
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>
                  <b>{isBn ? 'স্বীকৃতির সময়:' : 'Acknowledgment Time:'}</b> {formatTimestamp(payment.acknowledgedAt)}
                </span>
                <span>
                  <b>{isBn ? 'স্বাক্ষরকারী UID:' : 'Signer UID:'}</b> <span className="font-mono">{payment.acknowledgedByUid?.slice(0, 10)}...</span>
                </span>
              </div>
            </div>
          )}

          {/* Signature Footer */}
          <div className="pt-6 sm:pt-8 grid grid-cols-2 gap-4">
            
            {/* Teacher Signature Box */}
            <div className="flex flex-col items-center justify-end text-center">
              {payment.signatureUrl ? (
                <div className="space-y-1 mb-1">
                  <img
                    src={payment.signatureUrl}
                    alt="Teacher Digital Signature"
                    className="h-12 max-w-[150px] object-contain mx-auto"
                  />
                  <div className="text-[9px] text-emerald-700 font-mono font-medium">
                    ✓ Verified Digital Sign
                  </div>
                </div>
              ) : (
                <div className="h-12 flex items-center justify-center text-slate-300 text-[10px] italic">
                  {isLegacy ? (isBn ? '(ডিজিটাল স্বাক্ষর নেই)' : '(No digital sign)') : (isBn ? '(অপেক্ষমান)' : '(Pending)')}
                </div>
              )}
              <div className="border-t border-slate-500 w-36 pt-1 text-[11px] font-bold text-slate-800">
                {isBn ? 'শিক্ষকের স্বাক্ষর' : 'Teacher Signature'}
              </div>
              <p className="text-[9px] text-slate-500">
                {payment.teacherName} ({payment.teacherId})
              </p>
            </div>

            {/* Authority Signature Box */}
            <div className="flex flex-col items-center justify-end text-center">
              <div className="h-12 flex items-center justify-center">
                <span className="font-serif italic text-blue-900 text-xs font-bold border-b border-dotted border-blue-900 pb-0.5">
                  Jamia Madinatoon Noor
                </span>
              </div>
              <div className="border-t border-slate-500 w-36 pt-1 text-[11px] font-bold text-slate-800">
                {isBn ? 'মুহতামিম / প্রধান হিসাবরক্ষক' : 'Authorized Signatory'}
              </div>
              <p className="text-[9px] text-slate-500">
                {settings.institutionName}
              </p>
            </div>

          </div>

          {/* Print Watermark / Footer */}
          <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-slate-200">
            {isBn 
              ? 'এটি জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসার স্বয়ংক্রিয় ই-পে-রোল সিস্টেম কর্তৃক প্রস্তুতকৃত দাপ্তরিক আর্থিক রেকর্ড।'
              : 'This is an official financial record generated by Jamia Madinatoon Noor Islamia Madrasha ERP Payroll System.'}
          </div>

        </div>

      </div>
    </div>
  );
};