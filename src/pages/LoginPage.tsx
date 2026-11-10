import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Lock, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  RefreshCw,
  User,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { AnimatedBotanicalCorner } from '../components/AnimatedBotanicalCorner';

type AuthMethod = 'email' | 'phone';
type EmailMode = 'login' | 'register' | 'forgot';

export const LoginPage: React.FC = () => {
  const { 
    loginWithEmail, 
    signupWithEmail, 
    resetPassword, 
    loginWithGoogle, 
    setupRecaptcha, 
    sendPhoneOtp 
  } = useAuth();

  const { t, language, setLanguage } = useLanguage();
  const isBn = language === 'bn';

  const [activeMethod, setActiveMethod] = useState<AuthMethod>('email');
  const [emailMode, setEmailMode] = useState<EmailMode>('login');

  // Email form state (pre-filled with configured admin email)
  const [email, setEmail] = useState('tamimnur908@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Status & Feedback state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Recaptcha verifier ref
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const getFriendlyError = (err: any): string => {
    const code = err?.code || '';
    if (isBn) {
      switch (code) {
        case 'auth/invalid-credential':
          return 'ইমেইল বা পাসওয়ার্ড সঠিক নয়। দয়া করে পুনরায় যাচাই করুন।';
        case 'auth/user-not-found':
          return 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট খুলুন।';
        case 'auth/wrong-password':
          return 'পাসওয়ার্ড ভুল হয়েছে। আবার চেষ্টা করুন বা পাসওয়ার্ড রিসেট করুন।';
        case 'auth/email-already-in-use':
          return 'এই ইমেইলটি দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে। সরাসরি লগইন করুন।';
        case 'auth/weak-password':
          return 'পাসওয়ার্ড খুব দুর্বল। কমপক্ষে ৬টি অক্ষর বা সংখ্যার পাসওয়ার্ড দিন।';
        case 'auth/invalid-email':
          return 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা লিখুন।';
        case 'auth/invalid-phone-number':
          return 'ফোন নম্বরটি সঠিক নয়। অনুগ্রহ করে সঠিক ১১ ডিজিটের নম্বর দিন।';
        case 'auth/invalid-verification-code':
          return 'প্রদত্ত ওটিপি (OTP) কোডটি সঠিক নয়। আবার দেখে লিখুন।';
        case 'auth/code-expired':
          return 'ওটিপি (OTP) কোডের মেয়াদ শেষ হয়েছে। পুনরায় নতুন কোড পাঠান।';
        case 'auth/too-many-requests':
          return 'অতিরিক্ত চেষ্টা করা হয়েছে। সাময়িক ব্লকের জন্য কয়েক মিনিট পর চেষ্টা করুন।';
        case 'auth/popup-closed-by-user':
          return 'গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। আবার চেষ্টা করুন।';
        case 'auth/network-request-failed':
          return 'ইন্টারনেট সংযোগে সমস্যা হচ্ছে। আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।';
        default:
          return err?.message || 'একটি অনাকাঙ্ক্ষিত ত্রুটি ঘটেছে। দয়া করে আবার চেষ্টা করুন।';
      }
    } else {
      switch (code) {
        case 'auth/invalid-credential':
          return 'Invalid email or password. Please verify your credentials.';
        case 'auth/user-not-found':
          return 'No user found with this email. Please register first.';
        case 'auth/wrong-password':
          return 'Incorrect password. Please try again or reset password.';
        case 'auth/email-already-in-use':
          return 'Email is already registered. Please sign in directly.';
        case 'auth/weak-password':
          return 'Password is too weak. Minimum 6 characters required.';
        case 'auth/invalid-email':
          return 'Please provide a valid email address.';
        case 'auth/invalid-phone-number':
          return 'Invalid phone number format.';
        case 'auth/invalid-verification-code':
          return 'Invalid OTP verification code. Please check and re-enter.';
        case 'auth/code-expired':
          return 'OTP code expired. Please request a new code.';
        case 'auth/too-many-requests':
          return 'Too many attempts. Please try again in a few minutes.';
        case 'auth/popup-closed-by-user':
          return 'Google sign-in popup was closed by user.';
        default:
          return err?.message || 'An unexpected error occurred. Please try again.';
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (emailMode === 'login') {
        await loginWithEmail(email.trim(), password);
      } else if (emailMode === 'register') {
        if (password !== confirmPassword) {
          setErrorMsg(isBn ? 'পাসওয়ার্ড দুটি মিলছে না। পুনরায় যাচাই করুন।' : 'Passwords do not match.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg(isBn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        await signupWithEmail(email.trim(), password, displayName.trim());
        setSuccessMsg(isBn ? 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! স্বাগতম।' : 'Account created successfully! Welcome.');
      } else if (emailMode === 'forgot') {
        await resetPassword(email.trim());
        setSuccessMsg(
          isBn
            ? `${email} ঠিকানায় একটি পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে। দয়া করে আপনার ইনবক্স চেক করুন।`
            : `Password reset link sent to ${email}. Please check your inbox.`
        );
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      setErrorMsg(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setErrorMsg(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('880')) {
        cleanPhone = cleanPhone.substring(3);
      }
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }

      if (cleanPhone.length !== 10) {
        setErrorMsg(isBn ? 'অনুগ্রহ করে সঠিক ১০/১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 01712345678)' : 'Please enter a valid Bangladeshi mobile number (e.g. 01712345678)');
        setLoading(false);
        return;
      }

      const formattedNumber = `+880${cleanPhone}`;

      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      }

      const confirmation = await sendPhoneOtp(formattedNumber, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setOtpCountdown(60);
      setSuccessMsg(
        isBn
          ? `${formattedNumber} নম্বরে ৬ ডিজিটের ভেরিফিকেশন ওটিপি পাঠানো হয়েছে।`
          : `6-digit verification OTP sent to ${formattedNumber}.`
      );
    } catch (err: any) {
      console.error('Phone OTP send error:', err);
      setErrorMsg(getFriendlyError(err));
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (clearErr) {
          console.warn('Recaptcha clear error:', clearErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (otpCode.trim().length !== 6) {
        setErrorMsg(isBn ? 'অনুগ্রহ করে সঠিক ৬ ডিজিটের ওটিপি লিখুন।' : 'Please enter the 6-digit OTP code.');
        setLoading(false);
        return;
      }

      await confirmationResult.confirm(otpCode.trim());
      setSuccessMsg(isBn ? 'ফোন নম্বর যাচাইকরণ সফল হয়েছে! স্বাগতম।' : 'Phone verified successfully! Welcome.');
    } catch (err: any) {
      console.error('OTP confirmation error:', err);
      setErrorMsg(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-emerald-50/25 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-bengali relative overflow-hidden selection:bg-emerald-100">
      {/* Language Switcher in Corner */}
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

      {/* Real Animated Swaying Tree Leaves in Corner */}
      <AnimatedBotanicalCorner />

      {/* Invisible container for Firebase reCAPTCHA */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Madrasa Brand Card */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white p-2 shadow-xl border border-slate-200/80 mb-3 hover:scale-105 transition-transform duration-300">
            <img 
              src="/logo.png" 
              alt="JMNIM Logo" 
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-wide drop-shadow-sm">
            {t.institutionName}
          </h1>
          <div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300/80 px-3 py-1 rounded-full inline-block mt-2 shadow-xs">
              {t.established} • {t.subtitle}
            </span>
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl shadow-slate-300/60 border border-slate-200/90 overflow-hidden">
          {/* Method Selector Tabs */}
          <div className="grid grid-cols-2 bg-slate-100/80 p-1.5 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveMethod('email');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeMethod === 'email'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-4 h-4 text-blue-700" />
              <span>{t.emailTab}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMethod('phone');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeMethod === 'phone'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>{t.phoneTab}</span>
            </button>
          </div>

          <div className="p-6">
            {/* Feedback Notifications */}
            {errorMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* TAB 1: EMAIL & PASSWORD */}
            {activeMethod === 'email' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800">
                    {emailMode === 'login' && t.loginTitle}
                    {emailMode === 'register' && t.registerTitle}
                    {emailMode === 'forgot' && t.forgotPassTitle}
                  </h3>
                  {emailMode !== 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('login');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-blue-700 hover:underline flex items-center space-x-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>{t.backToLogin}</span>
                    </button>
                  )}
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3.5">
                  {emailMode === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.fullName}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder={isBn ? "আপনার নাম লিখুন" : "Enter your full name"}
                          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        {t.emailAddress}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEmail('tamimnur908@gmail.com')}
                        className="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 font-semibold"
                        title="Set Admin Email"
                      >
                        Admin: tamimnur908@gmail.com
                      </button>
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tamimnur908@gmail.com"
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {emailMode !== 'forgot' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          {t.password}
                        </label>
                        {emailMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEmailMode('forgot');
                              setErrorMsg(null);
                              setSuccessMsg(null);
                            }}
                            className="text-[11px] text-blue-700 hover:underline font-medium"
                          >
                            {t.forgotPassword}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={isBn ? "কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড" : "Minimum 6 characters"}
                          className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {emailMode === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.confirmPassword}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={isBn ? "পাসওয়ার্ড পুনরায় লিখুন" : "Confirm password"}
                          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold rounded-lg text-xs sm:text-sm shadow-md transition flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isBn ? "প্রক্রিয়াকরণ হচ্ছে..." : "Processing..."}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {emailMode === 'login' && t.enterSystem}
                          {emailMode === 'register' && t.createAccount}
                          {emailMode === 'forgot' && t.sendResetLink}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Switch between Login and Register */}
                <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
                  {emailMode === 'login' ? (
                    <p>
                      {t.newMember}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setEmailMode('register');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {t.createAccount}
                      </button>
                    </p>
                  ) : emailMode === 'register' ? (
                    <p>
                      {t.alreadyHaveAccount}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setEmailMode('login');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {t.loginTitle}
                      </button>
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {/* TAB 2: PHONE NUMBER & OTP */}
            {activeMethod === 'phone' && (
              <div>
                {!confirmationResult ? (
                  <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-1">
                        {isBn ? "মোবাইল নম্বর দিয়ে প্রবেশ করুন" : "Sign in with Mobile OTP"}
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        {isBn 
                          ? "আপনার ১১ ডিজিটের মোবাইল নম্বর দিন। একটি ভেরিফিকেশন ওটিপি পাঠানো হবে।"
                          : "Enter your 11-digit mobile number to receive a verification OTP."}
                      </p>

                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isBn ? "বাংলাদেশী মোবাইল নম্বর" : "Bangladeshi Mobile Number"}
                      </label>
                      <div className="flex rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-600">
                        <span className="inline-flex items-center px-3 bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold border-r border-slate-300">
                          🇧🇩 +880
                        </span>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="01712345678"
                          className="flex-1 px-3 py-2 text-xs sm:text-sm focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg text-xs sm:text-sm shadow-md transition flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{isBn ? "ওটিপি পাঠানো হচ্ছে..." : "Sending OTP..."}</span>
                        </>
                      ) : (
                        <>
                          <span>{isBn ? "OTP কোড পাঠান" : "Send OTP Code"}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-slate-800">
                          {isBn ? "ওটিপি (OTP) যাচাইকরণ" : "Verify OTP Code"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmationResult(null);
                            setOtpCode('');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="text-[11px] text-blue-700 hover:underline flex items-center space-x-1"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>{isBn ? "নম্বর পরিবর্তন" : "Change Number"}</span>
                        </button>
                      </div>

                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isBn ? "৬ ডিজিটের ওটিপি কোড" : "6-digit OTP Code"}
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs sm:text-sm shadow-md transition flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{isBn ? "যাচাই করা হচ্ছে..." : "Verifying..."}</span>
                        </>
                      ) : (
                        <>
                          <span>{isBn ? "যাচাই করুন ও প্রবেশ করুন" : "Verify & Sign In"}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium">{t.orGoogle}</span>
              </div>
            </div>

            {/* GOOGLE SIGN-IN BUTTON */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs sm:text-sm shadow-sm transition flex items-center justify-center space-x-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{t.googleSignIn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
