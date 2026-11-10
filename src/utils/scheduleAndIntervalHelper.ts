import { 
  AttendanceSchedule, 
  TeacherAttendanceEvent, 
  AttendanceInterval, 
  InstitutionSettings 
} from '../types';

/**
 * Convert "HH:mm" or "HH:mm:ss" to total minutes from midnight
 */
export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

/**
 * Format minutes into "X ঘণ্টা Y মিনিট" or "Xh Ym"
 */
export const minutesToDurationString = (minutes: number, isBn: boolean = true): string => {
  if (minutes <= 0) return isBn ? "০ মিনিট" : "0 mins";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) {
    return isBn ? `${m} মিনিট` : `${m} mins`;
  }
  if (m === 0) {
    return isBn ? `${h} ঘণ্টা` : `${h} hrs`;
  }
  return isBn ? `${h} ঘণ্টা ${m} মিনিট` : `${h}h ${m}m`;
};

/**
 * Get standard day name from YYYY-MM-DD
 */
export const getDayOfWeekName = (dateStr: string): string => {
  const d = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()] || 'Friday';
};

/**
 * Conflict/Overlap detector for schedules
 */
export const checkScheduleOverlap = (
  newSchedule: { 
    startTime: string; 
    endTime: string; 
    applicableDays: string[]; 
    targetType: string; 
    assignedTeacherIds?: string[] 
  },
  existingSchedules: AttendanceSchedule[],
  ignoreId?: string
): { hasConflict: boolean; conflictingName?: string } => {
  const newStart = timeStringToMinutes(newSchedule.startTime);
  const newEnd = timeStringToMinutes(newSchedule.endTime);

  for (const ex of existingSchedules) {
    if (ignoreId && ex.id === ignoreId) continue;
    if (!ex.isActive) continue;

    // Check if applicable days overlap
    const daysOverlap = newSchedule.applicableDays.some(d => ex.applicableDays.includes(d));
    if (!daysOverlap) continue;

    // Check if assigned teachers overlap
    let teachersOverlap = false;
    if (newSchedule.targetType === 'all' || ex.targetType === 'all') {
      teachersOverlap = true;
    } else {
      const newIds = newSchedule.assignedTeacherIds || [];
      const exIds = ex.assignedTeacherIds || [];
      teachersOverlap = newIds.some(id => exIds.includes(id));
    }
    if (!teachersOverlap) continue;

    // Check time range overlap: max(start1, start2) < min(end1, end2)
    const exStart = timeStringToMinutes(ex.startTime);
    const exEnd = timeStringToMinutes(ex.endTime);

    if (Math.max(newStart, exStart) < Math.min(newEnd, exEnd)) {
      return { hasConflict: true, conflictingName: ex.name };
    }
  }

  return { hasConflict: false };
};

/**
 * Get all active schedules assigned to a teacher on a given date
 */
export const getApplicableSchedulesForTeacher = (
  teacherId: string,
  dateStr: string,
  schedules: AttendanceSchedule[],
  settings?: InstitutionSettings
): AttendanceSchedule[] => {
  const dayName = getDayOfWeekName(dateStr);
  
  const matches = schedules.filter(s => {
    if (!s.isActive) return false;
    if (!s.applicableDays.includes(dayName)) return false;
    if (s.targetType === 'all') return true;
    return (s.assignedTeacherIds || []).includes(teacherId);
  });

  matches.sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));

  // Fallback to general institution schedule if no custom schedules matched
  if (matches.length === 0 && settings) {
    return [{
      id: 'default-general-schedule',
      name: 'সাধারণ প্রাতিষ্ঠানিক শিডিউল (General Schedule)',
      startTime: settings.dailyCheckInTime || '08:30',
      endTime: settings.dailyCheckOutTime || '11:30',
      graceMinutes: settings.lateGraceMinutes || 15,
      autoCheckoutWaitingMinutes: settings.autoCheckOutWaitingMinutes || 30,
      applicableDays: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      targetType: 'all',
      isActive: true,
      createdAt: ''
    }];
  }

  return matches;
};

/**
 * Pair check-in and check-out events into attendance intervals and timeline
 */
export const buildAttendanceIntervals = (
  events: TeacherAttendanceEvent[]
): {
  intervals: AttendanceInterval[];
  activeOpenInterval?: AttendanceInterval;
  totalDurationMinutes: number;
  totalOutsideMinutes: number;
} => {
  const sorted = [...events].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const intervals: AttendanceInterval[] = [];
  let currentOpenCheckIn: TeacherAttendanceEvent | null = null;
  let totalDurationMinutes = 0;
  let totalOutsideMinutes = 0;
  let prevCheckOutMinutes: number | null = null;

  for (const ev of sorted) {
    if (ev.eventType === 'check_in') {
      if (!currentOpenCheckIn) {
        currentOpenCheckIn = ev;
        const currentCheckInMinutes = timeStringToMinutes(ev.time);
        if (prevCheckOutMinutes !== null && currentCheckInMinutes > prevCheckOutMinutes) {
          totalOutsideMinutes += (currentCheckInMinutes - prevCheckOutMinutes);
        }
      }
    } else if (ev.eventType === 'check_out') {
      if (currentOpenCheckIn) {
        const inMins = timeStringToMinutes(currentOpenCheckIn.time);
        const outMins = timeStringToMinutes(ev.time);
        const diff = Math.max(0, outMins - inMins);
        totalDurationMinutes += diff;
        prevCheckOutMinutes = outMins;

        intervals.push({
          checkIn: currentOpenCheckIn,
          checkOut: ev,
          durationMinutes: diff,
          isOpen: false
        });
        currentOpenCheckIn = null;
      } else {
        intervals.push({
          checkIn: ev,
          checkOut: ev,
          durationMinutes: 0,
          isOpen: false
        });
      }
    }
  }

  let activeOpenInterval: AttendanceInterval | undefined = undefined;
  if (currentOpenCheckIn) {
    activeOpenInterval = {
      checkIn: currentOpenCheckIn,
      isOpen: true
    };
    intervals.push(activeOpenInterval);
  }

  return {
    intervals,
    activeOpenInterval,
    totalDurationMinutes,
    totalOutsideMinutes
  };
};
