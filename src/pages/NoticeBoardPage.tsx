import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Bell, 
  PlusCircle, 
  Trash2, 
  AlertCircle, 
  Calendar, 
  Search, 
  Pin,
  CheckCircle,
  Printer,
  PenTool,
  X
} from 'lucide-react';
import { Notice } from '../types';
import { getTodayDateString, formatDate } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';
import { AuthoritySignatureBlock } from '../components/AuthoritySignatureBlock';
import { AuthoritySignatureModal } from '../components/AuthoritySignatureModal';

export const NoticeBoardPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetFilter, setTargetFilter] = useState('all');

  // Add Notice Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewNotice, setViewNotice] = useState<Notice | null>(null);
  const [showAuthoritySignatureModal, setShowAuthoritySignatureModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'teachers' | 'students' | 'accountant'>('all');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const loadNotices = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'notices'));
      const list: Notice[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Notice));
      list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setNotices(list);
    } catch (err) {
      console.warn("Could not load notices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const newNotice: Omit<Notice, 'id'> = {
        title: title.trim(),
        content: content.trim(),
        targetRole,
        priority,
        publishDate: getTodayDateString(),
        createdBy: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'notices'), newNotice);

      await logAudit({
        action: 'Notice Published',
        module: 'Notice Board',
        recordId: docRef.id,
        recordType: 'Notice',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `নতুন নোটিশ প্রকাশিত: "${title.trim()}", অগ্রাধিকার: ${priority}, প্রাপক: ${targetRole}`
      });

      setShowAddModal(false);
      setTitle('');
      setContent('');
      setPriority('normal');
      await loadNotices();
    } catch (err: any) {
      alert((isBn ? 'নোটিশ প্রকাশে সমস্যা: ' : 'Failed to publish notice: ') + err.message);
    }
  };

  const handleDeleteNotice = async (id: string, noticeTitle: string) => {
    if (!window.confirm(isBn ? 'আপনি কি নিশ্চিতভাবে এই নোটিশটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this notice?')) return;
    try {
      await deleteDoc(doc(db, 'notices', id));
      setNotices(prev => prev.filter(n => n.id !== id));

      await logAudit({
        action: 'Notice Deleted',
        module: 'Notice Board',
        recordId: id,
        recordType: 'Notice',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `নোটিশ মুছে ফেলা হয়েছে: "${noticeTitle}"`
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredNotices = notices.filter(n => {
    if (targetFilter !== 'all' && n.targetRole !== targetFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchContent = n.content?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'মাদরাসা নোটিশ বোর্ড' : 'Madrasa Notice Board'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'শিক্ষক, শিক্ষার্থী ও অভিভাবকদের জন্য জরুরি বিজ্ঞপ্তি, নোটিশ ও প্রশাসনিক ঘোষণা' 
              : 'Official administrative notices, emergency announcements, and holiday circulars'}
          </p>
        </div>

        {(isSuperAdmin || role === 'principal' || role === 'admin') && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAuthoritySignatureModal(true)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              title={isBn ? 'মুহতামিম ও কর্তৃপক্ষের অফিসিয়াল স্বাক্ষর সেটিংস' : 'Authority Signature Settings'}
            >
              <PenTool className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Signature'}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isBn ? 'নতুন নোটিশ জারি' : 'Publish Notice'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'শিরোনাম বা বিষয়বস্তু খুঁজুন...' : 'Search title or content...'}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600">{isBn ? 'প্রাপক:' : 'Target:'}</span>
          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">{isBn ? 'সকলের জন্য' : 'All Audience'}</option>
            <option value="teachers">{isBn ? 'শুধুমাত্র শিক্ষক' : 'Teachers Only'}</option>
            <option value="students">{isBn ? 'শিক্ষার্থী ও অভিভাবক' : 'Students & Guardians'}</option>
          </select>
        </div>
      </div>

      {/* Notices Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          {isBn ? 'নোটিশ লোড হচ্ছে...' : 'Loading notices...'}
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
          {isBn ? 'কোনো নোটিশ পাওয়া যায়নি।' : 'No notices posted.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotices.map((n) => (
            <div 
              key={n.id} 
              className={`p-5 rounded-2xl border shadow-sm transition space-y-3 relative bg-white ${
                n.priority === 'urgent' ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {n.priority === 'urgent' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{isBn ? 'জরুরি' : 'Urgent'}</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                    {n.targetRole === 'all' ? (isBn ? 'সার্বজনীন' : 'All') : (n.targetRole === 'teachers' ? (isBn ? 'শিক্ষক' : 'Teachers') : (isBn ? 'শিক্ষার্থী' : 'Students'))}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{n.publishDate}</span>
                  </span>

                  {(isSuperAdmin || role === 'principal' || role === 'admin') && (
                    <button
                      onClick={() => handleDeleteNotice(n.id, n.title)}
                      className="text-slate-300 hover:text-red-600 transition"
                      title="মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm">{n.title}</h3>
                <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                  {n.content}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div>জারিকারী: <b>{n.createdBy}</b></div>
                  <button
                    type="button"
                    onClick={() => setViewNotice(n)}
                    className="text-blue-600 hover:underline font-semibold flex items-center space-x-1 text-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isBn ? 'অফিসিয়াল কপি ও প্রিন্ট' : 'Official Notice Print'}</span>
                  </button>
                </div>

                <AuthoritySignatureBlock
                  onEdit={(isSuperAdmin || role === 'principal' || role === 'admin') ? () => setShowAuthoritySignatureModal(true) : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Notice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'নতুন নোটিশ জারি করুন' : 'Publish Notice'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{isBn ? 'নোটিশের শিরোনাম *' : 'Notice Title *'}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isBn ? 'যেমন: পবিত্র রমযানুল মুবারকের ছুটি সংক্রান্ত নোটিশ...' : 'Notice title...'}
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'প্রাপক / লক্ষ্য' : 'Target Audience'}</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as any)}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white"
                  >
                    <option value="all">{isBn ? 'সকলের জন্য (All)' : 'All'}</option>
                    <option value="teachers">{isBn ? 'শুধুমাত্র শিক্ষক' : 'Teachers Only'}</option>
                    <option value="students">{isBn ? 'শিক্ষার্থী ও অভিভাবক' : 'Students & Parents'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'অগ্রাধিকার' : 'Priority'}</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white"
                  >
                    <option value="normal">{isBn ? 'সাধারণ (Normal)' : 'Normal'}</option>
                    <option value="urgent">{isBn ? 'জরুরি (Urgent)' : 'Urgent'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">{isBn ? 'নোটিশের বিস্তারিত বক্তব্য *' : 'Notice Content *'}</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder={isBn ? 'বিজ্ঞপ্তির পূর্ণাঙ্গ বক্তব্য এখানে লিখুন...' : 'Write notice content...'}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                >
                  {isBn ? 'জারি করুন' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Notice Print & Letterhead Modal */}
      {viewNotice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <span className="text-xs font-bold text-slate-500 uppercase">{isBn ? 'দাপ্তরিক নোটিশ কপি' : 'Official Notice'}</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewNotice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Letterhead */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-6 bg-white">
              <div className="text-center border-b pb-4 space-y-1">
                <h2 className="text-lg font-black text-slate-900">জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসা</h2>
                <p className="text-xs font-serif text-slate-600">Jamia Madinatun Nur Islamia Madrasha</p>
                <div className="text-[10px] text-slate-400 font-mono">তারিখ: {viewNotice.publishDate}</div>
              </div>

              <div className="space-y-3">
                <div className="text-center">
                  <span className="inline-block px-4 py-1 bg-slate-100 text-slate-800 rounded-full font-bold text-xs border border-slate-200">
                    {isBn ? 'জরুরি দাপ্তরিক বিজ্ঞপ্তি' : 'Official Announcement'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 text-center">{viewNotice.title}</h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify pt-2">
                  {viewNotice.content}
                </p>
              </div>

              {/* Bottom Signatures */}
              <div className="pt-8 flex items-end justify-between border-t border-slate-100">
                <div className="text-left text-[10px] text-slate-400">
                  <p>জারিকারী: {viewNotice.createdBy}</p>
                  <p>প্রাপক: {viewNotice.targetRole === 'all' ? 'সকলের জন্য' : viewNotice.targetRole}</p>
                </div>

                <AuthoritySignatureBlock
                  onEdit={(isSuperAdmin || role === 'principal' || role === 'admin') ? () => setShowAuthoritySignatureModal(true) : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authority Signature Settings Modal */}
      <AuthoritySignatureModal
        isOpen={showAuthoritySignatureModal}
        onClose={() => setShowAuthoritySignatureModal(false)}
      />
    </div>
  );
};
