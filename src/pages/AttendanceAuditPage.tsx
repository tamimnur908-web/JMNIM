import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  ClipboardCheck, 
  Search, 
  Calendar, 
  Edit3, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  History,
  Shield
} from 'lucide-react';
import { TeacherAttendanceEvent, AttendanceStatus } from '../types';
import { getTodayDateString, formatNumber, formatDate } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export const AttendanceAuditPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser, role, isSuperAdmin } = useAuth();
  const isBn = language === 'bn';

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [events, setEvents] = useState<TeacherAttendanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Override Modal
  const [selectedEvent, setSelectedEvent] = useState<TeacherAttendanceEvent | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'teacher_attendance_events'),
        where('date', '==', selectedDate)
      );
      const snap = await getDocs(q);
      const list: TeacherAttendanceEvent[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as TeacherAttendanceEvent));
      list.sort((a, b) => (b.time > a.time ? 1 : -1));
      setEvents(list);
    } catch (err) {
      console.warn("Could not load attendance logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  const handleOpenOverride = (ev: TeacherAttendanceEvent) => {
    setSelectedEvent(ev);
    setOverrideStatus('present');
    setOverrideReason('');
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!overrideReason.trim()) {
      alert(isBn ? 'সংশোধনের কারণ উল্লেখ করা বাধ্যতামূলক।' : 'Reason is mandatory for attendance override.');
      return;
    }

    setSubmitting(true);
    try {
      const previousStatus = selectedEvent.status;
      const docRef = doc(db, 'teacher_attendance_events', selectedEvent.id);

      await updateDoc(docRef, {
        status: overrideStatus,
        isManualCorrection: true,
        correctionReason: overrideReason.trim(),
        correctedBy: currentUser?.displayName || currentUser?.email || 'Admin',
        originalValues: {
          status: previousStatus,
          isWithinGeofence: selectedEvent.isWithinGeofence
        }
      });

      // Add to attendance corrections collection
      await addDoc(collection(db, 'attendance_corrections'), {
        teacherId: selectedEvent.teacherId,
        teacherName: selectedEvent.teacherName,
        date: selectedEvent.date,
        previousValue: previousStatus,
        newValue: overrideStatus,
        reason: overrideReason.trim(),
        correctedBy: currentUser?.displayName || 'Admin',
        timestamp: new Date().toISOString()
      });

      // Audit Log
      await logAudit({
        action: 'Attendance Override',
        module: 'Attendance Audit',
        recordId: selectedEvent.id,
        recordType: 'TeacherAttendanceEvent',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        previousValue: { status: previousStatus },
        newValue: { status: overrideStatus },
        reason: overrideReason.trim(),
        details: `হাজিরা অডিট সংশোধন: ${selectedEvent.teacherName} (${selectedEvent.teacherId}) এর অবস্থা ${previousStatus} থেকে ${overrideStatus} এ পরিবর্তিত হয়েছে।`
      });

      setSelectedEvent(null);
      setSuccessMsg(isBn ? 'হাজিরা সফলভাবে সংশোধন ও অডিট লগ সংরক্ষিত হয়েছে।' : 'Attendance successfully overridden and audited.');
      await loadAttendance();
    } catch (err: any) {
      alert((isBn ? 'সংশোধন ব্যর্থ: ' : 'Failed to override: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = events.filter(ev => {
    if (statusFilter !== 'all' && ev.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = ev.teacherName?.toLowerCase().includes(q);
      const matchId = ev.teacherId?.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  const statusBadge = (st: AttendanceStatus, isCorrected?: boolean) => {
    switch (st) {
      case 'present':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{isBn ? 'উপস্থিত' : 'Present'}</span>;
      case 'late':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{isBn ? 'বিলম্ব' : 'Late'}</span>;
      case 'absent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">{isBn ? 'অনুপস্থিত' : 'Absent'}</span>;
      case 'early_leave':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">{isBn ? 'আগে প্রস্থান' : 'Early Leave'}</span>;
      case 'leave':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">{isBn ? 'ছুটি' : 'On Leave'}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">{st}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <span>{isBn ? 'হাজিরা অডিট ও ম্যানুয়াল সংশোধন' : 'Attendance Audit & Overrides'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isBn 
              ? 'দৈনিক শিক্ষক জিপিএস হাজিরা পর্যবেক্ষণ, অনাকাঙ্ক্ষিত কারণে লেট/অনুপস্থিতি সংশোধন এবং নিরাপদ অডিট ট্রেইল' 
              : 'Review daily attendance records, perform admin overrides with mandatory reasons and audit trail'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'শিক্ষকের নাম বা আইডি...' : 'Search teacher name or ID...'}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600">{isBn ? 'স্ট্যাটাস:' : 'Status:'}</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">{isBn ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
            <option value="present">{isBn ? 'উপস্থিত' : 'Present'}</option>
            <option value="late">{isBn ? 'বিলম্ব (Late)' : 'Late'}</option>
            <option value="early_leave">{isBn ? 'আগে প্রস্থান' : 'Early Leave'}</option>
            <option value="leave">{isBn ? 'ছুটি' : 'Leave'}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{isBn ? 'শিক্ষক' : 'Teacher'}</th>
                <th className="py-3 px-3">{isBn ? 'ইভেন্ট' : 'Event'}</th>
                <th className="py-3 px-3">{isBn ? 'সময়' : 'Time'}</th>
                <th className="py-3 px-3">{isBn ? 'দূরত্ব ও জিওফেন্স' : 'Distance & Geofence'}</th>
                <th className="py-3 px-3">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                <th className="py-3 px-3">{isBn ? 'সংশোধন তথ্য' : 'Audit Note'}</th>
                <th className="py-3 px-3 text-right">{isBn ? 'পদক্ষেপ' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {isBn ? 'লোড হচ্ছে...' : 'Loading...'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {isBn ? 'নির্বাচিত তারিখে কোনো হাজিরার রেকর্ড নেই।' : 'No attendance events found for this date.'}
                  </td>
                </tr>
              ) : (
                filtered.map((ev, idx) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{ev.teacherName}</p>
                      <p className="text-[10px] text-blue-600 font-mono">{ev.teacherId}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        ev.eventType === 'check_in' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {ev.eventType === 'check_in' ? (isBn ? 'চেক-ইন' : 'Check In') : (isBn ? 'চেক-আউট' : 'Check Out')}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{ev.time}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ev.distanceMeters || 0} মি.</span>
                        {ev.isWithinGeofence ? (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">মাদরাসায়</span>
                        ) : (
                          <span className="text-[10px] text-red-700 font-bold bg-red-50 px-1 rounded">বাইরে</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {statusBadge(ev.status, ev.isManualCorrection)}
                      {ev.isManualCorrection && (
                        <span className="block text-[9px] text-purple-700 font-semibold mt-0.5">
                          ✓ ম্যানুয়াল ওভাররাইড
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      {ev.isManualCorrection ? (
                        <p className="text-[11px] text-slate-600 truncate" title={ev.correctionReason}>
                          <b>{ev.correctedBy}:</b> {ev.correctionReason}
                        </p>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleOpenOverride(ev)}
                        className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                      >
                        {isBn ? 'সংশোধন' : 'Override'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override Dialog */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'হাজিরা সংশোধন / ওভাররাইড' : 'Attendance Status Override'}</span>
              </h3>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p><b>{isBn ? 'শিক্ষক:' : 'Teacher:'}</b> {selectedEvent.teacherName} ({selectedEvent.teacherId})</p>
                <p><b>{isBn ? 'তারিখ ও সময়:' : 'Time:'}</b> {selectedEvent.date} {selectedEvent.time}</p>
                <p><b>{isBn ? 'বর্তমান স্ট্যাটাস:' : 'Current Status:'}</b> <span className="font-bold text-amber-700">{selectedEvent.status}</span></p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'নতুন পরিবর্তিত স্ট্যাটাস নির্বাচন করুন:' : 'Select New Status:'}
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as AttendanceStatus)}
                  className="w-full px-3 py-2 border rounded-lg bg-white font-semibold"
                >
                  <option value="present">{isBn ? 'উপস্থিত (Present)' : 'Present'}</option>
                  <option value="late">{isBn ? 'বিলম্ব (Late)' : 'Late'}</option>
                  <option value="early_leave">{isBn ? 'আগে প্রস্থান (Early Leave)' : 'Early Leave'}</option>
                  <option value="leave">{isBn ? 'অনুমোদিত ছুটি (Approved Leave)' : 'Leave'}</option>
                  <option value="absent">{isBn ? 'অনুপস্থিত (Absent)' : 'Absent'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'সংশোধনের সুনির্দিষ্ট কারণ (অডিট ট্রেইল) *' : 'Reason for override (Mandatory audit trail) *'}
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder={isBn ? 'যেমন: বিদ্যুৎ বিভ্রাটের কারণে জিপিএস বিলম্ব / অফিসিয়াল দায়িত্বে বাইরে ছিলেন...' : 'Enter precise justification...'}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  {submitting ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'সংশোধন নিশ্চিত করুন' : 'Confirm Override')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
