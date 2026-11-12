import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  UserProfile, 
  RegistrationRequest, 
  Teacher, 
  UserRole, 
  UserPermissions, 
  ModuleProvisioningState 
} from '../types';
import { getTodayDateString } from '../utils/formatters';
import { logAudit } from '../utils/auditLogger';

export interface ProvisioningResult {
  success: boolean;
  userUid: string;
  role: UserRole;
  teacherId?: string;
  teacherDocId?: string;
  staffId?: string;
  provisioningState: ModuleProvisioningState;
  message: string;
  error?: string;
}

export interface RepairCandidate {
  user: UserProfile;
  issues: string[];
  matchedTeacher?: Teacher;
  proposedAction: 'link_existing' | 'create_new_teacher' | 'sync_permissions_only';
}

/**
 * Generates next sequential unique Teacher ID, avoiding any collisions with existing IDs.
 * Format: T-101, T-102, ...
 */
export function generateNextTeacherId(existingTeachers: Teacher[]): string {
  const existingIds = new Set(
    existingTeachers.map(t => (t.teacherId || '').trim().toUpperCase())
  );

  let maxNum = 100;
  existingTeachers.forEach(t => {
    const raw = (t.teacherId || '').trim();
    const match = raw.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  let candidateNum = maxNum + 1;
  while (existingIds.has(`T-${candidateNum}`)) {
    candidateNum++;
  }

  return `T-${candidateNum}`;
}

/**
 * Generates next sequential staff ID for accountants or general staff.
 */
export function generateNextStaffId(role: UserRole, existingUsers: UserProfile[]): string {
  const prefix = role === 'accountant' ? 'ACC' : (role === 'principal' ? 'PRN' : 'STF');
  const existing = new Set(
    existingUsers.map(u => (u.staffId || '').trim().toUpperCase())
  );

  let num = 1;
  while (existing.has(`${prefix}-${String(num).padStart(3, '0')}`)) {
    num++;
  }
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

/**
 * Core Automatic Provisioning Engine:
 * Idempotently provisions an approved user across all applicable ERP modules.
 */
export async function provisionApprovedUser({
  user,
  assignedRole,
  permissions,
  approverUid,
  approverName,
  existingTeachersList,
  allUsersList,
  explicitTeacherData,
  linkExistingTeacherDocId
}: {
  user: UserProfile | RegistrationRequest;
  assignedRole: UserRole;
  permissions: UserPermissions;
  approverUid: string;
  approverName: string;
  existingTeachersList?: Teacher[];
  allUsersList?: UserProfile[];
  explicitTeacherData?: Partial<Teacher>;
  linkExistingTeacherDocId?: string;
}): Promise<ProvisioningResult> {
  const uid = (user as any).uid || (user as any).id;
  if (!uid) {
    throw new Error('User UID is missing for provisioning.');
  }

  const now = new Date().toISOString();
  const errors: string[] = [];

  // 1. Fetch current teachers and users if not passed
  let teachers = existingTeachersList;
  if (!teachers) {
    const tSnap = await getDocs(collection(db, 'teachers'));
    teachers = [];
    tSnap.forEach(d => teachers!.push({ id: d.id, ...d.data() } as Teacher));
  }

  let users = allUsersList;
  if (!users) {
    const uSnap = await getDocs(collection(db, 'users'));
    users = [];
    uSnap.forEach(d => users!.push({ uid: d.id, ...d.data() } as UserProfile));
  }

  let finalTeacherId: string | null = (user as UserProfile).teacherId || null;
  let finalTeacherDocId: string | null = (user as UserProfile).teacherDocId || null;
  let finalStaffId: string | null = (user as UserProfile).staffId || null;

  let teacherManagementSuccess = false;
  let gpsAttendanceSuccess = false;
  let payrollSuccess = false;

  try {
    // 2. Role-Based Module Integration
    if (assignedRole === 'teacher' || assignedRole === 'principal') {
      // Find if a teacher profile already exists for this person
      let matchedTeacher: Teacher | undefined;

      // Priority A: Explicit teacher doc ID selected by admin
      if (linkExistingTeacherDocId) {
        matchedTeacher = teachers.find(t => t.id === linkExistingTeacherDocId);
      }

      // Priority B: Already linked by userId
      if (!matchedTeacher) {
        matchedTeacher = teachers.find(t => t.userId === uid || (t as any).authUid === uid);
      }

      // Priority C: Matches existing teacherDocId on user
      if (!matchedTeacher && (user as UserProfile).teacherDocId) {
        matchedTeacher = teachers.find(t => t.id === (user as UserProfile).teacherDocId);
      }

      // Priority D: Matches existing teacherId on user
      if (!matchedTeacher && (user as UserProfile).teacherId) {
        matchedTeacher = teachers.find(t => t.teacherId === (user as UserProfile).teacherId);
      }

      // Priority E: Matches email
      if (!matchedTeacher && user.email) {
        const lowerEmail = user.email.toLowerCase().trim();
        matchedTeacher = teachers.find(t => t.email && t.email.toLowerCase().trim() === lowerEmail);
      }

      // Priority F: Matches phone number
      if (!matchedTeacher && user.phoneNumber) {
        const cleanPhone = user.phoneNumber.replace(/\D/g, '');
        if (cleanPhone.length >= 8) {
          matchedTeacher = teachers.find(t => t.phone && t.phone.replace(/\D/g, '') === cleanPhone);
        }
      }

      if (matchedTeacher) {
        // Idempotent Update of Existing Profile
        finalTeacherId = matchedTeacher.teacherId;
        finalTeacherDocId = matchedTeacher.id;

        const updatePayload: Partial<Teacher> = {
          userId: uid,
          authUid: uid,
          fullName: explicitTeacherData?.fullName || matchedTeacher.fullName || user.displayName || 'উস্তাদ',
          phone: explicitTeacherData?.phone || matchedTeacher.phone || user.phoneNumber || '',
          email: matchedTeacher.email || user.email || '',
          designation: explicitTeacherData?.designation || matchedTeacher.designation || (assignedRole === 'principal' ? 'মুহতামিম / প্রধান শিক্ষক' : 'সহকারী শিক্ষক'),
          department: explicitTeacherData?.department || matchedTeacher.department || 'সাধারণ',
          employmentStatus: 'active',
          linkedAt: now,
          linkedBy: approverName,
          provisioningStatus: 'completed',
          updatedAt: now
        };

        if (explicitTeacherData?.baseSalary !== undefined) {
          updatePayload.baseSalary = Number(explicitTeacherData.baseSalary);
          updatePayload.isSalaryConfigured = true;
        }

        await updateDoc(doc(db, 'teachers', matchedTeacher.id), updatePayload);
        teacherManagementSuccess = true;
        gpsAttendanceSuccess = true;
        payrollSuccess = true;
      } else {
        // Automatic Creation of New Teacher Profile
        const genId = explicitTeacherData?.teacherId?.trim() || generateNextTeacherId(teachers);
        const baseSal = explicitTeacherData?.baseSalary !== undefined ? Number(explicitTeacherData.baseSalary) : 12000;
        const isSalConfigured = explicitTeacherData?.baseSalary !== undefined;

        const newTeacherData: Omit<Teacher, 'id'> = {
          teacherId: genId,
          fullName: explicitTeacherData?.fullName?.trim() || user.displayName || 'উস্তাদ',
          phone: explicitTeacherData?.phone?.trim() || user.phoneNumber || '',
          email: user.email || '',
          designation: explicitTeacherData?.designation?.trim() || (assignedRole === 'principal' ? 'মুহতামিম / প্রধান শিক্ষক' : 'সহকারী শিক্ষক'),
          department: explicitTeacherData?.department?.trim() || 'সাধারণ',
          baseSalary: baseSal,
          isSalaryConfigured: isSalConfigured,
          joiningDate: explicitTeacherData?.joiningDate || getTodayDateString(),
          employmentStatus: 'active',
          salaryType: 'monthly',
          userId: uid,
          authUid: uid,
          linkedAt: now,
          linkedBy: approverName,
          provisioningStatus: 'completed',
          createdAt: now,
          updatedAt: now
        };

        const newDocRef = await addDoc(collection(db, 'teachers'), newTeacherData);
        finalTeacherId = genId;
        finalTeacherDocId = newDocRef.id;

        teacherManagementSuccess = true;
        gpsAttendanceSuccess = true;
        payrollSuccess = true;
      }
    } else {
      // Non-teacher role: Generate Staff ID if not assigned
      if (!finalStaffId) {
        finalStaffId = generateNextStaffId(assignedRole, users);
      }
    }
  } catch (modErr: any) {
    console.error("Module provisioning error for user:", uid, modErr);
    errors.push(`Module provisioning error: ${modErr.message || modErr}`);
  }

  // 3. Update User Profile in `users/{uid}`
  const provStatus = errors.length === 0 ? 'completed' : 'partially_completed';
  const provisioningState: ModuleProvisioningState = {
    status: provStatus,
    provisionedAt: now,
    modules: {
      auth: true,
      userProfile: true,
      registrationRequest: true,
      teacherManagement: teacherManagementSuccess,
      gpsAttendance: gpsAttendanceSuccess,
      payroll: payrollSuccess,
      centralReports: teacherManagementSuccess,
      permissions: true
    },
    ...(errors.length > 0 ? { errors } : {})
  };

  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, {
    uid,
    displayName: user.displayName || 'ইউজার',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    status: 'active',
    accountStatus: 'active',
    approvalStatus: 'approved',
    role: assignedRole,
    permissions,
    teacherId: finalTeacherId || null,
    teacherDocId: finalTeacherDocId || null,
    staffId: finalStaffId || null,
    provisioning: provisioningState,
    approvedBy: approverUid || '',
    approvedByName: approverName || 'Admin',
    approvedAt: now,
    updatedAt: now
  }, { merge: true });

  // 4. Update Registration Request Document in `registration_requests/{uid}`
  try {
    const reqDocRef = doc(db, 'registration_requests', uid);
    await updateDoc(reqDocRef, {
      status: 'approved',
      accountStatus: 'active',
      approvalStatus: 'approved',
      assignedRole,
      assignedPermissions: permissions,
      reviewedBy: approverUid,
      reviewedByName: approverName,
      reviewedAt: now,
      provisioningStatus: provStatus
    });
  } catch (reqErr) {
    // Non-blocking if registration_request document didn't exist
  }

  // 5. Send Approval and Provisioning Notification to User
  try {
    const roleBn = assignedRole === 'teacher' ? 'শিক্ষক' : (assignedRole === 'principal' ? 'মুহতামিম / প্রধান শিক্ষক' : (assignedRole === 'accountant' ? 'হিসাবরক্ষক' : 'স্টাফ'));
    await addDoc(collection(db, 'notifications'), {
      title: 'আপনার অ্যাকাউন্ট অনুমোদিত ও সক্রিয় হয়েছে!',
      message: `মুবারকবাদ! মাদরাসা কর্তৃপক্ষ আপনার নিবন্ধন অনুমোদন করেছেন এবং সংশ্লিষ্ট সকল মডিউলে সক্রিয় করা হয়েছে। নির্ধারিত রোল: ${roleBn} (${assignedRole.toUpperCase()})।`,
      type: 'approval_result',
      linkPage: 'dashboard',
      targetUid: uid,
      read: false,
      createdAt: now
    });
  } catch (nErr) {
    console.warn("Could not dispatch applicant notification:", nErr);
  }

  // 6. Audit Logging
  try {
    await logAudit({
      action: 'Automatic User Provisioning & Module Synchronization',
      module: 'User Approvals & Access Control',
      recordId: uid,
      recordType: 'UserProfile',
      performedBy: approverName,
      performedByRole: 'admin',
      performedByUid: approverUid,
      newValue: {
        role: assignedRole,
        teacherId: finalTeacherId,
        teacherDocId: finalTeacherDocId,
        staffId: finalStaffId,
        provisioningStatus: provStatus
      },
      details: `ইউজার ${user.displayName} (${user.email || user.phoneNumber || uid})-এর রোল ${assignedRole} হিসেবে সকল মডিউলে স্বয়ংক্রিয়ভাবে প্রোভিজনিং ও সিঙ্ক সম্পন্ন হয়েছে।`
    });
  } catch (aErr) {
    console.warn("Could not write audit log:", aErr);
  }

  return {
    success: errors.length === 0,
    userUid: uid,
    role: assignedRole,
    teacherId: finalTeacherId || undefined,
    teacherDocId: finalTeacherDocId || undefined,
    staffId: finalStaffId || undefined,
    provisioningState,
    message: errors.length === 0 
      ? 'ব্যবহারকারী সফলভাবে অনুমোদিত হয়েছে এবং সংশ্লিষ্ট মডিউলগুলোতে যুক্ত করা হয়েছে।'
      : 'ব্যবহারকারী অনুমোদিত হয়েছে কিন্তু কিছু মডিউলে আংশিক ত্রুটি ঘটেছে।'
  };
}

/**
 * Scans all existing approved/active users to find missing module records.
 */
export function findRepairCandidates(
  users: UserProfile[],
  teachers: Teacher[]
): RepairCandidate[] {
  const candidates: RepairCandidate[] = [];

  users.forEach(u => {
    // Only inspect active/approved users (do not touch pending/rejected)
    const isApprovedOrActive = u.status === 'active' || u.approvalStatus === 'approved' || u.accountStatus === 'active';
    if (!isApprovedOrActive) return;

    const issues: string[] = [];
    let matchedTeacher: Teacher | undefined;
    let proposedAction: 'link_existing' | 'create_new_teacher' | 'sync_permissions_only' = 'sync_permissions_only';

    if (u.role === 'teacher' || u.role === 'principal') {
      // 1. Check if linked to teachers collection
      if (u.teacherDocId) {
        matchedTeacher = teachers.find(t => t.id === u.teacherDocId);
      }
      if (!matchedTeacher && u.teacherId) {
        matchedTeacher = teachers.find(t => t.teacherId === u.teacherId);
      }
      if (!matchedTeacher) {
        matchedTeacher = teachers.find(t => t.userId === u.uid || (t as any).authUid === u.uid);
      }
      if (!matchedTeacher && u.email) {
        const lower = u.email.toLowerCase().trim();
        matchedTeacher = teachers.find(t => t.email && t.email.toLowerCase().trim() === lower);
      }
      if (!matchedTeacher && u.phoneNumber) {
        const digits = u.phoneNumber.replace(/\D/g, '');
        if (digits.length >= 8) {
          matchedTeacher = teachers.find(t => t.phone && t.phone.replace(/\D/g, '') === digits);
        }
      }

      if (!matchedTeacher) {
        issues.push('শিক্ষক ম্যানেজমেন্টে কোনো প্রোফাইল রেকর্ড নেই (Missing Teacher Profile)');
        issues.push('জিপিএস হাজিরা ও পে-রোল সিস্টেমে অন্তর্ভুক্ত নেই (Missing Attendance & Payroll)');
        proposedAction = 'create_new_teacher';
      } else {
        // Teacher profile exists, check integrity
        if (!matchedTeacher.userId || matchedTeacher.userId !== u.uid) {
          issues.push(`শিক্ষক প্রোফাইলে লগইন অ্যাকাউন্ট লিংক নেই (${matchedTeacher.fullName} [${matchedTeacher.teacherId}])`);
          proposedAction = 'link_existing';
        }
        if (!u.teacherId || !u.teacherDocId || u.teacherId !== matchedTeacher.teacherId) {
          issues.push('ইউজার প্রোফাইলে শিক্ষক আইডি বা ডক আইডি অসম্পূর্ণ');
          proposedAction = 'link_existing';
        }
      }
    } else {
      // For accountant or staff
      if (!u.staffId) {
        issues.push('স্টাফ আইডি বা মডিউল মেটাডাটা বরাদ্দ নেই');
        proposedAction = 'sync_permissions_only';
      }
    }

    // Check permissions integrity
    if (!u.permissions || Object.keys(u.permissions).length === 0) {
      issues.push('মডিউল পারমিশন সংরক্ষিত নেই');
    }

    if (issues.length > 0) {
      candidates.push({
        user: u,
        issues,
        matchedTeacher,
        proposedAction
      });
    }
  });

  return candidates;
}