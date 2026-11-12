import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { InstitutionSettings, TeacherAttendanceEvent, AttendanceSchedule } from '../types';
import { getTodayDateString, getCurrentTimeString } from './formatters';
import { timeStringToMinutes } from './scheduleAndIntervalHelper';
import { logAudit } from './auditLogger';

let isRunning = false;

/**
 * Robust sentinel service that checks open teacher attendance sessions today,
 * detects missed check-outs past scheduled checkout time,
 * and executes automatic check-outs past the configured waiting period per session.
 */
export const runAttendanceSentinel = async (settings: InstitutionSettings): Promise<{
  missedNotifiedCount: number;
  autoCheckedOutCount: number;
}> => {
  if (isRunning) return { missedNotifiedCount: 0, autoCheckedOutCount: 0 };
  isRunning = true;

  let missedNotifiedCount = 0;
  let autoCheckedOutCount = 0;

  try {
    const today = getTodayDateString();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Fetch schedules from Firestore
    const schedSnap = await getDocs(collection(db, 'attendance_schedules'));
    const schedulesMap = new Map<string, AttendanceSchedule>();
    schedSnap.forEach(d => {
      schedulesMap.set(d.id, { id: d.id, ...d.data() } as AttendanceSchedule);
    });

    // 2. Fetch all attendance events for today
    const q = query(
      collection(db, 'teacher_attendance_events'),
      where('date', '==', today)
    );
    const snap = await getDocs(q);
    const events: TeacherAttendanceEvent[] = [];
    snap.forEach(d => {
      events.push({ id: d.id, ...d.data() } as TeacherAttendanceEvent);
    });

    // Group events by teacherId
    const teacherEventsMap = new Map<string, TeacherAttendanceEvent[]>();
    events.forEach(ev => {
      const list = teacherEventsMap.get(ev.teacherId) || [];
      list.push(ev);
      teacherEventsMap.set(ev.teacherId, list);
    });

    for (const [teacherId, tEvents] of teacherEventsMap.entries()) {
      // Sort chronologically
      tEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      // Check if there is an active OPEN interval
      let currentOpenCheckIn: TeacherAttendanceEvent | null = null;
      for (const ev of tEvents) {
        if (ev.eventType === 'check_in') {
          if (!currentOpenCheckIn) {
            currentOpenCheckIn = ev;
          }
        } else if (ev.eventType === 'check_out') {
          currentOpenCheckIn = null;
        }
      }

      // If teacher has an open check-in
      if (currentOpenCheckIn) {
        // Determine the applicable schedule's scheduled end time and waiting period
        let scheduledCheckoutTime = settings.dailyCheckOutTime || "11:30";
        let waitingPeriod = Number(settings.autoCheckOutWaitingMinutes || 30);
        let scheduleName = currentOpenCheckIn.scheduleName || 'দৈনিক সেশন';

        if (currentOpenCheckIn.scheduleId && schedulesMap.has(currentOpenCheckIn.scheduleId)) {
          const matchedSched = schedulesMap.get(currentOpenCheckIn.scheduleId)!;
          scheduledCheckoutTime = matchedSched.endTime || scheduledCheckoutTime;
          waitingPeriod = Number(matchedSched.autoCheckoutWaitingMinutes || waitingPeriod);
          scheduleName = matchedSched.name || scheduleName;
        }

        const scheduledMinutes = timeStringToMinutes(scheduledCheckoutTime);
        const autoCutoffMinutes = scheduledMinutes + waitingPeriod;

        // 1. MISSED CHECK-OUT NOTIFICATION
        if (currentMinutes > scheduledMinutes && !currentOpenCheckIn.missedCheckoutNotified) {
          try {
            if (settings.missedCheckOutNotifyAdmin !== false) {
              await addDoc(collection(db, 'notifications'), {
                title: `মিসড চেক-আউট নোটিশ: ${currentOpenCheckIn.teacherName}`,
                message: `${currentOpenCheckIn.teacherName} (${currentOpenCheckIn.teacherId}) '${scheduleName}'-এ চেক-ইন করলেও নির্ধারিত প্রস্থান সময় ${scheduledCheckoutTime}-এ চেক-আউট সম্পন্ন করেননি।`,
                type: 'missed_checkout',
                linkPage: 'teacherAttendance',
                targetRole: ['admin', 'principal'],
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            if (settings.missedCheckOutNotifyTeacher !== false && currentOpenCheckIn.teacherUid) {
              await addDoc(collection(db, 'notifications'), {
                title: 'চেক-আউট রিমাইন্ডার নোটিশ',
                message: `সম্মানিত ${currentOpenCheckIn.teacherName}, আপনার আজকের '${scheduleName}' নির্ধারিত প্রস্থান সময় (${scheduledCheckoutTime}) অতিক্রম করেছে। অনুগ্রহ করে দ্রুত চেক-আউট সম্পন্ন করুন।`,
                type: 'missed_checkout',
                linkPage: 'teacherAttendance',
                targetUid: currentOpenCheckIn.teacherUid,
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            await updateDoc(doc(db, 'teacher_attendance_events', currentOpenCheckIn.id), {
              missedCheckoutNotified: true,
              updatedAt: new Date().toISOString()
            });

            missedNotifiedCount++;
          } catch (notifErr) {
            console.warn("Failed to dispatch missed checkout notification:", notifErr);
          }
        }

        // 2. AUTOMATIC CHECK-OUT
        if (settings.autoCheckOutEnabled !== false && currentMinutes >= autoCutoffMinutes) {
          try {
            const cutoffHours = Math.floor(autoCutoffMinutes / 60) % 24;
            const cutoffM = autoCutoffMinutes % 60;
            const cutoffTimeString = `${String(cutoffHours).padStart(2, '0')}:${String(cutoffM).padStart(2, '0')}:00`;

            const autoEventData: Omit<TeacherAttendanceEvent, 'id'> = {
              teacherId: currentOpenCheckIn.teacherId,
              teacherName: currentOpenCheckIn.teacherName,
              teacherDocId: currentOpenCheckIn.teacherDocId,
              teacherUid: currentOpenCheckIn.teacherUid,
              date: today,
              eventType: 'check_out',
              scheduleId: currentOpenCheckIn.scheduleId,
              scheduleName: currentOpenCheckIn.scheduleName,
              intervalIndex: currentOpenCheckIn.intervalIndex || 1,
              time: cutoffTimeString,
              timestamp: new Date().toISOString(),
              lat: 0,
              lng: 0,
              accuracy: 0,
              distanceMeters: 0,
              status: 'auto_checkout',
              isWithinGeofence: false,
              isAutoCheckout: true,
              autoCheckoutReason: `'${scheduleName}' প্রস্থান সময় ${scheduledCheckoutTime}-এর পর অতিরিক্ত ${waitingPeriod} মিনিট সময়সীমা পার হওয়ায় স্বয়ংক্রিয় চেক-আউট কার্যকর`,
              notes: 'সিস্টেম স্বয়ংক্রিয় চেক-আউট (Auto Check-out)। জিপিএস স্থানাঙ্ক অনুপলব্ধ।',
            };

            const autoDocRef = await addDoc(collection(db, 'teacher_attendance_events'), autoEventData);

            if (settings.autoCheckOutNotifyAdmin !== false) {
              await addDoc(collection(db, 'notifications'), {
                title: `অটো চেক-আউট কার্যকর: ${currentOpenCheckIn.teacherName}`,
                message: `${currentOpenCheckIn.teacherName} (${currentOpenCheckIn.teacherId})-এর '${scheduleName}' খোলা সেশনটি অতিরিক্ত ${waitingPeriod} মিনিট অপেক্ষার পর স্বয়ংক্রিয়ভাবে Auto Check-Out করা হয়েছে।`,
                type: 'auto_checkout',
                linkPage: 'teacherAttendance',
                targetRole: ['admin', 'principal'],
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            if (settings.autoCheckOutNotifyTeacher !== false && currentOpenCheckIn.teacherUid) {
              await addDoc(collection(db, 'notifications'), {
                title: 'অটো চেক-আউট সম্পন্ন হয়েছে',
                message: `সম্মানিত ${currentOpenCheckIn.teacherName}, আপনার আজকের '${scheduleName}' সেশনটি নির্ধারিত সময়সীমা উত্তীর্ণ হওয়ায় সিস্টেম কর্তৃক স্বয়ংক্রিয়ভাবে (${cutoffTimeString}) অটো চেক-আউট সম্পন্ন করা হয়েছে।`,
                type: 'auto_checkout',
                linkPage: 'teacherAttendance',
                targetUid: currentOpenCheckIn.teacherUid,
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            // Audit log
            await logAudit({
              action: 'Teacher Automatic Check-Out',
              module: 'Attendance & GPS Overrides',
              recordId: autoDocRef.id,
              recordType: 'TeacherAttendanceEvent',
              performedBy: 'System Auto-Checkout Sentinel',
              performedByRole: 'system',
              details: `শিক্ষক ${currentOpenCheckIn.teacherName} (${currentOpenCheckIn.teacherId})-এর '${scheduleName}' সময়সীমা পার হওয়ায় ${cutoffTimeString}-এ অটো চেক-আউট কার্যকর হয়েছে।`
            });

            autoCheckedOutCount++;
          } catch (autoErr) {
            console.warn("Failed to execute auto checkout:", autoErr);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Error running attendance sentinel:", err);
  } finally {
    isRunning = false;
  }

  return { missedNotifiedCount, autoCheckedOutCount };
};
