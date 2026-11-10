import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RotateCw, 
  Calendar, 
  Navigation, 
  ShieldCheck, 
  User, 
  AlertCircle, 
  Shield, 
  FileCheck, 
  CheckCircle2, 
  FileText, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Coffee, 
  LogOut, 
  CalendarDays, 
  Layers, 
  ArrowRight,
  Send,
  Eye,
  Check
} from 'lucide-react';
import { calculateHaversineDistance } from '../utils/geo';
import { 
  formatNumber, 
  getTodayDateString, 
  getCurrentTimeString, 
  isLateCheckIn, 
  isEarlyCheckOut 
} from '../utils/formatters';
import { 
  TeacherAttendanceEvent, 
  AttendanceStatus, 
  Teacher, 
  AttendanceSchedule, 
  TeacherLeaveApplication, 
  LeaveType, 
  LeaveScope 
} from '../types';
import { 
  timeStringToMinutes, 
  minutesToDurationString, 
  checkScheduleOverlap, 
  getApplicableSchedulesForTeacher, 
  buildAttendanceIntervals 
} from '../utils/scheduleAndIntervalHelper';
import { runAttendanceSentinel } from '../utils/attendanceSentinel';
import { logAudit } from '../utils/auditLogger';

export const TeacherAttendancePage: React.FC = () => {
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { currentUser, userProfile, isSuperAdmin, role } = useAuth();
  const isBn = language === 'bn';

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [todayEvents, setTodayEvents] = useState<TeacherAttendanceEvent[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Schedules State
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<AttendanceSchedule | null>(null);
  const [scheduleOverlapWarning, setScheduleOverlapWarning] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    startTime: '08:30',
    endTime: '11:30',
    graceMinutes: 15,
    autoCheckoutWaitingMinutes: 30,
    applicableDays: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    targetType: 'all' as 'all' | 'selected',
    assignedTeacherIds: [] as string[]
  });

  // Leave Management State
  const [leaveApplications, setLeaveApplications] = useState<TeacherLeaveApplication[]>([]);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState<boolean>(false);
  const [showGrantLeaveModal, setShowGrantLeaveModal] = useState<boolean>(false);
  const [showLeaveApprovalsModal, setShowLeaveApprovalsModal] = useState<boolean>(false);
  const [leaveFilterStatus, setLeaveFilterStatus] = useState<string>('all');
  const [rejectingApp, setRejectingApp] = useState<TeacherLeaveApplication | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState<string>('');

  // Leave Application Form (Teacher)
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'illness' as LeaveType,
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    scope: 'full_day' as LeaveScope,
    targetScheduleId: '',
    reason: '', // Mandatory
    supportingDocUrl: ''
  });

  // Direct Leave Grant Form (Admin/Principal)
  const [grantLeaveForm, setGrantLeaveForm] = useState({
    teacherId: '',
    leaveType: 'personal' as LeaveType,
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    scope: 'full_day' as LeaveScope,
    targetScheduleId: '',
    reason: '', // Mandatory
    remarks: ''
  });

  const isAdminOrSuperAdmin = isSuperAdmin || role === 'admin' || role === 'principal';

  // Find linked teacher profile for logged-in user
  const myLinkedTeacher = teachersList.find(t => 
    (currentUser?.uid && t.userId === currentUser.uid) || 
    (userProfile?.teacherId && t.teacherId === userProfile.teacherId)
  );

  // 1. Real-time listeners for Teachers, Schedules, Events, and Leaves
  useEffect(() => {
    // Teachers Listener
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snap) => {
      const list: Teacher[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Teacher));
      list.sort((a, b) => a.teacherId.localeCompare(b.teacherId));
      setTeachersList(list);

      if (!isAdminOrSuperAdmin) {
        const found = list.find(t => 
          (currentUser?.uid && t.userId === currentUser.uid) || 
          (userProfile?.teacherId && t.teacherId === userProfile.teacherId)
        );
        if (found) {
          setSelectedTeacherId(found.teacherId);
        }
      } else if (list.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(list[0].teacherId);
      }
    });

    // Schedules Listener
    const unsubSchedules = onSnapshot(collection(db, 'attendance_schedules'), (snap) => {
      const sList: AttendanceSchedule[] = [];
      snap.forEach(d => sList.push({ id: d.id, ...d.data() } as AttendanceSchedule));
      setSchedules(sList);
    });

    // Today's Attendance Events Listener
    const today = getTodayDateString();
    const qEvents = query(collection(db, 'teacher_attendance_events'), where('date', '==', today));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      const eList: TeacherAttendanceEvent[] = [];
      snap.forEach(d => eList.push({ id: d.id, ...d.data() } as TeacherAttendanceEvent));
      eList.sort((a, b) => (b.time > a.time ? 1 : -1));
      setTodayEvents(eList);
    });

    // Leave Applications Listener
    const unsubLeaves = onSnapshot(collection(db, 'teacher_leave_applications'), (snap) => {
      const lList: TeacherLeaveApplication[] = [];
      snap.forEach(d => lList.push({ id: d.id, ...d.data() } as TeacherLeaveApplication));
      lList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setLeaveApplications(lList);
    });

    return () => {
      unsubTeachers();
      unsubSchedules();
      unsubEvents();
      unsubLeaves();
    };
  }, [currentUser, userProfile, isAdminOrSuperAdmin]);

  // Run Sentinel periodically
  useEffect(() => {
    if (settings) {
      runAttendanceSentinel(settings);
    }
  }, [settings]);

  // Request GPS Location
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

  // Target teacher identification
  const effectiveTeacher = !isAdminOrSuperAdmin ? myLinkedTeacher : teachersList.find(t => t.teacherId === selectedTeacherId);
  const targetTeacherId = effectiveTeacher?.teacherId || '';

  // Today's events for target teacher
  const todayTargetEvents = todayEvents.filter(e => e.teacherId === targetTeacherId);

  // Applicable schedules for target teacher today
  const todayStr = getTodayDateString();
  const applicableSchedules = getApplicableSchedulesForTeacher(
    targetTeacherId,
    todayStr,
    schedules,
    settings
  );

  // Build daily intervals timeline
  const { 
    intervals, 
    activeOpenInterval, 
    totalDurationMinutes, 
    totalOutsideMinutes 
  } = buildAttendanceIntervals(todayTargetEvents);

  const hasActiveInterval = Boolean(activeOpenInterval);

  // Check today's approved leave for target teacher
  const todayApprovedLeave = leaveApplications.find(l => 
    l.teacherId === targetTeacherId &&
    l.status === 'approved' &&
    l.startDate <= todayStr &&
    l.endDate >= todayStr
  );

  // Determine current active/next schedule session based on current time
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const currentOrNextSchedule = applicableSchedules.find(s => {
    const endM = timeStringToMinutes(s.endTime);
    return currentMinutes <= endM + (s.autoCheckoutWaitingMinutes || 30);
  }) || applicableSchedules[applicableSchedules.length - 1];

  // =========================================================================
  // ATTENDANCE SUBMISSION HANDLER (Check-in & Check-out)
  // =========================================================================
  const handleAttendance = async (eventType: 'check_in' | 'check_out', customExitType?: 'temporary' | 'final') => {
    setMessage(null);

    if (!effectiveTeacher) {
      setMessage({
        type: 'error',
        text: isBn 
          ? 'অননুমোদিত: আপনার অ্যাকাউন্টে শিক্ষক প্রোফাইল লিঙ্ক নেই।' 
          : 'Unauthorized: No teacher profile linked to your account.'
      });
      return;
    }

    // Geofence check for self-attendance
    if (!isAdminOrSuperAdmin) {
      if (!currentCoords || distance === null) {
        setMessage({ type: 'error', text: isBn ? 'প্রথমে জিপিএস লোকেশন লোড করুন।' : 'Please detect GPS location first.' });
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
    }

    const timeNow = getCurrentTimeString();

    // Attendance Rules (Requirement 1, 5, 6)
    if (eventType === 'check_in') {
      if (hasActiveInterval) {
        setMessage({
          type: 'warning',
          text: isBn
            ? `আপনার পূর্ববর্তী চেক-ইন সেশনটি এখনও খোলা রয়েছে (${activeOpenInterval?.checkIn.time})। অনুগ্রহ করে প্রথমে চেক-আউট সম্পন্ন করুন।`
            : `You already have an active open Check-in at ${activeOpenInterval?.checkIn.time}. Please Check-out first.`
        });
        return;
      }
    }

    if (eventType === 'check_out') {
      if (!hasActiveInterval) {
        setMessage({
          type: 'error',
          text: isBn
            ? 'কোনো সক্রিয় চেক-ইন রেকর্ড পাওয়া যায়নি! চেক-আউট করার পূর্বে অবশ্যই চেক-ইন সম্পন্ন করতে হবে।'
            : 'No active Check-in found. You must Check-in before checking out.'
        });
        return;
      }
    }

    // Determine target schedule session for this interval
    const assignedSched = currentOrNextSchedule || applicableSchedules[0];
    const schedName = assignedSched ? assignedSched.name : 'দৈনিক সেশন';
    const schedId = assignedSched ? assignedSched.id : 'default-general-schedule';

    // Calculate Late / Early Leave status
    let status: AttendanceStatus = 'present';
    if (eventType === 'check_in') {
      const late = isLateCheckIn(timeNow, assignedSched?.startTime || settings.dailyCheckInTime, assignedSched?.graceMinutes || settings.lateGraceMinutes);
      status = late ? 'late' : 'present';
    } else {
      const early = isEarlyCheckOut(timeNow, assignedSched?.endTime || settings.dailyCheckOutTime);
      status = early ? 'early_leave' : 'present';
    }

    setSubmitting(true);
    try {
      const isManualEntry = isAdminOrSuperAdmin && effectiveTeacher.userId !== currentUser?.uid;
      const intervalIdx = eventType === 'check_in' ? intervals.length + 1 : (activeOpenInterval?.checkIn.intervalIndex || 1);

      const newEvent: Omit<TeacherAttendanceEvent, 'id'> = {
        teacherId: effectiveTeacher.teacherId,
        teacherName: effectiveTeacher.fullName,
        teacherDocId: effectiveTeacher.id,
        teacherUid: effectiveTeacher.userId || undefined,
        date: todayStr,
        eventType,
        scheduleId: schedId,
        scheduleName: schedName,
        intervalIndex: intervalIdx,
        time: timeNow,
        timestamp: new Date().toISOString(),
        lat: currentCoords?.lat || 0,
        lng: currentCoords?.lng || 0,
        accuracy: accuracy || 0,
        distanceMeters: distance || 0,
        status,
        isWithinGeofence: distance !== null ? isWithinRadius : false,
        isManualEntry,
        recordedBy: isManualEntry ? (currentUser?.displayName || 'Admin') : undefined,
        recordedByUid: isManualEntry ? currentUser?.uid : undefined,
        recordedByRole: isManualEntry ? (role || 'admin') : undefined,
        notes: customExitType === 'temporary' 
          ? 'সাময়িক প্রস্থান (Temporary Departure)' 
          : isManualEntry 
          ? 'Admin Recorded / Manual Attendance' 
          : undefined
      };

      const docRef = await addDoc(collection(db, 'teacher_attendance_events'), newEvent);

      if (isManualEntry) {
        await logAudit({
          action: 'Admin Recorded Teacher Attendance',
          module: 'Teacher GPS Attendance',
          recordId: docRef.id,
          recordType: 'TeacherAttendanceEvent',
          performedBy: currentUser?.displayName || 'Admin',
          performedByRole: role || 'admin',
          performedByUid: currentUser?.uid,
          details: `অ্যাডমিন কর্তৃক শিক্ষক ${effectiveTeacher.fullName} (${effectiveTeacher.teacherId})-এর ${eventType === 'check_in' ? 'চেক-ইন' : 'চেক-আউট'} [${schedName}] এন্ট্রি করা হয়েছে।`
        });
      }

      setMessage({
        type: 'success',
        text: isBn
          ? `${effectiveTeacher.fullName} এর ${eventType === 'check_in' ? 'চেক-ইন' : 'চেক-আউট'} সফল হয়েছে! [${schedName}] (${status === 'late' ? 'বিলম্ব' : status === 'early_leave' ? 'আগে প্রস্থান' : 'অন-টাইম'})`
          : `${eventType === 'check_in' ? 'Check-in' : 'Check-out'} recorded for ${effectiveTeacher.fullName}! [${schedName}] Status: ${status}`
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: (isBn ? 'হাজিরা সংরক্ষণে ত্রুটি: ' : 'Attendance recording error: ') + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // LEAVE APPLICATION HANDLER (Requirement 6)
  // =========================================================================
  const handleSubmitLeaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTeacher) return;

    // MANDATORY REASON VALIDATION (Requirement 6)
    if (!leaveForm.reason.trim() || leaveForm.reason.trim().length < 5) {
      alert(isBn ? 'ছুটির কারণ বিস্তারিতভাবে লেখা বাধ্যতামূলক! অনুগ্রহ করে উপযুক্ত কারণ লিখুন।' : 'Leave reason is mandatory! Please explain in detail.');
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const leaveTypeNames: Record<string, string> = {
        illness: 'অসুস্থতা / Illness',
        personal: 'ব্যক্তিগত ছুটি / Personal',
        family_emergency: 'পারিবারিক জরুরি প্রয়োজন / Emergency',
        medical: 'চিকিৎসাজনিত ছুটি / Medical',
        other: 'অন্যান্য / Other'
      };

      const newApp: Omit<TeacherLeaveApplication, 'id'> = {
        teacherId: effectiveTeacher.teacherId,
        teacherName: effectiveTeacher.fullName,
        teacherDocId: effectiveTeacher.id,
        teacherUid: currentUser?.uid || '',
        leaveType: leaveForm.leaveType,
        leaveTypeName: leaveTypeNames[leaveForm.leaveType] || leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        scope: leaveForm.scope,
        targetScheduleId: leaveForm.targetScheduleId || undefined,
        reason: leaveForm.reason.trim(),
        supportingDocUrl: leaveForm.supportingDocUrl.trim() || undefined,
        status: 'pending',
        appliedAt: nowIso,
        createdAt: nowIso
      };

      const docRef = await addDoc(collection(db, 'teacher_leave_applications'), newApp);

      // Notify Admins
      await addDoc(collection(db, 'notifications'), {
        title: `নতুন ছুটির আবেদন: ${effectiveTeacher.fullName}`,
        message: `${effectiveTeacher.fullName} (${effectiveTeacher.teacherId}) ${leaveForm.startDate} থেকে ${leaveForm.endDate} পর্যন্ত ছুটির আবেদন করেছেন। কারণ: ${leaveForm.reason.trim().slice(0, 50)}...`,
        type: 'approval_request',
        linkPage: 'teacherAttendance',
        targetRole: ['admin', 'principal'],
        read: false,
        createdAt: nowIso
      });

      // Audit Log
      await logAudit({
        action: 'Leave Application Submitted',
        module: 'Teacher GPS Attendance',
        recordId: docRef.id,
        recordType: 'TeacherLeaveApplication',
        performedBy: effectiveTeacher.fullName,
        performedByRole: 'teacher',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক ${effectiveTeacher.fullName} (${effectiveTeacher.teacherId}) ছুটির আবেদন দাখিল করেছেন। কারণ: ${leaveForm.reason.trim()}`
      });

      setShowApplyLeaveModal(false);
      setLeaveForm({
        leaveType: 'illness',
        startDate: getTodayDateString(),
        endDate: getTodayDateString(),
        scope: 'full_day',
        targetScheduleId: '',
        reason: '',
        supportingDocUrl: ''
      });
      setMessage({
        type: 'success',
        text: isBn ? 'আপনার ছুটির আবেদনটি সফলভাবে দাখিল হয়েছে। কর্তৃপক্ষের সিদ্ধান্তের জন্য অপেক্ষা করুন।' : 'Leave application submitted successfully.'
      });
    } catch (err: any) {
      alert((isBn ? 'আবেদন দাখিলে সমস্যা: ' : 'Failed to submit leave: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // DIRECT LEAVE GRANT BY ADMIN (Requirement 7)
  // =========================================================================
  const handleDirectGrantLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrSuperAdmin) return;

    if (!grantLeaveForm.teacherId) {
      alert(isBn ? 'শিক্ষক নির্বাচন করুন।' : 'Please select a teacher.');
      return;
    }

    // MANDATORY REASON VALIDATION FOR ADMIN DIRECT GRANT
    if (!grantLeaveForm.reason.trim() || grantLeaveForm.reason.trim().length < 5) {
      alert(isBn ? 'ছুটি প্রদানের কারণ বিস্তারিতভাবে লেখা বাধ্যতামূলক!' : 'Reason for granting leave is mandatory!');
      return;
    }

    const tObj = teachersList.find(t => t.teacherId === grantLeaveForm.teacherId);
    if (!tObj) return;

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const leaveTypeNames: Record<string, string> = {
        illness: 'অসুস্থতা / Illness',
        personal: 'ব্যক্তিগত ছুটি / Personal',
        family_emergency: 'পারিবারিক জরুরি প্রয়োজন / Emergency',
        medical: 'চিকিৎসাজনিত ছুটি / Medical',
        other: 'অন্যান্য / Other'
      };

      const grantedApp: Omit<TeacherLeaveApplication, 'id'> = {
        teacherId: tObj.teacherId,
        teacherName: tObj.fullName,
        teacherDocId: tObj.id,
        teacherUid: tObj.userId || '',
        leaveType: grantLeaveForm.leaveType,
        leaveTypeName: leaveTypeNames[grantLeaveForm.leaveType] || grantLeaveForm.leaveType,
        startDate: grantLeaveForm.startDate,
        endDate: grantLeaveForm.endDate,
        scope: grantLeaveForm.scope,
        targetScheduleId: grantLeaveForm.targetScheduleId || undefined,
        reason: grantLeaveForm.reason.trim(), // Full Mandatory Reason Preserved
        status: 'approved', // Directly granted
        isDirectGrant: true,
        grantedBy: currentUser?.displayName || 'Admin',
        grantedByName: currentUser?.displayName || 'Authorized Approver',
        grantedAt: nowIso,
        reviewedBy: currentUser?.uid,
        reviewedByName: currentUser?.displayName || 'Admin',
        reviewedAt: nowIso,
        reviewRemarks: grantLeaveForm.remarks.trim() || 'কর্তৃপক্ষ কর্তৃক সরাসরি ছুটি মঞ্জুর করা হয়েছে।',
        appliedAt: nowIso,
        createdAt: nowIso
      };

      const docRef = await addDoc(collection(db, 'teacher_leave_applications'), grantedApp);

      // Notify Teacher
      if (tObj.userId) {
        await addDoc(collection(db, 'notifications'), {
          title: 'আপনাকে ছুটি মঞ্জুর করা হয়েছে',
          message: `সম্মানিত ${tObj.fullName}, কর্তৃপক্ষ আপনাকে ${grantLeaveForm.startDate} থেকে ${grantLeaveForm.endDate} পর্যন্ত ছুটি মঞ্জুর করেছেন। কারণ: ${grantLeaveForm.reason.trim()}`,
          type: 'approval_result',
          linkPage: 'teacherAttendance',
          targetUid: tObj.userId,
          read: false,
          createdAt: nowIso
        });
      }

      // Audit Log
      await logAudit({
        action: 'Teacher Leave Granted Directly by Admin',
        module: 'Teacher GPS Attendance',
        recordId: docRef.id,
        recordType: 'TeacherLeaveApplication',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `অ্যাডমিন কর্তৃক শিক্ষক ${tObj.fullName} (${tObj.teacherId})-কে ${grantLeaveForm.startDate} থেকে ${grantLeaveForm.endDate} ছুটি প্রদান। কারণ: ${grantLeaveForm.reason.trim()}`
      });

      setShowGrantLeaveModal(false);
      setGrantLeaveForm({
        teacherId: '',
        leaveType: 'personal',
        startDate: getTodayDateString(),
        endDate: getTodayDateString(),
        scope: 'full_day',
        targetScheduleId: '',
        reason: '',
        remarks: ''
      });
      setMessage({
        type: 'success',
        text: isBn ? `${tObj.fullName}-কে সফলভাবে ছুটি প্রদান করা হয়েছে।` : `Leave granted to ${tObj.fullName} successfully.`
      });
    } catch (err: any) {
      alert((isBn ? 'ছুটি প্রদানে সমস্যা: ' : 'Failed to grant leave: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // LEAVE APPROVAL / REJECTION WORKFLOW (Requirement 8)
  // =========================================================================
  const handleApproveLeave = async (app: TeacherLeaveApplication) => {
    if (!isAdminOrSuperAdmin) return;
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'teacher_leave_applications', app.id), {
        status: 'approved',
        reviewedBy: currentUser?.uid,
        reviewedByName: currentUser?.displayName || 'Authorized Approver',
        reviewedAt: nowIso,
        reviewRemarks: 'মাদরাসা কর্তৃপক্ষ কর্তৃক অনুমোদিত'
      });

      // Notify Teacher
      if (app.teacherUid) {
        await addDoc(collection(db, 'notifications'), {
          title: 'আপনার ছুটির আবেদন অনুমোদিত হয়েছে',
          message: `মুবারকবাদ! ${app.startDate} থেকে ${app.endDate} তারিখের আপনার ছুটির আবেদনটি অনুমোদিত হয়েছে।`,
          type: 'approval_result',
          linkPage: 'teacherAttendance',
          targetUid: app.teacherUid,
          read: false,
          createdAt: nowIso
        });
      }

      // Audit Log
      await logAudit({
        action: 'Leave Application Approved',
        module: 'Teacher GPS Attendance',
        recordId: app.id,
        recordType: 'TeacherLeaveApplication',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিক্ষক ${app.teacherName} (${app.teacherId})-এর ছুটির আবেদন অনুমোদন করা হয়েছে। মূল কারণ: ${app.reason}`
      });

      alert(isBn ? 'আবেদনটি সফলভাবে অনুমোদিত হয়েছে।' : 'Leave application approved.');
    } catch (err: any) {
      alert((isBn ? 'অনুমোদনে সমস্যা: ' : 'Approval error: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRejectLeave = async () => {
    if (!rejectingApp || !isAdminOrSuperAdmin) return;
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'teacher_leave_applications', rejectingApp.id), {
        status: 'rejected',
        reviewedBy: currentUser?.uid,
        reviewedByName: currentUser?.displayName || 'Authorized Approver',
        reviewedAt: nowIso,
        reviewRemarks: rejectionRemark.trim() || 'কর্তৃপক্ষের সিদ্ধান্ত অনুযায়ী গৃহীত হয়নি'
      });

      // Notify Teacher
      if (rejectingApp.teacherUid) {
        await addDoc(collection(db, 'notifications'), {
          title: 'ছুটির আবেদন সংক্রান্ত সিদ্ধান্ত',
          message: `${rejectingApp.startDate} তারিখের ছুটির আবেদনটি কর্তৃপক্ষ কর্তৃক গৃহীত হয়নি। কারণ: ${rejectionRemark.trim() || 'কর্তৃপক্ষের সিদ্ধান্ত'}`,
          type: 'approval_result',
          linkPage: 'teacherAttendance',
          targetUid: rejectingApp.teacherUid,
          read: false,
          createdAt: nowIso
        });
      }

      // Audit Log
      await logAudit({
        action: 'Leave Application Rejected',
        module: 'Teacher GPS Attendance',
        recordId: rejectingApp.id,
        recordType: 'TeacherLeaveApplication',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        reason: rejectionRemark.trim(),
        details: `শিক্ষক ${rejectingApp.teacherName} (${rejectingApp.teacherId})-এর ছুটির আবেদন বাতিল। মূল কারণ ছিল: ${rejectingApp.reason}`
      });

      setRejectingApp(null);
      setRejectionRemark('');
      alert(isBn ? 'আবেদনটি প্রত্যাখ্যান করা হয়েছে।' : 'Leave application rejected.');
    } catch (err: any) {
      alert((isBn ? 'প্রত্যাখ্যানে সমস্যা: ' : 'Rejection error: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // SCHEDULE MANAGEMENT HANDLER (Requirement 2 & 3)
  // =========================================================================
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrSuperAdmin) return;

    if (!scheduleForm.name.trim()) {
      alert(isBn ? 'শিডিউলের নাম প্রদান করুন।' : 'Please enter schedule name.');
      return;
    }

    // Check overlap
    const conflict = checkScheduleOverlap(
      scheduleForm,
      schedules,
      editingSchedule ? editingSchedule.id : undefined
    );

    if (conflict.hasConflict) {
      setScheduleOverlapWarning(
        isBn 
          ? `সতর্কতা: এই সময়সূচিটি '${conflict.conflictingName}' এর সাথে ওভারল্যাপ করছে! নিশ্চিত করুন যে উভয় সেশনের মধ্যে দ্বন্দ্ব নেই।`
          : `Warning: This schedule overlaps with '${conflict.conflictingName}'.`
      );
    } else {
      setScheduleOverlapWarning(null);
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const schedData: Omit<AttendanceSchedule, 'id'> = {
        name: scheduleForm.name.trim(),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        graceMinutes: Number(scheduleForm.graceMinutes) || 15,
        autoCheckoutWaitingMinutes: Number(scheduleForm.autoCheckoutWaitingMinutes) || 30,
        applicableDays: scheduleForm.applicableDays,
        targetType: scheduleForm.targetType,
        assignedTeacherIds: scheduleForm.targetType === 'selected' ? scheduleForm.assignedTeacherIds : [],
        assignedTeacherNames: scheduleForm.targetType === 'selected' 
          ? teachersList.filter(t => scheduleForm.assignedTeacherIds.includes(t.teacherId)).map(t => t.fullName)
          : [],
        isActive: true,
        createdAt: editingSchedule ? editingSchedule.createdAt : nowIso,
        updatedAt: nowIso
      };

      if (editingSchedule) {
        await updateDoc(doc(db, 'attendance_schedules', editingSchedule.id), schedData);
      } else {
        await addDoc(collection(db, 'attendance_schedules'), schedData);
      }

      await logAudit({
        action: editingSchedule ? 'Attendance Schedule Updated' : 'Attendance Schedule Created',
        module: 'Teacher GPS Attendance',
        recordId: editingSchedule ? editingSchedule.id : 'NewSchedule',
        recordType: 'AttendanceSchedule',
        performedBy: currentUser?.displayName || 'Admin',
        performedByRole: role || 'admin',
        performedByUid: currentUser?.uid,
        details: `শিডিউল '${schedData.name}' (${schedData.startTime}-${schedData.endTime}) [${schedData.targetType}] সেভ করা হয়েছে।`
      });

      setShowScheduleModal(false);
      setEditingSchedule(null);
      setScheduleForm({
        name: '',
        startTime: '08:30',
        endTime: '11:30',
        graceMinutes: 15,
        autoCheckoutWaitingMinutes: 30,
        applicableDays: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        targetType: 'all',
        assignedTeacherIds: []
      });
      setScheduleOverlapWarning(null);
    } catch (err: any) {
      alert((isBn ? 'শিডিউল সংরক্ষণে ত্রুটি: ' : 'Error saving schedule: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleScheduleActive = async (sched: AttendanceSchedule) => {
    try {
      await updateDoc(doc(db, 'attendance_schedules', sched.id), {
        isActive: !sched.isActive,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDeleteSchedule = async (sched: AttendanceSchedule) => {
    if (!window.confirm(isBn ? `'${sched.name}' শিডিউলটি মুছে ফেলতে চান? পূর্ববর্তী হাজিরার ইতিহাস বহাল থাকবে।` : `Delete schedule '${sched.name}'? Historical records will be preserved.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'attendance_schedules', sched.id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6 font-bengali">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>{isBn ? "শিক্ষক জিপিএস হাজিরা ও শিডিউল টাইমলাইন" : "Teacher GPS Attendance & Schedules"}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn 
              ? "একাধিক সেশন, সাময়িক প্রস্থান ও পুনরাগমন ইন্টারভাল, ব্যক্তিগত শিডিউল এবং সরাসরি ছুটির আবেদন ব্যবস্থা"
              : "Multiple sessions, repeat intervals, individual schedules, and integrated leave system."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Apply Leave Button (Always available for Teachers and Admins) */}
          <button
            type="button"
            onClick={() => setShowApplyLeaveModal(true)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <CalendarDays className="w-4 h-4" />
            <span>{isBn ? "ছুটির আবেদন করুন" : "Apply for Leave"}</span>
          </button>

          {/* Admin Specific Action Buttons */}
          {isAdminOrSuperAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowGrantLeaveModal(true)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isBn ? "শিক্ষককে ছুটি প্রদান" : "Grant Leave"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLeaveApprovalsModal(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>{isBn ? "ছুটির আবেদনসমূহ" : "Leave Requests"}</span>
                {leaveApplications.filter(l => l.status === 'pending').length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-blue-700 text-[10px] font-black flex items-center justify-center animate-pulse">
                    {leaveApplications.filter(l => l.status === 'pending').length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSchedule(null);
                  setShowScheduleModal(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isBn ? "শিডিউল কনফিগারেশন" : "Schedules"}</span>
              </button>
            </>
          )}

          <button
            onClick={requestLocation}
            disabled={locating}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition"
            title={isBn ? "জিপিএস রিফ্রেশ" : "Refresh GPS"}
          >
            <RotateCw className={`w-3.5 h-3.5 ${locating ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* APPROVED LEAVE BANNER FOR TODAY (If teacher is on approved leave today) */}
      {todayApprovedLeave && (
        <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 rounded-2xl border border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm font-bold text-emerald-950">
                  {isBn ? "আজকের দিনে আপনার অনুমোদিত ছুটি রয়েছে" : "You have approved leave today"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                  {isBn ? "ছুটি (LEAVE)" : "APPROVED LEAVE"}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                <b>{isBn ? "ছুটির ধরন:" : "Type:"}</b> {todayApprovedLeave.leaveTypeName || todayApprovedLeave.leaveType} • <b>{isBn ? "মেয়াদ:" : "Duration:"}</b> {todayApprovedLeave.startDate} থেকে {todayApprovedLeave.endDate} ({todayApprovedLeave.scope})
              </p>
              <p className="text-xs text-slate-700 bg-white/80 p-2 rounded-lg border border-emerald-200 mt-1">
                <span className="font-bold text-emerald-900">{isBn ? "ছুটির কারণ: " : "Reason: "}</span>
                {todayApprovedLeave.reason}
              </p>
            </div>
          </div>
          <div className="text-[11px] text-emerald-800 shrink-0 font-medium sm:text-right">
            <div>{isBn ? "অনুমোদনকারী:" : "Approved by:"} {todayApprovedLeave.grantedByName || todayApprovedLeave.reviewedByName || "Admin"}</div>
            <div className="text-[10px] text-emerald-600">{todayApprovedLeave.grantedAt || todayApprovedLeave.reviewedAt ? new Date(todayApprovedLeave.grantedAt || todayApprovedLeave.reviewedAt || '').toLocaleDateString() : ''}</div>
          </div>
        </div>
      )}

      {/* Geofence & Shift Schedule Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Live GPS Coordinates and Geofence */}
        <div className={`p-4 rounded-2xl border ${isWithinRadius ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'} md:col-span-2`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                {isWithinRadius ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h3 className="font-bold text-sm text-slate-900">
                  {isWithinRadius ? (isBn ? "মাদরাসা ক্যাম্পাসের ভেতরে অবস্থিত" : "Inside Madrasa Geofence") : (isBn ? "মাদরাসা ক্যাম্পাসের বাইরে অবস্থিত" : "Outside Madrasa Geofence")}
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

        {/* Assigned Shift Timings for Today */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{isBn ? "আজকের নির্ধারিত সেশনসমূহ" : "Assigned Sessions"}</span>
            </h4>
            <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
              {applicableSchedules.length} {isBn ? "টি সেশন" : "Sessions"}
            </span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {applicableSchedules.map((s, idx) => {
              const isCurrent = currentOrNextSchedule?.id === s.id;
              return (
                <div 
                  key={s.id} 
                  className={`p-2 rounded-xl border flex items-center justify-between transition ${
                    isCurrent ? 'bg-blue-50/70 border-blue-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center space-x-1">
                      <span>{s.name}</span>
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {s.startTime} – {s.endTime} (+{s.graceMinutes}m grace)
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Attendance Interaction Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <span>{isBn ? "উপস্থিতি চেক-ইন / চেক-আউট কন্ট্রোল" : "Attendance Entry Controls"}</span>
          </h3>
          {isAdminOrSuperAdmin && (
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
              {isBn ? "প্রশাসনিক মোড (Admin Manual Mode)" : "Admin Manual Mode"}
            </span>
          )}
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center space-x-2 animate-fadeIn ${
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

        {/* 1. TEACHER STRICT SELF-IDENTIFICATION OR ADMIN SELECTOR */}
        {!isAdminOrSuperAdmin ? (
          <div>
            {myLinkedTeacher ? (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/40 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                    {myLinkedTeacher.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-slate-900">{myLinkedTeacher.fullName}</h4>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300">
                        {myLinkedTeacher.teacherId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {myLinkedTeacher.designation} {myLinkedTeacher.department ? `• ${myLinkedTeacher.department}` : ''}
                    </p>
                    <div className="flex items-center space-x-1.5 text-[11px] text-emerald-700 font-semibold mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isBn ? "স্বীকৃত ও লিঙ্কড শিক্ষক অ্যাকাউন্ট" : "Authenticated & Linked Teacher"}</span>
                    </div>
                  </div>
                </div>

                {/* Status Capsule */}
                <div className="bg-white/90 p-3 rounded-xl border border-blue-100 text-xs space-y-1 sm:text-right">
                  <div className="text-slate-500 font-medium">{isBn ? "বর্তমান হাজিরা অবস্থা:" : "Current Status:"}</div>
                  <div className="font-bold">
                    {hasActiveInterval ? (
                      <span className="text-amber-700 font-bold flex items-center sm:justify-end space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        <span>{isBn ? `সেশন সক্রিয় (চেক-ইন: ${activeOpenInterval?.checkIn.time})` : `Checked In (${activeOpenInterval?.checkIn.time})`}</span>
                      </span>
                    ) : intervals.length > 0 ? (
                      <span className="text-blue-700 font-bold flex items-center sm:justify-end space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isBn ? `${intervals.length}টি ইন্টারভাল সম্পন্ন (পুনরায় চেক-ইন সম্ভব)` : `${intervals.length} interval(s) closed`}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500">{isBn ? "আজ এখনও চেক-ইন করেননি" : "Not Checked-In Yet"}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-sm text-rose-900">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <span>{isBn ? "শিক্ষক প্রোফাইল লিংকিং প্রয়োজন" : "Teacher Profile Linking Required"}</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-700">
                  {isBn
                    ? "আপনার অ্যাকাউন্টটি অনুমোদিত হলেও কোনো শিক্ষক প্রোফাইলের সাথে লিঙ্ক করা নেই। জিপিএস হাজিরা দিতে হলে মাদরাসা অ্যাডমিনের মাধ্যমে শিক্ষক প্রোফাইল লিঙ্ক সম্পন্ন করুন।"
                    : "No teacher profile linked. Please contact admin to link your teacher profile."}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>{isBn ? "শিক্ষক নির্বাচন করুন (Admin Manual Entry)" : "Select Teacher"}</span>
              </label>
              <span className="text-[10px] text-purple-700 font-mono">
                {isBn ? `মোট শিক্ষক: ${teachersList.length} জন` : `Total: ${teachersList.length}`}
              </span>
            </div>

            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium"
            >
              {teachersList.map(item => (
                <option key={item.id} value={item.teacherId}>
                  {item.fullName} ({item.teacherId}) - {item.designation} {item.userId ? '✓' : '⚠'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Action Buttons: Multiple Check-in & Check-out intervals */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          {/* Check-In Button: Enabled when NO open interval exists */}
          <button
            onClick={() => handleAttendance('check_in')}
            disabled={submitting || hasActiveInterval || (!isAdminOrSuperAdmin && (!effectiveTeacher || !isWithinRadius))}
            className="w-full sm:flex-1 flex items-center justify-center space-x-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition disabled:cursor-not-allowed"
          >
            <Navigation className="w-4 h-4" />
            <span>
              {hasActiveInterval
                ? (isBn ? "ইতিমধ্যে চেক-ইন সক্রিয় রয়েছে" : "Already Checked In")
                : intervals.length > 0
                ? (isBn ? "পুনরায় চেক-ইন করুন (Return Check-In)" : "Return / Next Session Check-In")
                : (isBn ? "হাজিরা চেক-ইন করুন (Check-In)" : "Check-In")}
            </span>
          </button>

          {/* Check-Out Button: Enabled only when an open interval exists */}
          <button
            onClick={() => handleAttendance('check_out', 'final')}
            disabled={submitting || !hasActiveInterval || (!isAdminOrSuperAdmin && (!effectiveTeacher || !isWithinRadius))}
            className="w-full sm:flex-1 flex items-center justify-center space-x-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isBn ? "চেক-আউট সম্পন্ন করুন (Check-Out)" : "Check-Out"}</span>
          </button>

          {/* Quick Temporary Exit Check-Out Button (Requirement 5) */}
          {hasActiveInterval && (
            <button
              onClick={() => handleAttendance('check_out', 'temporary')}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              title={isBn ? "জরুরি কাজ বা বিরতিতে সাময়িক প্রস্থান" : "Temporary exit"}
            >
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>{isBn ? "সাময়িক প্রস্থান" : "Temporary Exit"}</span>
            </button>
          )}
        </div>
      </div>

      {/* TODAY'S ATTENDANCE TIMELINE & INTERVALS (Requirement 1, 4, 5) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span>{isBn ? "আজকের উপস্থিতির টাইমলাইন ও ইন্টারভাল (Daily Attendance Timeline)" : "Today's Attendance Timeline"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn 
                ? "একাধিক সেশনের চেক-ইন ও চেক-আউট ইন্টারভাল, ক্যাম্পাসে উপস্থিতির সময় এবং বাইরে কাটানো সময়ের সঠিক হিসাব"
                : "Continuous intervals of attendance sessions, duration inside, and time outside."}
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs font-bold">
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {isBn ? "মোট উপস্থিতি:" : "Total Time Inside:"} {minutesToDurationString(totalDurationMinutes, isBn)}
            </span>
            {totalOutsideMinutes > 0 && (
              <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                {isBn ? "বাইরে কাটানো:" : "Time Outside:"} {minutesToDurationString(totalOutsideMinutes, isBn)}
              </span>
            )}
          </div>
        </div>

        {intervals.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            {isBn ? "আজকের দিনে এখনও কোনো চেক-ইন রেকর্ড নেই।" : "No attendance intervals recorded today."}
          </div>
        ) : (
          <div className="space-y-3">
            {intervals.map((inv, idx) => (
              <div 
                key={idx} 
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  inv.isOpen ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    inv.isOpen ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center space-x-2">
                      <span>{inv.checkIn.scheduleName || (isBn ? 'সেশন' : 'Session')}</span>
                      <span className="font-mono text-[10px] text-slate-500 font-semibold">
                        (ইন্টারভাল #{inv.checkIn.intervalIndex || (idx + 1)})
                      </span>
                      {inv.isOpen && (
                        <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-bold animate-pulse">
                          {isBn ? "চলমান" : "ACTIVE"}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        <b>{isBn ? "চেক-ইন:" : "Check-in:"}</b> {inv.checkIn.time}
                      </span>
                      <span>
                        <b>{isBn ? "চেক-আউট:" : "Check-out:"}</b> {inv.checkOut ? inv.checkOut.time : (isBn ? 'চলমান...' : 'In progress...')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-auto text-xs">
                  {inv.checkOut ? (
                    <span className="font-mono font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-[11px]">
                      ⏱ {minutesToDurationString(inv.durationMinutes || 0, isBn)}
                    </span>
                  ) : (
                    <span className="font-bold text-amber-800 bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-[11px]">
                      {isBn ? "সেশন খোলা আছে" : "Active Open Interval"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TODAY'S RAW ATTENDANCE EVENTS LOG */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>{isBn ? "আজকের সকল ইভেন্ট লগ" : "Today's Attendance Events"} ({formatNumber(getTodayDateString(), isBn)})</span>
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {isBn ? `মোট ইভেন্ট: ${todayTargetEvents.length}` : `Events: ${todayTargetEvents.length}`}
          </span>
        </div>

        {todayTargetEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            {t.emptyStateMsg}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">{isBn ? "সেশন" : "Session"}</th>
                  <th className="py-2.5 px-4">{t.event}</th>
                  <th className="py-2.5 px-4">{t.time}</th>
                  <th className="py-2.5 px-4">{t.measuredDistance}</th>
                  <th className="py-2.5 px-4">{t.status}</th>
                  <th className="py-2.5 px-4">{isBn ? "রেকর্ড পদ্ধতি ও মন্তব্য" : "Method & Notes"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayTargetEvents.map((ev, idx) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-4 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      <div>{ev.scheduleName || 'দৈনিক সেশন'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ইন্টারভাল #{ev.intervalIndex || 1}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.eventType === 'check_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {ev.eventType === 'check_in' ? (isBn ? 'চেক-ইন' : 'Check In') : (isBn ? 'চেক-আউট' : 'Check Out')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{formatNumber(ev.time, isBn)}</td>
                    <td className="py-2.5 px-4 font-mono">
                      {ev.isAutoCheckout ? (
                        <span className="text-slate-400 text-[10px] italic">{isBn ? "জিপিএস প্রযোজ্য নয়" : "GPS N/A"}</span>
                      ) : (
                        <span>{formatNumber(ev.distanceMeters, isBn)} মি.</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ev.status === 'late' ? 'bg-amber-100 text-amber-800' :
                        ev.status === 'early_leave' ? 'bg-orange-100 text-orange-800' :
                        ev.status === 'auto_checkout' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        ev.status === 'missed_checkout' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {ev.status === 'late' ? t.late :
                         ev.status === 'early_leave' ? t.earlyLeave :
                         ev.status === 'auto_checkout' ? (isBn ? 'অটো চেক-আউট' : 'Auto Check-Out') :
                         ev.status === 'missed_checkout' ? (isBn ? 'মিসড চেক-আউট' : 'Missed Check-Out') :
                         t.onTime}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-xs truncate" title={ev.notes || ev.autoCheckoutReason || ''}>
                      {ev.isAutoCheckout ? (
                        <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                          {isBn ? "সিস্টেম অটো" : "Auto System"}
                        </span>
                      ) : ev.isManualEntry ? (
                        <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                          {isBn ? `অ্যাডমিন: ${ev.recordedBy || 'Admin'}` : `Admin: ${ev.recordedBy}`}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                          {isBn ? "সেলফ জিপিএস" : "Self GPS"}
                        </span>
                      )}
                      {ev.notes && <span className="ml-1.5 text-slate-600">{ev.notes}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TEACHER LEAVE APPLICATION MODAL (Requirement 6)                  */}
      {/* ========================================================================= */}
      {showApplyLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <CalendarDays className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">
                  {isBn ? "ছুটির আবেদন ফরম (Leave Application)" : "Apply for Leave"}
                </h3>
              </div>
              <button 
                onClick={() => setShowApplyLeaveModal(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLeaveApplication} className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isBn ? "ছুটির ধরন (Leave Type) *" : "Leave Type *"}
                </label>
                <select
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as LeaveType })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                  required
                >
                  <option value="illness">{isBn ? "অসুস্থতা (Illness)" : "Illness"}</option>
                  <option value="personal">{isBn ? "ব্যক্তিগত ছুটি (Personal)" : "Personal"}</option>
                  <option value="family_emergency">{isBn ? "পারিবারিক জরুরি প্রয়োজন (Family Emergency)" : "Family Emergency"}</option>
                  <option value="medical">{isBn ? "চিকিৎসাজনিত ছুটি (Medical Treatment)" : "Medical"}</option>
                  <option value="other">{isBn ? "অন্যান্য (Other - বিস্তারিত কারণ আবশ্যক)" : "Other"}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "আরম্ভের তারিখ (Start Date) *" : "Start Date *"}
                  </label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "সমাপ্তির তারিখ (End Date) *" : "End Date *"}
                  </label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? "ছুটির পরিধি (Leave Scope) *" : "Scope *"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'full_day', labelBn: 'সম্পূর্ণ দিন', labelEn: 'Full Day' },
                    { id: 'partial_day', labelBn: 'অর্ধ দিন', labelEn: 'Partial Day' },
                    { id: 'session', labelBn: 'নির্দিষ্ট সেশন', labelEn: 'Specific Session' }
                  ].map(sc => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, scope: sc.id as LeaveScope })}
                      className={`p-2 rounded-xl border text-center transition font-bold ${
                        leaveForm.scope === sc.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {isBn ? sc.labelBn : sc.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {leaveForm.scope === 'session' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "নির্দিষ্ট সেশন নির্বাচন করুন:" : "Target Session:"}
                  </label>
                  <select
                    value={leaveForm.targetScheduleId}
                    onChange={(e) => setLeaveForm({ ...leaveForm, targetScheduleId: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                    required
                  >
                    <option value="">{isBn ? "-- সেশন বেছে নিন --" : "-- Select Session --"}</option>
                    {applicableSchedules.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* MANDATORY LEAVE REASON (Requirement 6) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                  <span>{isBn ? "ছুটির কারণ বিস্তারিত লিখুন (Mandatory Reason) *" : "Explain the Reason for Leave *"}</span>
                  <span className="text-[10px] text-red-600 font-bold">{isBn ? "বাধ্যতামূলক" : "Required"}</span>
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder={isBn ? "ছুটি প্রয়োজন হওয়ার সুস্পষ্ট ও বিস্তারিত কারণ উল্লেখ করুন..." : "Explain detailed reason for leave..."}
                  rows={4}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {isBn ? "সহায়ক ডকুমেন্ট / লিঙ্ক / নোট (ঐচ্ছিক)" : "Supporting Document Link / Notes (Optional)"}
                </label>
                <input
                  type="text"
                  value={leaveForm.supportingDocUrl}
                  onChange={(e) => setLeaveForm({ ...leaveForm, supportingDocUrl: e.target.value })}
                  placeholder={isBn ? "যেমন: প্রেসক্রিপশন লিঙ্ক বা বিশেষ নোট..." : "E.g. Document drive link or note..."}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowApplyLeaveModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  {isBn ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? (isBn ? "দাখিল হচ্ছে..." : "Submitting...") : (isBn ? "আবেদন দাখিল করুন" : "Submit Application")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADMIN DIRECT LEAVE GRANT MODAL (Requirement 7)                   */}
      {/* ========================================================================= */}
      {showGrantLeaveModal && isAdminOrSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <PlusCircle className="w-5 h-5 text-purple-200" />
                <h3 className="font-bold text-base">
                  {isBn ? "শিক্ষককে সরাসরি ছুটি প্রদান (Grant Leave to Teacher)" : "Grant Leave Directly"}
                </h3>
              </div>
              <button 
                onClick={() => setShowGrantLeaveModal(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDirectGrantLeave} className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isBn ? "শিক্ষক নির্বাচন করুন (Select Teacher) *" : "Select Teacher *"}
                </label>
                <select
                  value={grantLeaveForm.teacherId}
                  onChange={(e) => setGrantLeaveForm({ ...grantLeaveForm, teacherId: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                  required
                >
                  <option value="">{isBn ? "-- শিক্ষক নির্বাচন করুন --" : "-- Select Teacher --"}</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.teacherId}>
                      {t.fullName} ({t.teacherId}) - {t.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isBn ? "ছুটির ধরন (Leave Type) *" : "Leave Type *"}
                </label>
                <select
                  value={grantLeaveForm.leaveType}
                  onChange={(e) => setGrantLeaveForm({ ...grantLeaveForm, leaveType: e.target.value as LeaveType })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                  required
                >
                  <option value="personal">{isBn ? "ব্যক্তিগত ছুটি (Personal)" : "Personal"}</option>
                  <option value="illness">{isBn ? "অসুস্থতা (Illness)" : "Illness"}</option>
                  <option value="family_emergency">{isBn ? "পারিবারিক জরুরি প্রয়োজন" : "Family Emergency"}</option>
                  <option value="medical">{isBn ? "চিকিৎসাজনিত ছুটি" : "Medical Treatment"}</option>
                  <option value="other">{isBn ? "অন্যান্য (Other)" : "Other"}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "আরম্ভের তারিখ *" : "Start Date *"}
                  </label>
                  <input
                    type="date"
                    value={grantLeaveForm.startDate}
                    onChange={(e) => setGrantLeaveForm({ ...grantLeaveForm, startDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "সমাপ্তির তারিখ *" : "End Date *"}
                  </label>
                  <input
                    type="date"
                    value={grantLeaveForm.endDate}
                    onChange={(e) => setGrantLeaveForm({ ...grantLeaveForm, endDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              {/* MANDATORY REASON FOR ADMIN DIRECT GRANT (Requirement 7) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                  <span>{isBn ? "ছুটি প্রদানের কারণ বিস্তারিত লিখুন (Mandatory Reason) *" : "Reason for Granting Leave *"}</span>
                  <span className="text-[10px] text-red-600 font-bold">{isBn ? "বাধ্যতামূলক" : "Required"}</span>
                </label>
                <textarea
                  value={grantLeaveForm.reason}
                  onChange={(e) => setGrantLeaveForm({ ...grantLeaveForm, reason: e.target.value })}
                  placeholder={isBn ? "শিক্ষককে ছুটি মঞ্জুর করার কারণ স্পষ্ট করে লিখুন..." : "Explain mandatory reason for granting leave..."}
                  rows={3}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {isBn ? "প্রশাসনিক মন্তব্য (ঐচ্ছিক)" : "Administrative Remarks (Optional)"}
                </label>
                <input
                  type="text"
                  value={grantLeaveForm.remarks}
                  onChange={(e) => setGrantLeaveForm({ ...grantLeaveForm, remarks: e.target.value })}
                  placeholder={isBn ? "অতিরিক্ত কোনো নির্দেশনা থাকলে লিখুন..." : "Optional approval remark..."}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowGrantLeaveModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  {isBn ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{submitting ? (isBn ? "সংরক্ষণ হচ্ছে..." : "Saving...") : (isBn ? "ছুটি মঞ্জুর করুন" : "Grant Leave")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LEAVE APPROVALS REVIEW WORKFLOW (Requirement 8)                  */}
      {/* ========================================================================= */}
      {showLeaveApprovalsModal && isAdminOrSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileCheck className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-base">
                  {isBn ? "শিক্ষকদের ছুটির আবেদন ও অনুমোদন পর্যালোচনা" : "Review Leave Applications"}
                </h3>
              </div>
              <button 
                onClick={() => setShowLeaveApprovalsModal(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Filter tabs */}
              <div className="flex items-center space-x-2 border-b pb-2">
                {['all', 'pending', 'approved', 'rejected'].map(st => (
                  <button
                    key={st}
                    onClick={() => setLeaveFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize transition ${
                      leaveFilterStatus === st ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st} ({leaveApplications.filter(l => st === 'all' || l.status === st).length})
                  </button>
                ))}
              </div>

              {leaveApplications.filter(l => leaveFilterStatus === 'all' || l.status === leaveFilterStatus).length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  {isBn ? "কোনো ছুটির আবেদন পাওয়া যায়নি।" : "No leave applications found."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leaveApplications
                    .filter(l => leaveFilterStatus === 'all' || l.status === leaveFilterStatus)
                    .map(app => (
                      <div key={app.id} className="py-3.5 space-y-2 hover:bg-slate-50/50 p-2 rounded-xl transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-sm text-slate-900">{app.teacherName}</h4>
                              <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-bold">
                                {app.teacherId}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                app.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800 animate-pulse'
                              }`}>
                                {app.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <b>{app.leaveTypeName || app.leaveType}</b> • {app.startDate} থেকে {app.endDate} ({app.scope})
                            </div>
                          </div>

                          {/* Approval Actions for Pending */}
                          {app.status === 'pending' && (
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleApproveLeave(app)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
                              >
                                {isBn ? "অনুমোদন করুন" : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                  setRejectingApp(app);
                                  setRejectionRemark('');
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg font-bold text-xs"
                              >
                                {isBn ? "প্রত্যাখ্যান" : "Reject"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* FULL MANDATORY LEAVE REASON PRESERVED (Requirement 6, 8) */}
                        <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/80 text-[11px] text-slate-800">
                          <span className="font-bold text-amber-950 block mb-0.5">{isBn ? "ছুটির মূল কারণ:" : "Original Reason:"}</span>
                          <p className="whitespace-pre-line text-slate-700">{app.reason}</p>
                        </div>

                        {app.reviewRemarks && (
                          <div className="text-[10px] text-slate-500">
                            <b>{isBn ? "সিদ্ধান্ত মন্তব্য:" : "Review Remarks:"}</b> {app.reviewRemarks} (দ্বারা: {app.reviewedByName || app.grantedByName || 'Admin'})
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REMARK DIALOG */}
      {rejectingApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 animate-scaleUp">
            <h4 className="font-bold text-slate-900 text-sm">{isBn ? "প্রত্যাখ্যানের কারণ লিখুন" : "Enter Rejection Reason"}</h4>
            <p className="text-xs text-slate-500">
              {rejectingApp.teacherName}-এর আবেদন প্রত্যাখ্যানের কারণ লিখুন। শিক্ষক নোটিফিকেশনে এটি দেখতে পাবেন।
            </p>
            <textarea
              value={rejectionRemark}
              onChange={(e) => setRejectionRemark(e.target.value)}
              placeholder={isBn ? "যেমন: পরীক্ষা চলাকালীন ছুটি গ্রহণযোগ্য নয়..." : "Reason..."}
              rows={3}
              className="w-full p-2 border rounded-xl text-xs"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingApp(null)}
                className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectLeave}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {isBn ? "প্রত্যাখ্যান নিশ্চিত করুন" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ATTENDANCE SCHEDULES MANAGEMENT (Requirement 2 & 3)              */}
      {/* ========================================================================= */}
      {showScheduleModal && isAdminOrSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">
                  {editingSchedule 
                    ? (isBn ? "শিডিউল সম্পাদনা (Edit Schedule)" : "Edit Schedule")
                    : (isBn ? "নতুন শিডিউল ও সেশন তৈরি (Create Schedule)" : "Create Schedule")}
                </h3>
              </div>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-5 sm:p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {scheduleOverlapWarning && (
                <div className="p-3 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{scheduleOverlapWarning}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isBn ? "শিডিউল বা সেশনের নাম (Schedule Name) *" : "Schedule Name *"}
                </label>
                <input
                  type="text"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  placeholder={isBn ? "যেমন: সকাল সেশন / হিফজ বিভাগ বিকেল সেশন / সান্ধ্য সেশন..." : "E.g. Morning Session / Evening Session"}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "সেশন শুরু (Start Time) *" : "Start Time *"}
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "সেশন সমাপ্ত (End Time) *" : "End Time *"}
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "বিলম্ব বিবেচনা গ্রেস পিরিয়ড (মিনিট)" : "Late Grace Period (Mins)"}
                  </label>
                  <input
                    type="number"
                    value={scheduleForm.graceMinutes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, graceMinutes: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "অটো চেক-আউট অতিরিক্ত অপেক্ষা (মিনিট)" : "Auto Check-Out Waiting (Mins)"}
                  </label>
                  <input
                    type="number"
                    value={scheduleForm.autoCheckoutWaitingMinutes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, autoCheckoutWaitingMinutes: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              {/* Applicable Days of the Week */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  {isBn ? "সপ্তাহের কার্যদিবস নির্বাচন করুন (Applicable Days) *" : "Applicable Days *"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'Saturday', bn: 'শনিবার' },
                    { id: 'Sunday', bn: 'রবিবার' },
                    { id: 'Monday', bn: 'সোমবার' },
                    { id: 'Tuesday', bn: 'মঙ্গলবার' },
                    { id: 'Wednesday', bn: 'বুধবার' },
                    { id: 'Thursday', bn: 'বৃহস্পতিবার' },
                    { id: 'Friday', bn: 'শুক্রবার' },
                  ].map(day => {
                    const isChecked = scheduleForm.applicableDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          const updated = isChecked 
                            ? scheduleForm.applicableDays.filter(d => d !== day.id)
                            : [...scheduleForm.applicableDays, day.id];
                          setScheduleForm({ ...scheduleForm, applicableDays: updated });
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition select-none ${
                          isChecked ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {isBn ? day.bn : day.id.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TARGET TYPE: ALL TEACHERS vs SELECTED TEACHERS (Requirement 3) */}
              <div className="space-y-2 pt-2 border-t">
                <label className="block text-xs font-bold text-slate-800">
                  {isBn ? "কাদের ওপর এই শিডিউল প্রযোজ্য হবে? (Schedule Assignment) *" : "Apply Schedule To: *"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, targetType: 'all' })}
                    className={`p-3 rounded-xl border text-left transition ${
                      scheduleForm.targetType === 'all' ? 'bg-blue-50 border-blue-400 font-bold text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{isBn ? "অপশন ক: সকল শিক্ষক" : "Option A: All Teachers"}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{isBn ? "প্রতিষ্ঠানের সকল শিক্ষককে এই সেশন প্রদান" : "Applies to all teachers"}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, targetType: 'selected' })}
                    className={`p-3 rounded-xl border text-left transition ${
                      scheduleForm.targetType === 'selected' ? 'bg-blue-50 border-blue-400 font-bold text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{isBn ? "অপশন খ: নির্দিষ্ট শিক্ষক" : "Option B: Selected Teachers"}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{isBn ? "কেবলমাত্র নির্বাচিত শিক্ষকদের এই সেশন বরাদ্দ" : "Applies only to selected teachers"}</div>
                  </button>
                </div>

                {scheduleForm.targetType === 'selected' && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      {isBn ? "যে যে শিক্ষক এই শিডিউল পাবেন তাদের সিলেক্ট করুন:" : "Select Teachers for this Schedule:"}
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {teachersList.map(t => {
                        const isSel = scheduleForm.assignedTeacherIds.includes(t.teacherId);
                        return (
                          <label key={t.id} className="flex items-center space-x-2 text-xs p-1 hover:bg-white rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => {
                                const updated = isSel 
                                  ? scheduleForm.assignedTeacherIds.filter(id => id !== t.teacherId)
                                  : [...scheduleForm.assignedTeacherIds, t.teacherId];
                                setScheduleForm({ ...scheduleForm, assignedTeacherIds: updated });
                              }}
                              className="rounded text-blue-600"
                            />
                            <span className="font-medium text-slate-900">{t.fullName}</span>
                            <span className="font-mono text-[10px] text-slate-400">({t.teacherId})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  {isBn ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isBn ? "শিডিউল সংরক্ষণ করুন" : "Save Schedule"}
                </button>
              </div>

              {/* Existing Schedules Management List inside modal */}
              {schedules.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">{isBn ? "বিদ্যমান সক্রিয় শিডিউলসমূহ" : "Existing Schedules"}</h4>
                  <div className="space-y-2">
                    {schedules.map(sc => (
                      <div key={sc.id} className="p-2.5 bg-slate-50 border rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center space-x-2">
                            <span>{sc.name}</span>
                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded font-mono">
                              {sc.startTime} - {sc.endTime}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              sc.targetType === 'all' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {sc.targetType === 'all' ? (isBn ? 'সকল শিক্ষক' : 'All') : `${sc.assignedTeacherIds?.length || 0} শিক্ষক`}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {sc.applicableDays.join(', ')}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleScheduleActive(sc)}
                            className={`px-2 py-1 text-[10px] font-bold rounded ${
                              sc.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {sc.isActive ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSchedule(sc);
                              setScheduleForm({
                                name: sc.name,
                                startTime: sc.startTime,
                                endTime: sc.endTime,
                                graceMinutes: sc.graceMinutes,
                                autoCheckoutWaitingMinutes: sc.autoCheckoutWaitingMinutes,
                                applicableDays: sc.applicableDays,
                                targetType: sc.targetType,
                                assignedTeacherIds: sc.assignedTeacherIds || []
                              });
                            }}
                            className="p-1 hover:bg-blue-50 text-blue-600 rounded"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(sc)}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
