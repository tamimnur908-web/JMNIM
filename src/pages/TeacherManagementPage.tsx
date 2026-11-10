import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit3, 
  Trash2, 
  FileSpreadsheet,
  CheckCircle,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher } from '../types';
import { formatBDT, formatNumber, getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const TeacherManagementPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);

  const [form, setForm] = useState({
    teacherId: `T-${Math.floor(100 + Math.random() * 900)}`,
    fullName: '',
    phone: '',
    email: '',
    designation: isBn ? 'উস্তাদ / শিক্ষক' : 'Teacher / Ustadh',
    department: isBn ? 'হিফজ ও কিতাব' : 'Hifz & Kitab',
    joiningDate: getTodayDateString(),
    baseSalary: 12000,
    employmentStatus: 'active' as const,
    salaryType: 'monthly' as const,
  });

  const loadTeachers = async () => {
    try {
      const snap = await getDocs(collection(db, 'teachers'));
      const list: Teacher[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Teacher));
      setTeachers(list);
    } catch (err) {
      console.warn("Could not load teachers:", err);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'teachers'), {
        ...form,
        baseSalary: Number(form.baseSalary),
        createdAt: new Date().toISOString()
      });

      await logAudit({
        action: 'Teacher Registered',
        module: 'Teacher Management',
        recordId: docRef.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `নতুন শিক্ষক যুক্ত: ${form.fullName} (${form.teacherId}), পদবি: ${form.designation}`
      });

      setShowAddModal(false);
      setForm({
        teacherId: `T-${Math.floor(100 + Math.random() * 900)}`,
        fullName: '',
        phone: '',
        email: '',
        designation: isBn ? 'উস্তাদ / শিক্ষক' : 'Teacher / Ustadh',
        department: isBn ? 'হিফজ ও কিতাব' : 'Hifz & Kitab',
        joiningDate: getTodayDateString(),
        baseSalary: 12000,
        employmentStatus: 'active',
        salaryType: 'monthly',
      });
      await loadTeachers();
    } catch (err: any) {
      alert((isBn ? 'শিক্ষক যোগ করতে সমস্যা: ' : 'Failed to add teacher: ') + err.message);
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    try {
      await updateDoc(doc(db, 'teachers', editingTeacher.id), {
        fullName: editingTeacher.fullName,
        phone: editingTeacher.phone,
        email: editingTeacher.email,
        designation: editingTeacher.designation,
        department: editingTeacher.department,
        baseSalary: Number(editingTeacher.baseSalary),
        employmentStatus: editingTeacher.employmentStatus
      });

      await logAudit({
        action: 'Teacher Profile Updated',
        module: 'Teacher Management',
        recordId: editingTeacher.id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক তথ্য হালনাগাদ: ${editingTeacher.fullName} (${editingTeacher.teacherId})`
      });

      setEditingTeacher(null);
      await loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!window.confirm(isBn ? `আপনি কি নিশ্চিতভাবে ${name}-কে মুছে ফেলতে চান?` : `Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
      await logAudit({
        action: 'Teacher Deleted',
        module: 'Teacher Management',
        recordId: id,
        recordType: 'Teacher',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক রেকর্ড মোছা হয়েছে: ${name}`
      });
      await loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = filtered.map((t, idx) => ({
      'SL': idx + 1,
      'শিক্ষক আইডি': t.teacherId,
      'পূর্ণ নাম': t.fullName,
      'পদবি': t.designation,
      'বিভাগ': t.department || '-',
      'ফোন': t.phone,
      'মূল বেতন (৳)': t.baseSalary,
      'যোগদানের তারিখ': t.joiningDate,
      'স্ট্যাটাস': t.employmentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    XLSX.writeFile(wb, `JMNIM_Teachers_${getTodayDateString()}.xlsx`);
  };

  const filtered = teachers.filter(item => 
    item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.teacherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>{t.teacherListTitle}</span>
          </h2>
          <p className="text-xs text-slate-500">{t.teacherListSubtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition w-fit"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.addNewTeacher}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isBn ? 'এক্সেল' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full text-xs border-none focus:outline-none focus:ring-0 text-slate-700"
        />
      </div>

      {/* Teachers List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{t.teacherId}</th>
                <th className="py-3 px-3">{t.teacherName}</th>
                <th className="py-3 px-3">{t.designationAndDept}</th>
                <th className="py-3 px-3 text-right">{t.baseSalary}</th>
                <th className="py-3 px-3">{t.status}</th>
                <th className="py-3 px-3 text-right">{t.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t.noDataFound}
                  </td>
                </tr>
              ) : (
                filtered.map((teacher, idx) => (
                  <tr key={teacher.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-700">{teacher.teacherId}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{teacher.fullName}</p>
                      <p className="text-[11px] text-slate-500">{teacher.phone}</p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-800">{teacher.designation}</p>
                      <p className="text-[11px] text-slate-400">{teacher.department}</p>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {formatBDT(teacher.baseSalary, isBn)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        teacher.employmentStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {teacher.employmentStatus === 'active' ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setViewingTeacher(teacher)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="বিস্তারিত"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingTeacher(teacher)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                          title="সম্পাদনা"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(teacher.id, teacher.fullName)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{t.registerNewTeacher}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t.teacherId}</label>
                  <input
                    type="text"
                    value={form.teacherId}
                    onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-blue-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t.baseSalaryTaka}</label>
                  <input
                    type="number"
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t.fullName}</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder={isBn ? 'মুফতী / মাওলানা...' : 'Name...'}
                  className="w-full px-3 py-1.5 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t.designation}</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t.department}</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">ফোন</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">ইমেইল</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'শিক্ষক তথ্য সম্পাদনা' : 'Edit Teacher'}</h3>
              <button onClick={() => setEditingTeacher(null)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t.fullName}</label>
                <input
                  type="text"
                  value={editingTeacher.fullName}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, fullName: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t.designation}</label>
                  <input
                    type="text"
                    value={editingTeacher.designation}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, designation: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t.department}</label>
                  <input
                    type="text"
                    value={editingTeacher.department || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, department: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">ফোন</label>
                  <input
                    type="tel"
                    value={editingTeacher.phone}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t.baseSalaryTaka}</label>
                  <input
                    type="number"
                    value={editingTeacher.baseSalary}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">{t.status}</label>
                <select
                  value={editingTeacher.employmentStatus}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, employmentStatus: e.target.value as any })}
                  className="w-full px-3 py-1.5 border rounded-lg bg-white"
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                  <option value="on_leave">ছুটিতে</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 border rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Teacher Details Modal */}
      {viewingTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'শিক্ষক প্রোফাইল বিবরণ' : 'Teacher Profile'}</h3>
              <button onClick={() => setViewingTeacher(null)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-xl">
              <p><b>আইডি:</b> <span className="font-mono text-blue-700 font-bold">{viewingTeacher.teacherId}</span></p>
              <p><b>পূর্ণ নাম:</b> {viewingTeacher.fullName}</p>
              <p><b>পদবি ও বিভাগ:</b> {viewingTeacher.designation} ({viewingTeacher.department || '-'})</p>
              <p><b>মোবাইল:</b> {viewingTeacher.phone}</p>
              <p><b>ইমেইল:</b> {viewingTeacher.email || '-'}</p>
              <p><b>মূল মাসিক বেতন:</b> <span className="font-bold text-emerald-700">{formatBDT(viewingTeacher.baseSalary, isBn)}</span></p>
              <p><b>যোগদানের তারিখ:</b> {viewingTeacher.joiningDate}</p>
              <p><b>বর্তমান অবস্থা:</b> <span className="capitalize">{viewingTeacher.employmentStatus}</span></p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingTeacher(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
