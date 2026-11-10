import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RotateCw,
  Calendar,
  Navigation
} from 'lucide-react';
import { calculateHaversineDistance } from '../utils/geo';
import { 
  formatNumber, 
  getTodayDateString, 
  getCurrentTimeString, 
  isLateCheckIn, 
  isEarlyCheckOut 
} from '../utils/formatters';
import { TeacherAttendanceEvent, AttendanceStatus } from '../types';

export const TeacherAttendancePage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { userProfile } = useAuth();
  const isBn = language === 'bn';

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [todayEvents, setTodayEvents] = useState<TeacherAttendanceEvent[]>([]);
  const [teachersList, setTeachersList] = useState<{ id: string; teacherId: string; fullName: string }[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const snap = await getDocs(collection(db, 'teachers'));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setTeachersList(list);

        if (userProfile?.teacherId) {
          setSelectedTeacherId(userProfile.teacherId);
        } else if (list.length > 0) {
          setSelectedTeacherId(list[0].teacherId);
        }
      } catch (err) {
        console.warn("Error fetching teachers:", err);
      }
    };
    fetchTeachers();
  }, [userProfile]);

  const loadTodayEvents = async () => {
    try {
      const today = getTodayDateString();
      const q = query(
        collection(db, 'teacher_attendance_events'),
        where('date', '==', today)
      );
      const snap = await getDocs(q);
      const events: TeacherAttendanceEvent[] = [];
      snap.forEach(d => events.push({ id: d.id, ...d.data() } as TeacherAttendanceEvent));
      events.sort((a, b) => (b.time > a.time ? 1 : -1));
      setTodayEvents(events);
    } catch (err) {
      console.warn("Could not load attendance events:", err);
    }
  };

  useEffect(() => {
    loadTodayEvents();
  }, []);

  const requestLocation = () => {
    setLocating(true);
    setGeoError(null);
    setMessage(null);

    if (!navigator.geolocation) {
      setGeoError(isBn ? "আপনার ব্রাউজারে Geolocation সমর্থিত নয়।" : "Geolocation not supported in your browser.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocating(false);
      },
      (err) => {
        let msg = isBn ? "লোকেশন অনুমতি দেওয়া হয়নি বা জিপিএস সংকেত পাওয়া যায়নি।" : "Location permission denied or GPS unavailable.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = isBn ? "লোকেশন পারমিশন ব্লক করা আছে। ব্রাউজার সেটিংস থেকে লোকেশন Allow করুন।" : "Location permission blocked. Please enable location access in browser settings.";
        }
        setGeoError(msg);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const distance = currentCoords ? calculateHaversineDistance(
    currentCoords,
    { lat: settings.gpsLat, lng: settings.gpsLng }
  ) : null;

  const isWithinRadius = distance !== null ? distance <= settings.allowedRadiusMeters : false;

  const handleAttendance = async (eventType: 'check_in' | 'check_out') => {
    if (!currentCoords || distance === null) {
      setMessage({ type: 'error', text: isBn ? 'প্রথমে জিপিএস লোকেশন লোড করুন।' : 'Please detect GPS location first.' });
      return;
    }

    if (!selectedTeacherId) {
      setMessage({ type: 'error', text: isBn ? 'অনুগ্রহ করে শিক্ষক নির্বাচন করুন।' : 'Please select a teacher.' });
      return;
    }

    const teacher = teachersList.find(t => t.teacherId === selectedTeacherId);
    const teacherName = teacher?.fullName || (isBn ? 'উস্তাদ' : 'Teacher');
    const today = getTodayDateString();
    const timeNow = getCurrentTimeString();

    const existing = todayEvents.find(e => e.teacherId === selectedTeacherId && e.eventType === eventType);
    if (existing) {
      setMessage({ 
        type: 'warning', 
        text: isBn 
          ? `আজকের জন্য ${eventType === 'check_in' ? 'চেক-ইন' : 'চেক-আউট'} ইতিমধ্যে সম্পন্ন হয়েছে (${formatNumber(existing.time, isBn)})!`
          : `${eventType === 'check_in' ? 'Check-in' : 'Check-out'} already recorded for today at ${existing.time}!`
      });
      return;
    }

    if (!isWithinRadius) {
      setMessage({ 
        type: 'error', 
        text: isBn
          ? `আপনি মাদরাসা থেকে ${formatNumber(distance, isBn)} মিটার দূরে আছেন। অনুমোদিত ব্যাসার্ধ সর্বোচ্চ ${formatNumber(settings.allowedRadiusMeters, isBn)} মিটার।`
          : `You are ${distance} meters away. Maximum allowed radius is ${settings.allowedRadiusMeters} meters.`
      });
      return;
    }

    let status: AttendanceStatus = 'present';
    if (eventType === 'check_in') {
      const late = isLateCheckIn(timeNow, settings.dailyCheckInTime, settings.lateGraceMinutes);
      status = late ? 'late' : 'present';
    } else {
      const early = isEarlyCheckOut(timeNow, settings.dailyCheckOutTime);
      status = early ? 'early_leave' : 'present';
    }

    setSubmitting(true);
    try {
      const newEvent: Omit<TeacherAttendanceEvent, 'id'> = {
        teacherId: selectedTeacherId,
        teacherName,
        date: today,
        eventType,
        time: timeNow,
        timestamp: new Date().toISOString(),
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        accuracy: accuracy || 0,
        distanceMeters: distance,
        status,
        isWithinGeofence: true,
      };

      await addDoc(collection(db, 'teacher_attendance_events'), newEvent);
      setMessage({ 
        type: 'success', 
        text: isBn 
          ? `${teacherName} এর ${eventType === 'check_in' ? 'চেক-ইন' : 'চেক-আউট'} সফল হয়েছে! অবস্থা: ${status === 'late' ? 'বিলম্ব' : status === 'early_leave' ? 'আগে প্রস্থান' : 'অন-টাইম'}`
          : `${eventType === 'check_in' ? 'Check-in' : 'Check-out'} recorded for ${teacherName}! Status: ${status}`
      });

      await loadTodayEvents();
    } catch (err: any) {
      setMessage({ type: 'error', text: (isBn ? 'হাজিরা সংরক্ষণে ত্রুটি: ' : 'Attendance recording error: ') + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>{t.attendanceTitle}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {t.attendanceSubtitle}
          </p>
        </div>

        <button
          onClick={requestLocation}
          disabled={locating}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition w-fit"
        >
          <RotateCw className={`w-3.5 h-3.5 ${locating ? 'animate-spin text-blue-600' : ''}`} />
          <span>{locating ? t.findingGps : t.refreshGps}</span>
        </button>
      </div>

      {/* Geofence Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GPS Live Status */}
        <div className={`p-4 rounded-xl border ${isWithinRadius ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'} md:col-span-2`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                {isWithinRadius ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h3 className="font-bold text-sm text-slate-900">
                  {isWithinRadius ? t.insideGeofence : t.outsideGeofence}
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {distance !== null ? (
                  <>
                    {t.distanceFromMadrasa} <strong className="font-mono text-slate-900">{formatNumber(distance, isBn)} {t.metersUnit}</strong> ({t.allowedRadiusLabel} {formatNumber(settings.allowedRadiusMeters, isBn)} {t.metersUnit})
                  </>
                ) : (
                  isBn ? 'লোকেশন লোড হচ্ছে...' : 'Detecting coordinates...'
                )}
              </p>
            </div>

            {accuracy !== null && (
              <span className={`text-[11px] px-2 py-1 rounded-md font-medium border ${accuracy <= 50 ? 'bg-white text-emerald-700 border-emerald-200' : 'bg-white text-amber-700 border-amber-200'}`}>
                {t.gpsAccuracy}: ±{formatNumber(accuracy, isBn)} {t.accuracyUnit}
              </span>
            )}
          </div>

          {geoError && (
            <div className="mt-3 p-2 bg-rose-100/80 text-rose-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{geoError}</span>
            </div>
          )}

          {currentCoords && (
            <div className="mt-3 text-[11px] text-slate-500 font-mono flex items-center space-x-4">
              <span>{t.latitudeLabel}: {currentCoords.lat.toFixed(6)}</span>
              <span>{t.longitudeLabel}: {currentCoords.lng.toFixed(6)}</span>
            </div>
          )}
        </div>

        {/* Shift Timings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm text-xs space-y-2">
          <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>{t.todaySchedule}</span>
          </h4>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">{t.checkInTime}</span>
            <span className="font-semibold text-slate-800">{formatNumber(settings.dailyCheckInTime, isBn)} AM</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">{t.checkOutTime}</span>
            <span className="font-semibold text-slate-800">{formatNumber(settings.dailyCheckOutTime, isBn)} AM</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">{t.lateConsideration}</span>
            <span className="font-semibold text-slate-800">+{formatNumber(settings.lateGraceMinutes, isBn)} {t.minutesUnit}</span>
          </div>
        </div>
      </div>

      {/* Action Form */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900">{t.submitAttendance}</h3>

        {message && (
          <div className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            message.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
            'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {message.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />}
            {message.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />}
            {message.type === 'error' && <XCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.selectTeacher}
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {teachersList.length === 0 ? (
                <option value="">{t.noTeachersInDb}</option>
              ) : (
                teachersList.map(item => (
                  <option key={item.id} value={item.teacherId}>
                    {item.fullName} ({item.teacherId})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-end space-x-3">
            <button
              onClick={() => handleAttendance('check_in')}
              disabled={submitting || !isWithinRadius}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              <Navigation className="w-4 h-4" />
              <span>{t.checkIn}</span>
            </button>

            <button
              onClick={() => handleAttendance('check_out')}
              disabled={submitting || !isWithinRadius}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{t.checkOut}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Today's Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{t.todayAttendanceList} ({formatNumber(getTodayDateString(), isBn)})</span>
          </h3>
          <span className="text-xs font-medium text-slate-500">{t.totalEntries}: {formatNumber(todayEvents.length, isBn)}</span>
        </div>

        {todayEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {t.emptyStateMsg}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">{t.teacherName}</th>
                  <th className="py-2.5 px-4">{t.event}</th>
                  <th className="py-2.5 px-4">{t.time}</th>
                  <th className="py-2.5 px-4">{t.measuredDistance}</th>
                  <th className="py-2.5 px-4">{t.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {ev.teacherName} <span className="text-slate-400 font-mono">({ev.teacherId})</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ev.eventType === 'check_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {ev.eventType === 'check_in' ? (isBn ? 'চেক-ইন' : 'Check In') : (isBn ? 'চেক-আউট' : 'Check Out')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{formatNumber(ev.time, isBn)}</td>
                    <td className="py-2.5 px-4 font-mono">{formatNumber(ev.distanceMeters, isBn)} {t.accuracyUnit}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        ev.status === 'late' ? 'bg-amber-100 text-amber-800' :
                        ev.status === 'early_leave' ? 'bg-orange-100 text-orange-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {ev.status === 'late' ? t.late : ev.status === 'early_leave' ? t.earlyLeave : t.onTime}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
