import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { collection, doc, getDocs, setDoc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  CalendarCheck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  Save, 
  RotateCcw,
  Users,
  AlertCircle
} from 'lucide-react';
import { MadrasaClass, Section, Student, StudentDailyAttendance } from '../types';
import { fetchClasses, fetchSections } from '../utils/classManager';
import { getTodayDateString, formatNumber } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const StudentAttendancePage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [date, setDate] = useState<string>(getTodayDateString());
  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, {
    status: 'present' | 'absent' | 'late' | 'leave';
    remarks?: string;
  }>>({});

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load Classes
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const clsList = await fetchClasses();
        setClasses(clsList);
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id);
        }
      } catch (err) {
        console.warn("Error loading classes:", err);
      }
    };
    loadConfig();
  }, []);

  // Load Sections
  useEffect(() => {
    const loadSec = async () => {
      if (!selectedClassId) return;
      try {
        const secList = await fetchSections(selectedClassId);
        setSections(secList);
        setSelectedSectionId('all');
      } catch (err) {
        console.warn("Error loading sections:", err);
      }
    };
    loadSec();
  }, [selectedClassId]);

  // Load Students and Existing Attendance
  const loadClassStudents = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    setSuccessMsg(null);
    try {
      // 1. Fetch Students
      const q = query(
        collection(db, 'students'),
        where('classId', '==', selectedClassId),
        where('isArchived', '!=', true)
      );
      const snap = await getDocs(q);
      let sList: Student[] = [];
      snap.forEach(d => sList.push({ id: d.id, ...d.data() } as Student));

      // Filter by section if selected
      if (selectedSectionId !== 'all') {
        sList = sList.filter(s => s.sectionId === selectedSectionId);
      }
      sList.sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));
      setStudents(sList);

      // 2. Fetch existing daily attendance record
      const attendanceDocId = `${date}_${selectedClassId}_${selectedSectionId}`;
      const attDocRef = doc(db, 'student_attendance', attendanceDocId);
      const attDoc = await getDoc(attDocRef);

      const recordsMap: Record<string, any> = {};
      if (attDoc.exists()) {
        const data = attDoc.data() as StudentDailyAttendance;
        data.records?.forEach(r => {
          recordsMap[r.studentId] = { status: r.status, remarks: r.remarks || '' };
        });
      } else {
        // Default all to 'present'
        sList.forEach(s => {
          recordsMap[s.studentId] = { status: 'present', remarks: '' };
        });
      }
      setAttendanceRecords(recordsMap);

    } catch (err) {
      console.warn("Error loading class attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassStudents();
  }, [selectedClassId, selectedSectionId, date]);

  const handleMarkAll = (status: 'present' | 'absent') => {
    const updated: Record<string, any> = {};
    students.forEach(s => {
      updated[s.studentId] = { status, remarks: '' };
    });
    setAttendanceRecords(updated);
  };

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'leave') => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks
      }
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClassId || students.length === 0) return;
    setSaving(true);
    setSuccessMsg(null);
    try {
      const targetClass = classes.find(c => c.id === selectedClassId);
      const attendanceDocId = `${date}_${selectedClassId}_${selectedSectionId}`;
      const docRef = doc(db, 'student_attendance', attendanceDocId);

      const recordsArray = students.map(s => {
        const item = attendanceRecords[s.studentId] || { status: 'present' };
        return {
          studentId: s.studentId,
          studentName: s.fullName,
          roll: s.roll,
          status: item.status,
          remarks: item.remarks || ''
        };
      });

      const payload: StudentDailyAttendance = {
        id: attendanceDocId,
        date,
        classId: selectedClassId,
        className: targetClass?.name,
        sectionId: selectedSectionId !== 'all' ? selectedSectionId : undefined,
        records: recordsArray,
        takenBy: currentUser?.displayName || currentUser?.email || 'Teacher',
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, payload, { merge: true });

      await logAudit({
        action: 'Student Attendance Recorded',
        module: 'Student Attendance',
        recordId: attendanceDocId,
        recordType: 'StudentDailyAttendance',
        performedBy: currentUser?.displayName || 'Teacher',
        performedByRole: role || 'teacher',
        performedByUid: currentUser?.uid,
        details: `${targetClass?.name} ক্লাসের ${date} তারিখের শিক্ষার্থী হাজিরা সংরক্ষণ করা হয়েছে (মোট শিক্ষার্থী: ${students.length})।`
      });

      setSuccessMsg(isBn ? 'শিক্ষার্থী হাজিরা সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে।' : 'Attendance successfully saved.');
    } catch (err: any) {
      alert((isBn ? 'হাজিরা সংরক্ষণে ত্রুটি: ' : 'Failed to save attendance: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Summary counts
  const totalCount = students.length;
  const presentCount = students.filter(s => attendanceRecords[s.studentId]?.status === 'present').length;
  const absentCount = students.filter(s => attendanceRecords[s.studentId]?.status === 'absent').length;
  const lateCount = students.filter(s => attendanceRecords[s.studentId]?.status === 'late').length;
  const leaveCount = students.filter(s => attendanceRecords[s.studentId]?.status === 'leave').length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'শিক্ষার্থী দৈনিক ডিজিটাল হাজিরা' : 'Student Daily Attendance'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'শ্রেণি ও শাখাভিত্তিক শিক্ষার্থীদের দ্রুত ডিজিটাল উপস্থিতি গ্রহণ ও রেকর্ড সংরক্ষণ' 
              : 'Class & section-wise rapid digital student attendance tracking'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Class & Section Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'শ্রেণি / জামাত' : 'Class'}</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'শাখা (Section)' : 'Section'}</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{isBn ? 'সকল শাখা' : 'All Sections'}</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleMarkAll('present')}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition"
          >
            ✓ {isBn ? 'সকলকে উপস্থিত' : 'All Present'}
          </button>
          <button
            type="button"
            onClick={() => handleMarkAll('absent')}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-lg text-xs font-semibold transition"
          >
            ✕ {isBn ? 'সকলকে অনুপস্থিত' : 'All Absent'}
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 block">{isBn ? 'মোট শিক্ষার্থী' : 'Total'}</span>
          <span className="text-base font-bold text-slate-800">{totalCount}</span>
        </div>
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
          <span className="text-[11px] text-emerald-700 block">{isBn ? 'উপস্থিত' : 'Present'}</span>
          <span className="text-base font-bold text-emerald-800">{presentCount}</span>
        </div>
        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center">
          <span className="text-[11px] text-red-700 block">{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
          <span className="text-base font-bold text-red-800">{absentCount}</span>
        </div>
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
          <span className="text-[11px] text-amber-700 block">{isBn ? 'বিলম্ব' : 'Late'}</span>
          <span className="text-base font-bold text-amber-800">{lateCount}</span>
        </div>
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-center col-span-2 sm:col-span-1">
          <span className="text-[11px] text-blue-700 block">{isBn ? 'ছুটি' : 'Leave'}</span>
          <span className="text-base font-bold text-blue-800">{leaveCount}</span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3 text-center w-12">{isBn ? 'রোল' : 'Roll'}</th>
                <th className="py-3 px-3">{isBn ? 'শিক্ষার্থী আইডি ও নাম' : 'Student ID & Name'}</th>
                <th className="py-3 px-3">{isBn ? 'আবাসিক ধরন' : 'Category'}</th>
                <th className="py-3 px-3 text-center">{isBn ? 'উপস্থিতি স্ট্যাটাস' : 'Attendance Status'}</th>
                <th className="py-3 px-3">{isBn ? 'মন্তব্য' : 'Remarks'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {isBn ? 'শিক্ষার্থীদের তালিকা লোড হচ্ছে...' : 'Loading students...'}
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {isBn ? 'এই শ্রেণিতে কোনো সক্রিয় শিক্ষার্থী নেই।' : 'No active students in this class.'}
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const currentStatus = attendanceRecords[s.studentId]?.status || 'present';
                  const currentRemarks = attendanceRecords[s.studentId]?.remarks || '';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-center font-bold text-slate-700">{s.roll}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{s.fullName}</p>
                        <p className="text-[10px] text-blue-600 font-mono">{s.studentId}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {s.residentialCategory === 'residential' ? 'আবাসিক' : (s.residentialCategory === 'day_care' ? 'ডে-কেয়ার' : 'অনাবাসিক')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-1.5">
                          {[
                            { id: 'present', label: isBn ? 'উপস্থিত' : 'P', bg: 'bg-emerald-600', activeBg: 'bg-emerald-600 text-white' },
                            { id: 'absent', label: isBn ? 'অনুপস্থিত' : 'A', bg: 'bg-red-600', activeBg: 'bg-red-600 text-white' },
                            { id: 'late', label: isBn ? 'বিলম্ব' : 'L', bg: 'bg-amber-600', activeBg: 'bg-amber-600 text-white' },
                            { id: 'leave', label: isBn ? 'ছুটি' : 'Lv', bg: 'bg-blue-600', activeBg: 'bg-blue-600 text-white' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleStatusChange(s.studentId, opt.id as any)}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                                currentStatus === opt.id
                                  ? opt.activeBg
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={currentRemarks}
                          onChange={(e) => handleRemarksChange(s.studentId, e.target.value)}
                          placeholder={isBn ? 'প্রয়োজনে মন্তব্য লিখুন...' : 'Remarks...'}
                          className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Submit Button */}
        {students.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:bg-blue-400"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'হাজিরা নিশ্চিত ও সংরক্ষণ করুন' : 'Confirm & Save Attendance')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
