const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Scheduler cron function running every 15 minutes.
 * Checks open teacher attendance sessions today, notifies on missed checkouts,
 * and automatically executes Auto Check-Out when the waiting period is exceeded.
 */
exports.scheduledAttendanceSentinel = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone('Asia/Dhaka')
  .onRun(async (context) => {
    try {
      // 1. Fetch institution settings
      const settingsSnap = await db.collection('institution_settings').doc('default').get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};

      const now = new Date();
      // Format today in Asia/Dhaka YYYY-MM-DD
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
      const today = formatter.format(now);

      const scheduledCheckoutTime = settings.dailyCheckOutTime || '11:30';
      const [sH, sM] = scheduledCheckoutTime.split(':').map(Number);
      const scheduledMinutes = (sH || 11) * 60 + (sM || 30);

      // Current time in Asia/Dhaka
      const dhakaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour12: false, hour: '2-digit', minute: '2-digit' });
      const [cH, cM] = dhakaTimeStr.split(':').map(Number);
      const currentMinutes = (cH || 0) * 60 + (cM || 0);

      const waitingMinutes = Number(settings.autoCheckOutWaitingMinutes || 30);
      const autoCutoffMinutes = scheduledMinutes + waitingMinutes;

      // 2. Query today's attendance events
      const eventsSnap = await db.collection('teacher_attendance_events')
        .where('date', '==', today)
        .get();

      const events = [];
      eventsSnap.forEach(doc => events.push({ id: doc.id, ...doc.data() }));

      const teacherMap = new Map();
      events.forEach(ev => {
        const item = teacherMap.get(ev.teacherId) || {};
        if (ev.eventType === 'check_in') item.checkIn = ev;
        else if (ev.eventType === 'check_out') item.checkOut = ev;
        teacherMap.set(ev.teacherId, item);
      });

      for (const [teacherId, pair] of teacherMap.entries()) {
        const checkIn = pair.checkIn;
        const checkOut = pair.checkOut;

        if (checkIn && !checkOut) {
          // Missed Check-out Notification
          if (currentMinutes > scheduledMinutes && !checkIn.missedCheckoutNotified) {
            if (settings.missedCheckOutNotifyAdmin !== false) {
              await db.collection('notifications').add({
                title: `মিসড চেক-আউট নোটিশ: ${checkIn.teacherName}`,
                message: `${checkIn.teacherName} (${checkIn.teacherId}) সকাল ${checkIn.time}-এ চেক-ইন সম্পন্ন করলেও নির্ধারিত চেক-আউট সময় ${scheduledCheckoutTime}-এ চেক-আউট করেননি।`,
                type: 'missed_checkout',
                linkPage: 'attendance',
                targetRole: ['admin', 'principal'],
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            if (settings.missedCheckOutNotifyTeacher !== false && checkIn.teacherUid) {
              await db.collection('notifications').add({
                title: 'চেক-আউট রিমাইন্ডার নোটিশ',
                message: `সম্মানিত ${checkIn.teacherName}, আপনার আজকের নির্ধারিত চেক-আউট সময় (${scheduledCheckoutTime}) অতিক্রম করেছে। অনুগ্রহ করে অবিলম্বে জিপিএস চেক-আউট সম্পন্ন করুন।`,
                type: 'missed_checkout',
                linkPage: 'attendance',
                targetUid: checkIn.teacherUid,
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            await db.collection('teacher_attendance_events').doc(checkIn.id).update({
              missedCheckoutNotified: true,
              updatedAt: new Date().toISOString()
            });
          }

          // Auto Check-out Execution
          if (settings.autoCheckOutEnabled !== false && currentMinutes >= autoCutoffMinutes) {
            const cutoffH = Math.floor(autoCutoffMinutes / 60) % 24;
            const cutoffM = autoCutoffMinutes % 60;
            const cutoffTimeStr = `${String(cutoffH).padStart(2, '0')}:${String(cutoffM).padStart(2, '0')}:00`;

            const autoDocRef = await db.collection('teacher_attendance_events').add({
              teacherId: checkIn.teacherId,
              teacherName: checkIn.teacherName,
              teacherDocId: checkIn.teacherDocId || '',
              teacherUid: checkIn.teacherUid || '',
              date: today,
              eventType: 'check_out',
              time: cutoffTimeStr,
              timestamp: new Date().toISOString(),
              lat: 0,
              lng: 0,
              accuracy: 0,
              distanceMeters: 0,
              status: 'auto_checkout',
              isWithinGeofence: false,
              isAutoCheckout: true,
              autoCheckoutReason: `Cloud Scheduler Auto Check-out after ${waitingMinutes} min waiting threshold`,
              notes: 'সার্ভার শিডিউলড স্বয়ংক্রিয় চেক-আউট (Auto Check-out)। জিপিএস স্থানাঙ্ক অনুপলব্ধ।',
            });

            if (settings.autoCheckOutNotifyAdmin !== false) {
              await db.collection('notifications').add({
                title: `অটো চেক-আউট কার্যকর: ${checkIn.teacherName}`,
                message: `${checkIn.teacherName} (${checkIn.teacherId})-এর খোলা হাজিরা সেশনটি অতিরিক্ত ${waitingMinutes} মিনিট অপেক্ষার পর স্বয়ংক্রিয়ভাবে Auto Check-Out হিসেবে ক্লোজ করা হয়েছে।`,
                type: 'auto_checkout',
                linkPage: 'attendance',
                targetRole: ['admin', 'principal'],
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            if (settings.autoCheckOutNotifyTeacher !== false && checkIn.teacherUid) {
              await db.collection('notifications').add({
                title: 'অটো চেক-আউট সম্পন্ন হয়েছে',
                message: `সম্মানিত ${checkIn.teacherName}, আপনার আজকের হাজিরা সেশনটি সময়সীমা উত্তীর্ণ হওয়ায় ক্লাউড শিডিউলার কর্তৃক (${cutoffTimeStr}) অটো চেক-আউট সম্পন্ন করা হয়েছে।`,
                type: 'auto_checkout',
                linkPage: 'attendance',
                targetUid: checkIn.teacherUid,
                read: false,
                createdAt: new Date().toISOString()
              });
            }

            // Audit log
            await db.collection('audit_logs').add({
              action: 'Teacher Automatic Check-Out (Cloud Scheduler)',
              module: 'Attendance & GPS Overrides',
              recordId: autoDocRef.id,
              recordType: 'TeacherAttendanceEvent',
              performedBy: 'Firebase Cloud Functions Scheduler',
              performedByRole: 'system',
              timestamp: new Date().toISOString(),
              details: `শিক্ষক ${checkIn.teacherName} (${checkIn.teacherId})-এর জন্য ক্লাউড ফাংশনের মাধ্যমে অটো চেক-আউট সম্পন্ন করা হয়েছে।`
            });
          }
        }
      }

      console.log('Scheduled attendance sentinel executed successfully.');
      return null;
    } catch (error) {
      console.error('Error executing scheduled attendance sentinel:', error);
      return null;
    }
  });

/**
 * Backend Automatic User Provisioning & Module Synchronization Trigger
 * Ensures that whenever an account is approved or role updated to Teacher/Principal,
 * the corresponding profile in the `teachers` collection and all ERP module linkages
 * are automatically created and synchronized on the backend.
 */
exports.onUserApprovalProvisioning = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const afterData = change.after.exists ? change.after.data() : null;
    if (!afterData) return null; // Document deleted

    const isApproved = afterData.status === 'active' || afterData.approvalStatus === 'approved';
    const role = afterData.role;
    const userId = context.params.userId;

    if (!isApproved) return null;

    // Automated provisioning for Teacher and Principal roles
    if (role === 'teacher' || role === 'principal') {
      const teachersRef = db.collection('teachers');

      // 1. Check if profile already exists for this userId
      const userSnap = await teachersRef.where('userId', '==', userId).get();
      if (!userSnap.empty) return null; // Already provisioned

      // 2. Check if profile exists by email or phone
      let matchedDoc = null;
      if (afterData.email) {
        const emailSnap = await teachersRef.where('email', '==', afterData.email).get();
        if (!emailSnap.empty) matchedDoc = emailSnap.docs[0];
      }
      if (!matchedDoc && afterData.phoneNumber) {
        const phoneSnap = await teachersRef.where('phone', '==', afterData.phoneNumber).get();
        if (!phoneSnap.empty) matchedDoc = phoneSnap.docs[0];
      }

      const now = new Date().toISOString();

      if (matchedDoc) {
        // Link and update existing teacher document
        await matchedDoc.ref.update({
          userId: userId,
          authUid: userId,
          employmentStatus: 'active',
          updatedAt: now
        });
        await change.after.ref.update({
          teacherId: matchedDoc.data().teacherId,
          teacherDocId: matchedDoc.id,
          'provisioning.status': 'completed',
          'provisioning.modules.teacherManagement': true,
          'provisioning.modules.gpsAttendance': true,
          'provisioning.modules.payroll': true
        });
      } else {
        // Generate next unique sequential Teacher ID (T-101, T-102...)
        const allSnap = await teachersRef.get();
        let maxNum = 100;
        allSnap.forEach(d => {
          const tId = d.data().teacherId || '';
          const match = tId.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        });
        const genTeacherId = `T-${maxNum + 1}`;

        const newTeacherRef = await teachersRef.add({
          teacherId: genTeacherId,
          fullName: afterData.displayName || 'উস্তাদ',
          phone: afterData.phoneNumber || '',
          email: afterData.email || '',
          designation: role === 'principal' ? 'মুহতামিম / প্রধান শিক্ষক' : 'সহকারী শিক্ষক',
          department: 'সাধারণ',
          baseSalary: 12000,
          isSalaryConfigured: false,
          joiningDate: now.split('T')[0],
          employmentStatus: 'active',
          salaryType: 'monthly',
          userId: userId,
          authUid: userId,
          linkedAt: now,
          linkedBy: 'Cloud Function Automatic Provisioning',
          provisioningStatus: 'completed',
          createdAt: now,
          updatedAt: now
        });

        await change.after.ref.update({
          teacherId: genTeacherId,
          teacherDocId: newTeacherRef.id,
          'provisioning.status': 'completed',
          'provisioning.modules.teacherManagement': true,
          'provisioning.modules.gpsAttendance': true,
          'provisioning.modules.payroll': true
        });
      }
    }

    return null;
  });
