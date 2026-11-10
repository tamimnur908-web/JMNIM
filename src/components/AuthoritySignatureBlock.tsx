import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { PenTool } from 'lucide-react';

interface AuthoritySignatureBlockProps {
  customTitle?: string;
  customName?: string;
  showSeal?: boolean;
  onEdit?: () => void;
  className?: string;
}

export const AuthoritySignatureBlock: React.FC<AuthoritySignatureBlockProps> = ({
  customTitle,
  customName,
  showSeal = true,
  onEdit,
  className = ''
}) => {
  const { settings } = useSettings();
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const signatoryName = customName || settings.authorizedSignatoryName || 'মাওলানা তামিম নূর';
  const signatoryTitle = customTitle || settings.authorizedSignatoryTitle || (isBn ? 'মুহতামিম / প্রধান হিসাবরক্ষক' : 'Authorized Signatory');
  const signatureUrl = settings.authorizedSignatorySignatureUrl;
  const sealUrl = showSeal ? settings.authorizedSignatorySealUrl : undefined;

  return (
    <div className={`flex flex-col items-center justify-end text-center relative group min-w-[150px] ${className}`}>
      {/* Official Seal overlay if active */}
      {sealUrl && (
        <img
          src={sealUrl}
          alt="Official Seal"
          className="absolute -top-3 -right-4 w-12 h-12 object-contain opacity-75 pointer-events-none"
        />
      )}

      {/* Signature Area (image or computerized signature) */}
      <div className="h-12 flex items-center justify-center">
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt={signatoryName}
            className="h-11 max-w-[140px] object-contain mx-auto"
          />
        ) : (
          <span className="font-serif italic text-blue-900 text-xs font-bold border-b border-dotted border-blue-900 pb-0.5">
            {signatoryName}
          </span>
        )}
      </div>

      {/* Signature Line */}
      <div className="border-t border-slate-500 w-36 pt-1 text-[11px] font-bold text-slate-800">
        {signatoryTitle}
      </div>

      {/* Signatory Name */}
      <p className="text-[9px] text-slate-700 font-medium">
        {signatoryName}
      </p>

      {/* Madrasa Name */}
      <p className="text-[8px] text-slate-400">
        {settings.institutionName}
      </p>

      {/* Quick Edit pill for Admin (no-print) */}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="no-print mt-1 text-[9px] text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center space-x-0.5 opacity-80 hover:opacity-100 transition"
          title={isBn ? 'কর্তৃপক্ষের স্বাক্ষর সম্পাদনা করুন' : 'Edit Signature'}
        >
          <PenTool className="w-2.5 h-2.5" />
          <span>{isBn ? 'স্বাক্ষর পরিবর্তন' : 'Change Signature'}</span>
        </button>
      )}
    </div>
  );
};
