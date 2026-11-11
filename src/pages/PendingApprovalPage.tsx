import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Clock, 
  ShieldAlert, 
  LogOut, 
  RefreshCw, 
  AlertOctagon, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { AnimatedBotanicalCorner } from '../components/AnimatedBotanicalCorner';

export const PendingApprovalPage: React.FC = () => {
  const { currentUser, userProfile, logout, refreshUserProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const isBn = language === 'bn';

  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const isRejected = userProfile?.status === 'rejected' || userProfile?.approvalStatus === 'rejected';
  const isDisabled = userProfile?.status === 'disabled' || userProfile?.accountStatus === 'disabled';

  const handleRefresh = async () => {
    setRefreshing(true);
    setFeedbackMsg(null);
    try {
      await refreshUserProfile();
      setFeedbackMsg(isBn ? 'স্ট্যাটাস যাচাই করা হয়েছে।' : 'Status verified.');
    } catch (err: any) {
      console.warn("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-amber-50/30 flex flex-col items-center justify-center p-3 pt-16 sm:p-6 lg:p-8 font-bengali relative overflow-x-hidden">
      {/* Language Switcher */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center bg-white/90 backdrop-blur-sm p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setLanguage('bn')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              language === 'bn' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাংলা
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              language === 'en' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <AnimatedBotanicalCorner />

      <div className="w-full max-w-lg relative z-10">
        {/* Madrasa Brand Card */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white p-2 shadow-xl border border-slate-200/80 mb-3">
            <img 
              src="/logo.png" 
              alt="JMNIM Logo" 
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            {isBn ? "জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসা" : "Jamia Madinatun Nur Islamia Madrasha"}
          </h1>
          <p className="text-xs text-amber-800 font-semibold mt-1">
            {isBn ? "স্থাপিত : ২০১৬ইং • পূর্ণাঙ্গ ডিজিটাল ব্যবস্থাপনা পদ্ধতি" : "Est: 2016 • Integrated Digital ERP System"}
          </p>
        </div>

        {/* Main Status Container */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 relative overflow-hidden">
          {/* Top Status Banner */}
          <div className="text-center mb-6">
            {isRejected ? (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 text-red-600 mb-4 shadow-inner">
                <AlertOctagon className="w-9 h-9" />
              </div>
            ) : isDisabled ? (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-200 text-slate-700 mb-4 shadow-inner">
                <ShieldAlert className="w-9 h-9" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 mb-4 shadow-inner animate-pulse">
                <Clock className="w-9 h-9" />
              </div>
            )}

            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {isRejected 
                ? (isBn ? "নিবন্ধন আবেদন প্রত্যাখ্যাত" : "Registration Rejected")
                : isDisabled
                ? (isBn ? "অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে" : "Account Disabled")
                : (isBn ? "নিবন্ধন সফল হয়েছে!" : "Registration Successful!")
              }
            </h2>

            <div className="mt-2.5 inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-bold border">
              {isRejected ? (
                <span className="bg-red-50 text-red-700 border-red-200 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                  <span>{isBn ? "প্রত্যাখ্যাত" : "Rejected"}</span>
                </span>
              ) : isDisabled ? (
                <span className="bg-slate-100 text-slate-700 border-slate-300 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                  <span>{isBn ? "নিষ্ক্রিয় (Disabled)" : "Disabled"}</span>
                </span>
              ) : (
                <span className="bg-amber-50 text-amber-800 border-amber-200 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping mr-1"></span>
                  <span>{isBn ? "অনুমোদনের অপেক্ষায়" : "Pending Approval"}</span>
                </span>
              )}
            </div>
          </div>

          {/* User Details Capsule */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium">{isBn ? "আবেদনকারীর নাম:" : "Applicant Name:"}</span>
              <span className="font-bold text-slate-900">{userProfile?.displayName || currentUser?.displayName || 'User'}</span>
            </div>

            {userProfile?.email && (
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-medium flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  <span>{isBn ? "ইমেইল:" : "Email:"}</span>
                </span>
                <span className="font-mono text-slate-900">{userProfile.email}</span>
              </div>
            )}

            {userProfile?.phoneNumber && (
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-medium flex items-center space-x-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  <span>{isBn ? "মোবাইল:" : "Phone:"}</span>
                </span>
                <span className="font-mono text-slate-900 font-semibold">{userProfile.phoneNumber}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <span>{isBn ? "নিবন্ধন তারিখ:" : "Registered At:"}</span>
              </span>
              <span className="text-slate-600">
                {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Today'}
              </span>
            </div>
          </div>

          {/* Exact Mandated Pending / Rejection Message */}
          <div className="space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed bg-amber-50/70 p-4 sm:p-5 rounded-2xl border border-amber-200 mb-6 shadow-xs">
            {isRejected ? (
              <div className="text-red-800 space-y-2">
                <p className="font-bold">
                  {isBn 
                    ? "আপনার অ্যাকাউন্টটি মাদরাসা কর্তৃপক্ষ কর্তৃক অনুমোদন করা হয়নি।" 
                    : "Your account registration has not been approved by the administration."}
                </p>
                {userProfile?.rejectionReason && (
                  <p className="text-xs bg-white p-2.5 rounded-lg border border-red-200 font-medium">
                    <span className="font-bold">{isBn ? "কারণ: " : "Reason: "}</span>
                    {userProfile.rejectionReason}
                  </p>
                )}
                <p className="text-xs text-slate-600">
                  {isBn 
                    ? "বিস্তারিত তথ্যের জন্য সরাসরি মাদরাসার অধ্যক্ষ অথবা অনুমোদিত Admin-এর সাথে যোগাযোগ করুন।"
                    : "Please contact the Madrasa Principal or an authorized Admin for further details."}
                </p>
              </div>
            ) : isDisabled ? (
              <div className="text-slate-800 space-y-2">
                <p className="font-bold text-slate-900">
                  {isBn 
                    ? "আপনার অ্যাকাউন্টটি সাময়িকভাবে নিষ্ক্রিয় (Disabled) করা হয়েছে।" 
                    : "Your account has been temporarily disabled."}
                </p>
                <p className="text-xs text-slate-600">
                  {isBn 
                    ? "অ্যাকাউন্ট পুনরায় চালু করার জন্য মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।"
                    : "Please contact the Madrasa Administration to re-enable your account."}
                </p>
              </div>
            ) : (
              <p className="font-semibold text-slate-900 leading-relaxed text-center sm:text-left">
                {isBn 
                  ? "আপনার অ্যাকাউন্টটি সফলভাবে নিবন্ধিত হয়েছে। অনুগ্রহপূর্বক মাদরাসার অধ্যক্ষ অথবা অনুমোদিত Admin-এর অনুমোদনের জন্য অপেক্ষা করুন।"
                  : "Your account has been successfully registered. Please wait for approval from the Madrasa Principal or an authorized Admin."}
              </p>
            )}
          </div>

          {feedbackMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Action Buttons: Refresh & Logout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isBn ? "স্ট্যাটাস রিফ্রেশ" : "Refresh Status"}</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{isBn ? "লগআউট" : "Logout"}</span>
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="text-center mt-6 text-slate-400 text-[11px] flex items-start sm:items-center justify-center gap-1.5 px-2">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <span className="break-words">
            {isBn 
              ? "মাদরাসার তথ্য ও ডাটাবেজ সুরক্ষার্থে অনুমোদনের পরেই কেবল অ্যাক্সেস প্রদান করা হয়।" 
              : "Strict authorization required to access madrasa administrative data."}
          </span>
        </div>
      </div>
    </div>
  );
};
