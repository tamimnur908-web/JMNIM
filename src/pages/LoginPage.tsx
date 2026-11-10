import React, { useState } from 'react';
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
  User,
  ArrowLeft,
  Globe
} from 'lucide-react';
import { useAuth, normalizePhoneNumber } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AnimatedBotanicalCorner } from '../components/AnimatedBotanicalCorner';

type PageMode = 'login' | 'register' | 'forgot';
type LoginTab = 'email' | 'phone';
type RegisterTab = 'email' | 'phone';

const COUNTRY_CODES = [
  { code: '+880', label: '🇧🇩 বাংলাদেশ (+880)' },
  { code: '+966', label: '🇸🇦 সৌদি আরব (+966)' },
  { code: '+971', label: '🇦🇪 ইউএই (+971)' },
  { code: '+968', label: '🇴🇲 ওমান (+968)' },
  { code: '+974', label: '🇶🇦 কাতার (+974)' },
  { code: '+965', label: '🇰🇼 কুয়েত (+965)' },
  { code: '+91',  label: '🇮🇳 ভারত (+91)' },
  { code: '+1',   label: '🇺🇸 যুক্তরাষ্ট্র (+1)' },
  { code: '+44',  label: '🇬🇧 যুক্তরাজ্য (+44)' },
  { code: '+60',  label: '🇲🇾 মালয়েশিয়া (+60)' }
];

export const LoginPage: React.FC = () => {
  const { 
    loginWithEmail, 
    signupWithEmail, 
    loginWithPhone, 
    signupWithPhone, 
    resetPassword, 
    loginWithGoogle 
  } = useAuth();

  const { t, language, setLanguage } = useLanguage();
  const isBn = language === 'bn';

  const [pageMode, setPageMode] = useState<PageMode>('login');
  const [loginTab, setLoginTab] = useState<LoginTab>('email');
  const [registerTab, setRegisterTab] = useState<RegisterTab>('email');

  // Shared form fields (Initialized completely empty - NO prefilled admin email!)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+880');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getFriendlyError = (err: any): string => {
    const code = err?.code || '';
    if (isBn) {
      switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          return 'ইমেইল/মোবাইল বা পাসওয়ার্ড সঠিক নয়। দয়া করে পুনরায় যাচাই করুন।';
        case 'auth/user-not-found':
          return 'এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। প্রথমে নিবন্ধন করুন।';
        case 'auth/email-already-in-use':
          return 'এই ইমেইল বা মোবাইল নম্বরটি দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে। সরাসরি লগইন করুন।';
        case 'auth/weak-password':
          return 'পাসওয়ার্ড খুব দুর্বল। কমপক্ষে ৬টি অক্ষর বা সংখ্যার পাসওয়ার্ড দিন।';
        case 'auth/invalid-email':
          return 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা লিখুন।';
        case 'auth/too-many-requests':
          return 'অতিরিক্ত চেষ্টা করা হয়েছে। সাময়িক ব্লকের জন্য কয়েক মিনিট পর চেষ্টা করুন।';
        case 'auth/popup-closed-by-user':
          return 'গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। আবার চেষ্টা করুন।';
        case 'auth/network-request-failed':
          return 'ইন্টারনেট সংযোগে সমস্যা হচ্ছে। আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।';
        default:
          return err?.message || 'একটি ত্রুটি ঘটেছে। দয়া করে আবার চেষ্টা করুন।';
      }
    } else {
      switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          return 'Invalid credentials. Please verify your email/phone and password.';
        case 'auth/user-not-found':
          return 'No user found with these credentials. Please register first.';
        case 'auth/email-already-in-use':
          return 'This account is already registered. Please sign in directly.';
        case 'auth/weak-password':
          return 'Password is too weak. Minimum 6 characters required.';
        case 'auth/invalid-email':
          return 'Please provide a valid email address.';
        case 'auth/too-many-requests':
          return 'Too many attempts. Please try again in a few minutes.';
        case 'auth/popup-closed-by-user':
          return 'Google sign-in popup was closed by user.';
        default:
          return err?.message || 'An unexpected error occurred. Please try again.';
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg(isBn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (loginTab === 'email') {
        if (!email.trim()) {
          setErrorMsg(isBn ? 'অনুগ্রহ করে ইমেইল ঠিকানা দিন।' : 'Please enter your email.');
          setLoading(false);
          return;
        }
        await loginWithEmail(email.trim(), password);
      } else {
        if (!phoneNumber.trim()) {
          setErrorMsg(isBn ? 'অনুগ্রহ করে মোবাইল নম্বর দিন।' : 'Please enter your mobile number.');
          setLoading(false);
          return;
        }
        const formatted = normalizePhoneNumber(phoneNumber, countryCode);
        await loginWithPhone(formatted, password);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg(isBn ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন।' : 'Please enter your full name.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg(isBn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(isBn ? 'পাসওয়ার্ড দুটি মিলছে না। পুনরায় যাচাই করুন।' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (registerTab === 'email') {
        if (!email.trim()) {
          setErrorMsg(isBn ? 'অনুগ্রহ করে সঠিক ইমেইল ঠিকানা দিন।' : 'Please enter a valid email.');
          setLoading(false);
          return;
        }
        await signupWithEmail(email.trim(), password, fullName.trim());
      } else {
        if (!phoneNumber.trim()) {
          setErrorMsg(isBn ? 'অনুগ্রহ করে মোবাইল নম্বর দিন।' : 'Please enter your mobile number.');
          setLoading(false);
          return;
        }
        const formatted = normalizePhoneNumber(phoneNumber, countryCode);
        await signupWithPhone(formatted, password, fullName.trim());
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg(isBn ? 'পাসওয়ার্ড রিসেট করতে ইমেইল ঠিকানা দিন।' : 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccessMsg(
        isBn 
          ? 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স চেক করুন।' 
          : 'Password reset link sent to your email. Please check your inbox.'
      );
    } catch (err: any) {
      setErrorMsg(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google auth error:', err);
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

      <AnimatedBotanicalCorner />

      <div className="w-full max-w-md relative z-10">
        {/* Madrasa Brand Card */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white p-2 shadow-xl border border-slate-200/80 mb-3 hover:scale-105 transition-transform duration-300">
            <img 
              src="/logo.png" 
              alt="JMNIM Logo" 
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isBn ? "জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসা" : "Jamia Madinatun Nur Islamia Madrasha"}
          </h1>
          <div className="inline-flex items-center mt-1 px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold">
            {isBn ? "স্থাপিত : ২০১৬ইং • মাদরাসা পূর্ণাঙ্গ ডিজিটাল ব্যবস্থাপনা পদ্ধতি" : "Est: 2016 • Integrated Digital ERP System"}
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
          
          {/* Top Switcher (Login vs Register) */}
          {pageMode !== 'forgot' && (
            <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPageMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  pageMode === 'login'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? "সিস্টেমে লগইন" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPageMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  pageMode === 'register'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? "নতুন অ্যাকাউন্ট খুলুন" : "Create Account"}
              </button>
            </div>
          )}

          <div className="p-6 sm:p-7 space-y-4">
            
            {/* Feedback Banners */}
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-start space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs flex items-start space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* ============================================================== */}
            {/* VIEW 1: LOGIN MODE                                              */}
            {/* ============================================================== */}
            {pageMode === 'login' && (
              <div className="space-y-4">
                {/* Method Tabs: Email Login vs Mobile Login */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginTab('email');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                      loginTab === 'email' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isBn ? "ইমেইল ও পাসওয়ার্ড" : "Email & Password"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginTab('phone');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                      loginTab === 'phone' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isBn ? "মোবাইল ও পাসওয়ার্ড" : "Mobile & Password"}</span>
                  </button>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  {/* Option A: Email Field */}
                  {loginTab === 'email' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isBn ? "ইমেইল ঠিকানা" : "Email Address"}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={isBn ? "আপনার ইমেইল লিখুন" : "Enter your email"}
                          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    /* Option B: Mobile Field with Country Code */
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isBn ? "মোবাইল নম্বর" : "Mobile Number"}
                      </label>
                      <div className="flex space-x-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-32 px-2 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="017XXXXXXXX"
                            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        {isBn ? "পাসওয়ার্ড" : "Password"}
                      </label>
                      {loginTab === 'email' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPageMode('forgot');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          {isBn ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgot password?"}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isBn ? "পাসওয়ার্ড লিখুন" : "Enter password"}
                        className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        title={showPassword ? "Hide" : "Show"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isBn ? "যাচাই করা হচ্ছে..." : "Verifying..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{isBn ? "প্রবেশ করুন →" : "Sign In →"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ============================================================== */}
            {/* VIEW 2: REGISTRATION MODE (NO OTP REQUIRED)                     */}
            {/* ============================================================== */}
            {pageMode === 'register' && (
              <div className="space-y-4">
                {/* Method Tabs: Register with Email vs Register with Mobile */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterTab('email');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                      registerTab === 'email' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isBn ? "১. ইমেইল দিয়ে নিবন্ধন" : "1. Register with Email"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterTab('phone');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                      registerTab === 'phone' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isBn ? "২. মোবাইল দিয়ে নিবন্ধন" : "2. Register with Mobile"}</span>
                  </button>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isBn ? "পূর্ণ নাম" : "Full Name"}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={isBn ? "আপনার নাম লিখুন" : "Enter your full name"}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Method A: Email */}
                  {registerTab === 'email' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isBn ? "ইমেইল ঠিকানা" : "Email Address"}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={isBn ? "example@gmail.com" : "example@domain.com"}
                          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    /* Method B: Mobile with Country Code */
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isBn ? "মোবাইল নম্বর" : "Mobile Number"}
                      </label>
                      <div className="flex space-x-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-32 px-2 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="017XXXXXXXX"
                            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isBn ? "পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" : "Password (Min 6 chars)"}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isBn ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm Password"}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isBn ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "Creating Account..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{isBn ? "নিবন্ধন সম্পন্ন করুন →" : "Complete Registration →"}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ============================================================== */}
            {/* VIEW 3: FORGOT PASSWORD                                         */}
            {/* ============================================================== */}
            {pageMode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    {isBn ? "পাসওয়ার্ড পুনরুদ্ধার" : "Reset Password"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setPageMode('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>{isBn ? "লগইনে ফিরুন" : "Back to Login"}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isBn ? "আপনার নিবন্ধিত ইমেইল ঠিকানা" : "Your Registered Email Address"}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isBn ? "ইমেইল লিখুন" : "Enter email"}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{isBn ? "পাসওয়ার্ড রিসেট লিংক পাঠান" : "Send Reset Link"}</span>
                  )}
                </button>
              </form>
            )}

            {/* ============================================================== */}
            {/* OPTION C: GOOGLE LOGIN / REGISTRATION                          */}
            {/* ============================================================== */}
            {pageMode !== 'forgot' && (
              <div className="pt-2">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-medium">
                    {isBn ? "অথবা গুগল দিয়ে" : "Or with Google"}
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {pageMode === 'login'
                      ? (isBn ? "গুগল (Google) দিয়ে সাইন ইন" : "Sign in with Google")
                      : (isBn ? "গুগল (Google) দিয়ে নিবন্ধন" : "Sign up with Google")}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Card */}
          <div className="bg-slate-50/80 px-6 py-3 border-t border-slate-100 text-center text-[11px] text-slate-500">
            {pageMode === 'login' ? (
              <p>
                {isBn ? "নতুন ব্যবহারকারী? " : "New user? "}
                <button
                  type="button"
                  onClick={() => {
                    setPageMode('register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-blue-700 hover:underline"
                >
                  {isBn ? "নতুন অ্যাকাউন্ট খুলুন" : "Register account"}
                </button>
              </p>
            ) : (
              <p>
                {isBn ? "ইতিমধ্যে অ্যাকাউন্ট আছে? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setPageMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-blue-700 hover:underline"
                >
                  {isBn ? "সরাসরি লগইন করুন" : "Sign in directly"}
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Security Bottom Note */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          {isBn 
            ? "নিরাপদ ক্লাউড ডাটাবেজ • জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসা" 
            : "Protected Cloud Database • Jamia Madinatun Nur Islamia Madrasha"}
        </p>
      </div>
    </div>
  );
};
