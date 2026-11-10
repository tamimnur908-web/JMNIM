export type UserRole = 'admin' | 'principal' | 'teacher' | 'accountant' | 'staff';

export type UserStatus = 'active' | 'pending' | 'pending_approval' | 'rejected' | 'disabled';

export const isPendingStatus = (statusOrUser?: string | UserProfile | null): boolean => {
  if (!statusOrUser) return false;
  if (typeof statusOrUser === 'string') {
    const s = statusOrUser.toLowerCase();
    return s === 'pending' || s === 'pending_approval' || s === 'pending-approval';
  }
  const u = statusOrUser;
  if (u.uid === 'ymWfOe8MvbeLT2Pw1ILqDI4F8yH3' || u.role === 'admin') return false;
  const s = (u.status || '').toLowerCase();
  const a = (u.approvalStatus || '').toLowerCase();
  const ac = (u.accountStatus || '').toLowerCase();
  if (s === 'pending' || s === 'pending_approval' || s === 'pending-approval') return true;
  if (a === 'pending' || a === 'pending_approval') return true;
  if (ac === 'pending' || ac === 'pending_approval') return true;
  if (!u.approvedBy && (u.role === 'staff' || !u.role) && (!u.permissions || Object.keys(u.permissions).length === 0)) {
    return true;
  }
  return false;
};

export type ERPModule = 
  | 'dashboard'
  | 'students' 
  | 'teachers' 
  | 'attendance' 
  | 'fees' 
  | 'payroll' 
  | 'accounts' 
  | 'academic' 
  | 'notices' 
  | 'reports' 
  | 'settings' 
  | 'backupRestore'
  | 'userApprovals';

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete' | 'approve' | 'print' | 'export' | 'import';

export type UserPermissions = Partial<Record<ERPModule, PermissionAction[]>>;

export type ProvisioningStatus = 'pending' | 'provisioning' | 'completed' | 'partially_completed' | 'failed';

export interface ModuleProvisioningState {
  status: ProvisioningStatus;
  provisionedAt?: string;
  modules: {
    auth: boolean;
    userProfile: boolean;
    registrationRequest: boolean;
    teacherManagement?: boolean;
    gpsAttendance?: boolean;
    payroll?: boolean;
    centralReports?: boolean;
    permissions?: boolean;
  };
  errors?: string[];
  repairedAt?: string;
}

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  staffId?: string; // e.g. STF-101, ACC-101
  teacherId?: string; // T-101
  teacherDocId?: string; // Doc ID in teachers collection
  status: UserStatus;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  accountStatus?: 'pending_approval' | 'active' | 'disabled' | 'rejected';
  permissions?: UserPermissions;
  provisioning?: ModuleProvisioningState;
  registrationMethod?: 'email' | 'phone' | 'google';
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistrationRequest {
  id: string;
  uid: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  registrationMethod: 'email' | 'phone' | 'google';
  registrationDate: string;
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  accountStatus?: 'pending_approval' | 'active' | 'disabled' | 'rejected';
  assignedRole?: UserRole;
  assignedPermissions?: UserPermissions;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export type ResidentialCategory = 'residential' | 'non_residential' | 'day_care';
export type FeePricingMethod = 'general' | 'class_wise';

export interface InstitutionSettings {
  id?: string;
  institutionName: string;
  institutionNameEn: string;
  establishedYear: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  gpsLat: number; // e.g. 23.8103
  gpsLng: number; // e.g. 90.4125
  allowedRadiusMeters: number; // e.g. 100
  dailyCheckInTime: string; // e.g. "08:30"
  dailyCheckOutTime: string; // e.g. "11:30"
  lateGraceMinutes: number; // e.g. 15
  weeklyHolidays: string[]; // e.g. ["Friday"]
  currentSessionId: string;
  currencySymbol: string; // "৳"
  feePricingMethod: FeePricingMethod; // 'general' or 'class_wise'
  generalFees: {
    residential: number;
    non_residential: number;
    day_care: number;
  };
  approverUids?: string[]; // UIDs of Admins/Principals authorized by Super Admin to approve registrations
  // Auto Check-out and Missed Check-out Settings
  autoCheckOutEnabled?: boolean;
  autoCheckOutWaitingMinutes?: number; // Additional waiting period in minutes (e.g. 30)
  autoCheckOutNotifyAdmin?: boolean;
  autoCheckOutNotifyTeacher?: boolean;
  missedCheckOutNotifyAdmin?: boolean;
  missedCheckOutNotifyTeacher?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Teacher {
  id: string;
  teacherId: string; // Unique, e.g. T-101
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  designation: string; // e.g. "মুহতামিম / প্রধান শিক্ষক", "উস্তাদ", "সহকারী শিক্ষক"
  department?: string; // e.g. "হিফজ", "কিতাব", "নূরানী"
  subjects?: string[];
  joiningDate: string;
  employmentStatus: 'active' | 'inactive' | 'on_leave';
  salaryType: 'monthly' | 'hourly';
  baseSalary: number;
  isSalaryConfigured?: boolean; // false indicates "Salary Setup Required"
  userId?: string; // Linked Firebase Auth UID
  authUid?: string;
  provisioningStatus?: ProvisioningStatus;
  linkedAt?: string;
  linkedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AttendanceEventType = 'check_in' | 'check_out';
export type AttendanceStatus = 'present' | 'late' | 'early_leave' | 'leave' | 'absent' | 'missed_checkout' | 'auto_checkout';

export type ScheduleTargetType = 'all' | 'selected';

export interface AttendanceSchedule {
  id: string;
  name: string; // e.g., "সকাল শিফট (Morning Session)", "হিফজ বিকেল শিফট (Afternoon Hifz)"
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  graceMinutes: number; // e.g. 15
  autoCheckoutWaitingMinutes: number; // e.g. 30
  applicableDays: string[]; // e.g. ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
  targetType: ScheduleTargetType; // 'all' or 'selected'
  assignedTeacherIds?: string[]; // e.g. ["T-101", "T-102"]
  assignedTeacherNames?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type LeaveType = 'illness' | 'personal' | 'family_emergency' | 'medical' | 'other';
export type LeaveScope = 'full_day' | 'partial_day' | 'session';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TeacherLeaveApplication {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherDocId?: string;
  teacherUid: string;
  leaveType: LeaveType | string;
  leaveTypeName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  scope: LeaveScope;
  leaveScope?: LeaveScope;
  totalDays?: number;
  targetScheduleId?: string;
  targetScheduleName?: string;
  specificSessionName?: string;
  reason: string; // MANDATORY! Must be detailed, cannot be blank
  supportingDocUrl?: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  approvedBy?: string;
  approvedAt?: string;
  approverRemarks?: string;
  isDirectGrant?: boolean; // true if granted directly by Admin / Principal
  grantedBy?: string;
  grantedByName?: string;
  grantedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceInterval {
  checkIn: TeacherAttendanceEvent;
  checkOut?: TeacherAttendanceEvent;
  durationMinutes?: number;
  isOpen: boolean;
}

export interface TeacherAttendanceEvent {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherDocId?: string;
  teacherUid?: string;
  date: string; // YYYY-MM-DD
  eventType: AttendanceEventType;
  scheduleId?: string; // ID of the schedule session
  scheduleName?: string; // Name of the schedule session
  intervalIndex?: number; // 1, 2, 3... within that day/session
  time: string; // HH:mm:ss
  timestamp: string; // ISO
  lat: number;
  lng: number;
  accuracy: number;
  distanceMeters: number;
  status: AttendanceStatus;
  isWithinGeofence: boolean;
  isManualCorrection?: boolean;
  correctionReason?: string;
  correctedBy?: string;
  isManualEntry?: boolean;
  recordedBy?: string;
  recordedByUid?: string;
  recordedByRole?: string;
  isAutoCheckout?: boolean;
  autoCheckoutReason?: string;
  missedCheckoutNotified?: boolean;
  originalValues?: Partial<TeacherAttendanceEvent>;
  notes?: string;
}

export interface AttendanceCorrection {
  id: string;
  teacherId: string;
  date: string;
  previousValue: string;
  newValue: string;
  reason: string;
  correctedBy: string; // Admin email/name
  timestamp: string;
}

export interface Student {
  id: string;
  studentId: string; // Unique, e.g. S-2024-001
  fullName: string;
  fullNameEn?: string;
  dob?: string;
  gender?: 'male' | 'female';
  guardianName: string;
  guardianPhone: string;
  guardianRelation?: string;
  address: string;
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  roll: string;
  residentialCategory: ResidentialCategory; // আবাসিক, অনাবাসিক, ডে-কেয়ার
  admissionDate: string;
  sessionId: string;
  sessionName: string;
  feePlanId?: string;
  monthlyFee: number;
  isFeeOverridden?: boolean;
  discountPercentage?: number;
  status: 'active' | 'graduated' | 'withdrawn' | 'archived';
  isArchived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentApprovalRequest {
  id: string;
  type: 'edit' | 'delete';
  studentId: string; // e.g. S-2024-001
  studentDocId: string; // Firestore doc ID
  studentName: string;
  currentData?: Partial<Student>;
  proposedData?: Partial<Student>;
  reason: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail?: string;
  requesterRole: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerUid?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface AdmissionRecord {
  id: string;
  admissionNumber: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  classId: string;
  className: string;
  sectionName?: string;
  residentialCategory: ResidentialCategory;
  sessionId: string;
  admissionFee: number;
  monthlyFee: number;
  paidAmount: number;
  paymentMethod: string;
  date: string;
  status: 'approved' | 'pending';
  receiptNumber: string;
  notes?: string;
}

export interface StudentDailyAttendance {
  id: string; // date_classId_sectionId
  date: string; // YYYY-MM-DD
  classId: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  records: {
    studentId: string;
    studentName: string;
    roll: string;
    status: 'present' | 'absent' | 'late' | 'leave';
    remarks?: string;
  }[];
  takenBy: string;
  updatedAt: string;
}

export interface AcademicSession {
  id: string;
  name: string; // e.g. "২০২৪-২০২৫" or "১৪৪৫-১৪৪৬ হিজরি"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface MadrasaClass {
  id: string;
  name: string; // e.g. "নূরানী", "হিফজুল কুরআন", "ইবতেদায়ী ১ম", "মিশকাত", ইত্যাদি
  nameEn?: string;
  order: number;
  defaultMonthlyFee?: number;
  fees?: {
    residential: number;
    non_residential: number;
    day_care: number;
  };
}

export interface Section {
  id: string;
  classId: string;
  name: string; // e.g. "ক", "খ" বা "মাদানী", "নূর"
}

export interface Subject {
  id: string;
  classId: string;
  name: string; // e.g. "কুরআন মাজীদ", "হাদীস", "ফিকহ", "আরবি ব্যাকরণ", "বাংলা", "গণিত"
  code?: string;
  maxMarks: number;
  passMarks: number;
}

export interface FeeStructure {
  id: string;
  classId: string;
  feeType: 'tuition' | 'admission' | 'exam' | 'boarding' | 'books' | 'other';
  title: string;
  amount: number;
  frequency: 'monthly' | 'one_time' | 'per_exam';
}

export interface FeePayment {
  id: string;
  receiptNumber: string; // Unique, e.g. REC-2024-0001
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  residentialCategory?: ResidentialCategory;
  feeType: string;
  month?: string; // e.g. "জানুয়ারি ২০২৪"
  amount: number;
  discount: number;
  fine: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  collectorName: string;
  remarks?: string;
  isReversed?: boolean;
  reversedReason?: string;
  reversedBy?: string;
  reversedAt?: string;
  createdAt: string;
}

export interface SalaryProfile {
  id: string;
  teacherId: string;
  baseSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  specialAllowance?: number;
  standardDeductions?: number;
  effectiveFrom: string;
}

export type SalaryPaymentStatus = 'paid' | 'cancelled' | 'adjusted';
export type SalaryAcknowledgmentStatus = 'pending' | 'acknowledged' | 'legacy';

export interface SalaryPayment {
  id: string;
  voucherNumber: string; // Unique, e.g. SAL-2024-01-001
  teacherId: string;
  teacherName: string;
  teacherUid?: string; // Linked Firebase Auth UID
  teacherDocId?: string; // Linked teachers collection Doc ID
  designation?: string;
  department?: string;
  month: string; // YYYY-MM e.g. "2024-01"
  baseSalary: number;
  allowances: number;
  bonus: number;
  advanceDeduction: number;
  otherDeduction: number;
  attendanceDeduction: number;
  payableAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: 'cash' | 'bank' | 'bkash';
  referenceNo?: string;
  preparedBy: string;
  remarks?: string;
  paymentStatus?: SalaryPaymentStatus;
  acknowledgmentStatus?: SalaryAcknowledgmentStatus;
  signatureUrl?: string; // Digital signature image URL or data URL
  acknowledgedAt?: string; // ISO timestamp
  acknowledgedByUid?: string;
  acknowledgedByName?: string;
  acknowledgmentDeclaration?: string;
  acknowledgmentLanguage?: 'bn' | 'en';
  receiptNumber?: string;
  lastReminderSentAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SalaryAdvance {
  id: string;
  teacherId: string;
  teacherName: string;
  amount: number;
  recoveredAmount: number;
  balance: number;
  reason: string;
  issueDate: string;
  approvedBy: string;
  status: 'active' | 'fully_recovered';
}

export interface CashTransaction {
  id: string;
  voucherNo: string;
  type: 'income' | 'expense';
  category: string; // e.g. "শিক্ষার্থী বেতন", "শিক্ষক বেতন", "বিদ্যুৎ বিল", "আপ্যায়ন", "ভবন সংস্কার", "দান-অনুদান"
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'bank' | 'bkash';
  partyName?: string; // Payer or Payee
  description: string;
  recordedBy: string;
  linkedPaymentId?: string; // linked to FeePayment or SalaryPayment if auto-generated
  isReversed?: boolean;
  reversedReason?: string;
  createdAt: string;
}

export interface ClassRoutine {
  id: string;
  classId: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  day: 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday';
  period: number;
  startTime: string; // "09:00"
  endTime: string; // "09:45"
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  roomNo?: string;
}

export interface Examination {
  id: string;
  name: string; // e.g. "১ম সাময়িক পরীক্ষা", "বার্ষিক পরীক্ষা", "দাওরায়ে হাদীস সমাপনী"
  sessionId: string;
  classId: string;
  className?: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published';
}

export interface ExamMark {
  id: string;
  examId: string;
  examName?: string;
  studentId: string;
  studentName: string;
  roll: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
  passMarks: number;
  grade?: string; // "মুমতাজ (A+)", "জায়্যিদ জিদ্দান (A)", "জায়্যিদ (B)", "মকবুল (C)", "রাসিব (Fail)"
  remarks?: string;
  submittedBy: string;
  updatedAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  targetRole: 'all' | 'teachers' | 'students' | 'accountant';
  targetClassId?: string;
  publishDate: string;
  expiryDate?: string;
  priority: 'normal' | 'urgent';
  createdBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  recordId?: string;
  recordType?: string;
  performedBy: string;
  performedByRole?: string;
  performedByUid?: string;
  previousValue?: any;
  newValue?: any;
  approvalStatus?: 'approved' | 'rejected' | 'auto';
  approvedBy?: string;
  reason?: string;
  details: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'approval_request' | 'approval_result' | 'import_summary' | 'system' | 'salary_payment' | 'salary_reminder';
  read: boolean;
  linkPage?: string;
  targetRole?: UserRole[];
  targetUid?: string;
  salaryPaymentId?: string;
  salaryMonth?: string;
  applicantUid?: string;
  applicantName?: string;
  registrationMethod?: 'email' | 'phone' | 'google';
  createdAt: string;
}
