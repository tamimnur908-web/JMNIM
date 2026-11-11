import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Award, 
  PlusCircle, 
  Printer, 
  Search, 
  CheckCircle, 
  BookOpen, 
  FileText,
  Save
} from 'lucide-react';
import { MadrasaClass, Student, Examination, ExamMark } from '../types';
import { fetchClasses } from '../utils/classManager';
import { logAudit } from '../utils/auditLogger';

export const ExamsResultsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [exams, setExams] = useState<Examination[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { marksObtained: number; grade: string; remarks: string }>>({});
  const [subjectName, setSubjectName] = useState<string>('কুরআন মাজীদ ও তাজবীদ');
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [passMarks, setPassMarks] = useState<number>(40);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Exam Modal
  const [showNewExamModal, setShowNewExamModal] = useState(false);
  const [newExamName, setNewExamName] = useState('১ম সাময়িক পরীক্ষা ২০২৪');
  const [newExamStartDate, setNewExamStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Printable Result Card Modal
  const [resultCardStudent, setResultCardStudent] = useState<Student | null>(null);

  const calculateGrade = (obtained: number, max: number): string => {
    const pct = (obtained / max) * 100;
    if (pct >= 80) return isBn ? 'মুমতাজ (A+)' : 'Mumtaz (A+)';
    if (pct >= 70) return isBn ? 'জায়্যিদ জিদ্দান (A)' : 'Jayyid Jiddan (A)';
    if (pct >= 60) return isBn ? 'জায়্যিদ (B)' : 'Jayyid (B)';
    if (pct >= 40) return isBn ? 'মকবুল (C)' : 'Maqbool (C)';
    return isBn ? 'রাসিব (Fail)' : 'Rasib (Fail)';
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      const clsList = await fetchClasses();
      setClasses(clsList);
      if (clsList.length > 0) setSelectedClassId(clsList[0].id);

      const eSnap = await getDocs(collection(db, 'examinations'));
      const eList: Examination[] = [];
      eSnap.forEach(d => eList.push({ id: d.id, ...d.data() } as Examination));

      if (eList.length === 0) {
        // Seed default exam
        const defaultExam: Omit<Examination, 'id'> = {
          name: '১ম সাময়িক পরীক্ষা ২০২৪',
          sessionId: settings.currentSessionId || '2024-2025',
          classId: clsList[0]?.id || 'C1',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          status: 'published'
        };
        const docRef = await addDoc(collection(db, 'examinations'), defaultExam);
        eList.push({ id: docRef.id, ...defaultExam });
      }

      setExams(eList);
      if (eList.length > 0) setSelectedExamId(eList[0].id);
    } catch (err) {
      console.warn("Could not load exam data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  // Load students and marks when class or exam changes
  useEffect(() => {
    const loadStudentsAndMarks = async () => {
      if (!selectedClassId || !selectedExamId) return;
      try {
        const q = query(
          collection(db, 'students'),
          where('classId', '==', selectedClassId),
          where('isArchived', '!=', true)
        );
        const snap = await getDocs(q);
        const sList: Student[] = [];
        snap.forEach(d => sList.push({ id: d.id, ...d.data() } as Student));
        sList.sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));
        setStudents(sList);

        // Fetch marks for this exam and class
        const mSnap = await getDocs(query(
          collection(db, 'exam_marks'),
          where('examId', '==', selectedExamId),
          where('classId', '==', selectedClassId),
          where('subjectName', '==', subjectName)
        ));

        const marksMap: Record<string, any> = {};
        mSnap.forEach(d => {
          const data = d.data();
          marksMap[data.studentId] = {
            marksObtained: data.marksObtained,
            grade: data.grade,
            remarks: data.remarks || ''
          };
        });

        // Initialize missing with default
        sList.forEach(s => {
          if (!marksMap[s.studentId]) {
            marksMap[s.studentId] = { marksObtained: 80, grade: calculateGrade(80, maxMarks), remarks: '' };
          }
        });

        setMarks(marksMap);
      } catch (err) {
        console.warn("Could not load exam marks:", err);
      }
    };

    loadStudentsAndMarks();
  }, [selectedClassId, selectedExamId, subjectName]);

  const handleMarksChange = (studentId: string, val: number) => {
    const grade = calculateGrade(val, maxMarks);
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marksObtained: val,
        grade
      }
    }));
  };

  const handleSaveMarks = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      const targetExam = exams.find(e => e.id === selectedExamId);
      const targetClass = classes.find(c => c.id === selectedClassId);

      for (const s of students) {
        const m = marks[s.studentId] || { marksObtained: 0, grade: 'Fail', remarks: '' };
        const markDocId = `${selectedExamId}_${selectedClassId}_${s.studentId}_${subjectName.replace(/\s+/g, '_')}`;

        const markRecord: ExamMark = {
          id: markDocId,
          examId: selectedExamId,
          examName: targetExam?.name,
          studentId: s.studentId,
          studentName: s.fullName,
          roll: s.roll,
          classId: selectedClassId,
          subjectId: 'SUB-1',
          subjectName,
          marksObtained: Number(m.marksObtained),
          maxMarks: Number(maxMarks),
          passMarks: Number(passMarks),
          grade: m.grade,
          remarks: m.remarks,
          submittedBy: currentUser?.displayName || 'Teacher',
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'exam_marks', markDocId), markRecord);
      }

      await logAudit({
        action: 'Exam Marks Saved',
        module: 'Exams & Results',
        performedBy: currentUser?.displayName || 'Teacher',
        performedByRole: role || 'teacher',
        performedByUid: currentUser?.uid,
        details: `${targetExam?.name} - ${targetClass?.name} - বিষয়: ${subjectName} নম্বর সংরক্ষণ সম্পন্ন।`
      });

      setSuccessMsg(isBn ? 'পরীক্ষার নম্বর সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে!' : 'Exam marks saved successfully!');
    } catch (err: any) {
      alert((isBn ? 'নম্বর সংরক্ষণে সমস্যা: ' : 'Failed to save marks: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const record: Omit<Examination, 'id'> = {
        name: newExamName.trim(),
        sessionId: settings.currentSessionId || '2024-2025',
        classId: selectedClassId,
        startDate: newExamStartDate,
        endDate: newExamStartDate,
        status: 'published'
      };

      const docRef = await addDoc(collection(db, 'examinations'), record);
      setShowNewExamModal(false);
      setExams(prev => [...prev, { id: docRef.id, ...record }]);
      setSelectedExamId(docRef.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const selectedExamObj = exams.find(e => e.id === selectedExamId);
  const selectedClassObj = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Award className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'পরীক্ষা ও ফলাফল ব্যবস্থাপনা' : 'Exams & Result Management'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'পরীক্ষা তৈরি, বিষয়ভিত্তিক নম্বর এন্ট্রি, মুমতাজ-জায়্যিদ-মকবুল গ্রেডিং ও ফলাফল পত্র' 
              : 'Examination creation, subject-wise marks entry, automatic grading and marksheets'}
          </p>
        </div>

        <button
          onClick={() => setShowNewExamModal(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition w-fit"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isBn ? 'নতুন পরীক্ষা তৈরি' : 'Create Exam'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Selector Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'পরীক্ষা নির্বাচন' : 'Select Exam'}</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-bold text-blue-700"
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'জামাত / শ্রেণি' : 'Class'}</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'বিষয় / কিতাব' : 'Subject'}</label>
          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="কুরআন মাজীদ..."
            className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'পূর্ণমান / পাস মার্ক' : 'Max / Pass'}</label>
          <div className="flex space-x-1.5">
            <input
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
              className="w-1/2 text-xs px-2 py-1.5 border border-slate-300 rounded-lg text-center"
              placeholder="100"
            />
            <input
              type="number"
              value={passMarks}
              onChange={(e) => setPassMarks(Number(e.target.value))}
              className="w-1/2 text-xs px-2 py-1.5 border border-slate-300 rounded-lg text-center"
              placeholder="40"
            />
          </div>
        </div>
      </div>

      {/* Marks Entry Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs text-slate-800">
              {selectedExamObj?.name} • {selectedClassObj?.name} • বিষয়: {subjectName} (পূর্ণমান: {maxMarks})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3 w-12 text-center">{isBn ? 'রোল' : 'Roll'}</th>
                <th className="py-3 px-3">{isBn ? 'শিক্ষার্থী আইডি ও নাম' : 'Student'}</th>
                <th className="py-3 px-3">{isBn ? 'প্রাপ্ত নম্বর' : 'Marks Obtained'}</th>
                <th className="py-3 px-3 text-center">{isBn ? 'গ্রেড / ফলাফল' : 'Grade'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'ফলাফল কার্ড' : 'Progress Card'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {isBn ? 'লোড হচ্ছে...' : 'Loading...'}
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {isBn ? 'এই শ্রেণিতে কোনো সক্রিয় শিক্ষার্থী নেই।' : 'No students found.'}
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const m = marks[s.studentId] || { marksObtained: 0, grade: 'Fail' };
                  const isPassed = m.marksObtained >= passMarks;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-center font-bold text-slate-700">{s.roll}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{s.fullName}</p>
                        <p className="text-[10px] text-blue-600 font-mono">{s.studentId}</p>
                      </td>
                      <td className="py-3 px-3 w-40">
                        <input
                          type="number"
                          value={m.marksObtained}
                          onChange={(e) => handleMarksChange(s.studentId, Number(e.target.value))}
                          min={0}
                          max={maxMarks}
                          className="w-24 text-center font-bold text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="ml-1 text-slate-400 text-[11px]">/ {maxMarks}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPassed ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                          {m.grade}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setResultCardStudent(s)}
                          className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg ml-auto"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isBn ? 'ফলাফল পত্র' : 'Marksheet'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {students.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleSaveMarks}
              disabled={saving}
              className="flex items-center space-x-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:bg-blue-400"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'নম্বরপত্র সংরক্ষণ করুন' : 'Save Marksheet')}</span>
            </button>
          </div>
        )}
      </div>

      {/* New Exam Modal */}
      {showNewExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2 border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'নতুন পরীক্ষা তৈরি' : 'Create Examination'}</h3>
              <button onClick={() => setShowNewExamModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateNewExam} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{isBn ? 'পরীক্ষার নাম' : 'Exam Title'}</label>
                <input
                  type="text"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder={isBn ? 'যেমন: বার্ষিক পরীক্ষা ২০২৪' : 'Annual Exam...'}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{isBn ? 'শুরুর তারিখ' : 'Start Date'}</label>
                <input
                  type="date"
                  value={newExamStartDate}
                  onChange={(e) => setNewExamStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewExamModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                >
                  {isBn ? 'তৈরি করুন' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Result Card Modal */}
      {resultCardStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none p-5 sm:p-6 print:p-0 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'শিক্ষার্থীর ফলাফল পত্র' : 'Marksheet Card'}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button onClick={() => setResultCardStudent(null)} className="px-2 text-slate-400">✕</button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border rounded-xl space-y-3 text-xs print:bg-white print:border-none print:p-0">
              <div className="text-center border-b pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn ? settings.institutionName : settings.institutionNameEn}
                </h2>
                <p className="text-[11px] text-slate-500">{settings.address} • ফোন: {settings.phone}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                  {selectedExamObj?.name} - {isBn ? 'ফলাফল পত্র (Progress Report)' : 'Progress Report'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">শিক্ষার্থীর নাম:</span>
                  <span className="font-bold text-slate-900">{resultCardStudent.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">শিক্ষার্থী আইডি ও রোল:</span>
                  <span className="font-mono font-bold text-blue-700">{resultCardStudent.studentId} (রোল: {resultCardStudent.roll})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">জামাত / শ্রেণি:</span>
                  <span className="font-medium text-slate-800">{resultCardStudent.className}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">অভিভাবকের নাম:</span>
                  <span className="font-medium text-slate-800">{resultCardStudent.guardianName}</span>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-200 text-left text-xs bg-white">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="p-2">বিষয়</th>
                    <th className="p-2 text-center">পূর্ণমান</th>
                    <th className="p-2 text-center">প্রাপ্ত নম্বর</th>
                    <th className="p-2 text-center">গ্রেড</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{subjectName}</td>
                    <td className="p-2 text-center">{maxMarks}</td>
                    <td className="p-2 text-center font-bold text-slate-900">
                      {marks[resultCardStudent.studentId]?.marksObtained || 0}
                    </td>
                    <td className="p-2 text-center font-bold text-emerald-700">
                      {marks[resultCardStudent.studentId]?.grade || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-8 flex flex-wrap justify-between gap-4 text-slate-500 text-[10px]">
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'শ্রেণি শিক্ষকের স্বাক্ষর' : 'Class Teacher'}
                </div>
                <div className="border-t border-slate-400 w-28 text-center pt-1">
                  {isBn ? 'প্রধান শিক্ষক / মুহতামিম' : 'Headmaster / Principal'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
