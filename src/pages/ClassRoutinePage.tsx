import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  CalendarDays, 
  PlusCircle, 
  Trash2, 
  Printer, 
  Clock, 
  BookOpen, 
  UserCheck 
} from 'lucide-react';
import { MadrasaClass, Section, Teacher, ClassRoutine } from '../types';
import { fetchClasses, fetchSections } from '../utils/classManager';
import { logAudit } from '../utils/auditLogger';

export const ClassRoutinePage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, role } = useAuth();
  const isBn = language === 'bn';

  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [routines, setRoutines] = useState<ClassRoutine[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('Saturday');

  // Add Period Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [periodNumber, setPeriodNumber] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:45');
  const [subjectName, setSubjectName] = useState('কুরআন মাজীদ ও তাজবীদ');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [roomNo, setRoomNo] = useState('১০১');

  const daysOfWeek = [
    { id: 'Saturday', label: isBn ? 'শনিবার' : 'Saturday' },
    { id: 'Sunday', label: isBn ? 'রবিবার' : 'Sunday' },
    { id: 'Monday', label: isBn ? 'সোমবার' : 'Monday' },
    { id: 'Tuesday', label: isBn ? 'মঙ্গলবার' : 'Tuesday' },
    { id: 'Wednesday', label: isBn ? 'বুধবার' : 'Wednesday' },
    { id: 'Thursday', label: isBn ? 'বৃহস্পতিবার' : 'Thursday' }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const clsList = await fetchClasses();
      setClasses(clsList);
      if (clsList.length > 0) setSelectedClassId(clsList[0].id);

      const secList = await fetchSections();
      setSections(secList);

      const tSnap = await getDocs(collection(db, 'teachers'));
      const tList: Teacher[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as Teacher));
      setTeachers(tList);
      if (tList.length > 0) setSelectedTeacherId(tList[0].teacherId);

      const rSnap = await getDocs(collection(db, 'class_routines'));
      const rList: ClassRoutine[] = [];
      rSnap.forEach(d => rList.push({ id: d.id, ...d.data() } as ClassRoutine));
      setRoutines(rList);
    } catch (err) {
      console.warn("Could not load class routines:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;

    try {
      const targetClass = classes.find(c => c.id === selectedClassId);
      const targetSection = sections.find(s => s.id === selectedSectionId);
      const targetTeacher = teachers.find(t => t.teacherId === selectedTeacherId);

      const newPeriod: Omit<ClassRoutine, 'id'> = {
        classId: selectedClassId,
        className: targetClass?.name,
        sectionId: selectedSectionId !== 'all' ? selectedSectionId : undefined,
        sectionName: targetSection?.name,
        day: selectedDay as any,
        period: Number(periodNumber),
        startTime,
        endTime,
        subjectId: 'SUB-' + Date.now().toString().slice(-4),
        subjectName,
        teacherId: selectedTeacherId,
        teacherName: targetTeacher?.fullName || 'উস্তাদ',
        roomNo
      };

      await addDoc(collection(db, 'class_routines'), newPeriod);

      await logAudit({
        action: 'Routine Period Added',
        module: 'Class Routine',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `${targetClass?.name} ক্লাসের ${selectedDay} এর ${periodNumber}ম পিরিয়ড যুক্ত করা হয়েছে (${subjectName})।`
      });

      setShowAddModal(false);
      const rSnap = await getDocs(collection(db, 'class_routines'));
      const rList: ClassRoutine[] = [];
      rSnap.forEach(d => rList.push({ id: d.id, ...d.data() } as ClassRoutine));
      setRoutines(rList);
    } catch (err: any) {
      alert((isBn ? 'পিরিয়ড যোগ করতে ব্যর্থ: ' : 'Failed to add period: ') + err.message);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!window.confirm(isBn ? 'আপনি কি নিশ্চিতভাবে এই পিরিয়ডটি মুছে ফেলতে চান?' : 'Are you sure you want to remove this period?')) return;
    try {
      await deleteDoc(doc(db, 'class_routines', id));
      setRoutines(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredRoutines = routines.filter(r => {
    if (r.classId !== selectedClassId) return false;
    if (r.day !== selectedDay) return false;
    if (selectedSectionId !== 'all' && r.sectionId && r.sectionId !== selectedSectionId) return false;
    return true;
  }).sort((a, b) => a.period - b.period);

  const selectedClassObj = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'ক্লাস রুটিন ও সময়সূচি' : 'Class Routine & Schedule'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'শ্রেণি ও শাখাওয়ারি সাপ্তাহিক ক্লাস পিরিয়ড, বিষয়, নির্ধারিত শিক্ষক ও রুম বিন্যাস' 
              : 'Weekly timetable by class, section, subject, faculty and classroom'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isBn ? 'নতুন পিরিয়ড যোগ' : 'Add Period'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Class & Day Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'শ্রেণি নির্বাচন' : 'Select Class'}</label>
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">{isBn ? 'শাখা' : 'Section'}</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{isBn ? 'সকল শাখা' : 'All Sections'}</option>
              {sections.filter(s => s.classId === selectedClassId).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Days Filter */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {daysOfWeek.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedDay === d.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Routine Display Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 print:border-none print:shadow-none">
        <div className="text-center border-b pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {isBn ? settings.institutionName : settings.institutionNameEn}
          </h2>
          <p className="text-xs text-slate-600">
            {selectedClassObj?.name} • {daysOfWeek.find(d => d.id === selectedDay)?.label} - {isBn ? 'ক্লাস রুটিন' : 'Class Routine'}
          </p>
        </div>

        {filteredRoutines.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {isBn ? 'এই দিনে কোনো পিরিয়ড নির্ধারিত নেই। নতুন পিরিয়ড যোগ করুন।' : 'No periods scheduled for this day.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRoutines.map((r) => (
              <div key={r.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-sm transition relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                    {isBn ? `${r.period}ম পিরিয়ড` : `Period ${r.period}`}
                  </span>
                  <div className="flex items-center space-x-1 text-slate-500 text-[11px] font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{r.startTime} - {r.endTime}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm">{r.subjectName}</p>
                  <p className="text-xs text-slate-700 font-medium">উস্তাদ: {r.teacherName}</p>
                  {r.roomNo && (
                    <p className="text-[10px] text-slate-400">রুম নং: {r.roomNo}</p>
                  )}
                </div>

                <button
                  onClick={() => handleDeletePeriod(r.id)}
                  className="absolute bottom-3 right-3 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition no-print"
                  title="মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Period Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{isBn ? 'নতুন পিরিয়ড সংযোজন' : 'Add New Period'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAddPeriod} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'পিরিয়ড ক্রম (নং)' : 'Period No'}</label>
                  <input
                    type="number"
                    value={periodNumber}
                    onChange={(e) => setPeriodNumber(Number(e.target.value))}
                    min={1}
                    max={10}
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'রুম নং' : 'Room No'}</label>
                  <input
                    type="text"
                    value={roomNo}
                    onChange={(e) => setRoomNo(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'শুরুর সময়' : 'Start Time'}</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{isBn ? 'শেষের সময়' : 'End Time'}</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">{isBn ? 'পাঠ্য বিষয় / কিতাব' : 'Subject Name'}</label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder={isBn ? 'যেমন: নূরানী কায়েদা / হেদায়াতুন নাহু...' : 'Subject name...'}
                  className="w-full px-3 py-1.5 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{isBn ? 'পাঠদানকারী উস্তাদ / শিক্ষক' : 'Teacher'}</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg bg-white"
                  required
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.teacherId}>{t.fullName} ({t.designation})</option>
                  ))}
                </select>
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
                  {isBn ? 'সংরক্ষণ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
