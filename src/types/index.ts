export type UserRole = 'admin' | 'principal' | 'teacher' | 'accountant' | 'staff';

export type UserStatus = 'active' | 'pending' | 'rejected' | 'disabled';

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

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  teacherId?: string;
  status: UserStatus;
  permissions?: UserPermissions;
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
  status: 'pending' | 'approved' | 'rejected';
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
  userId?: string; // Linked Firebase Auth UID
  linkedAt?: string;
  linkedBy?: string;
  notes?: string;
  createdAt: string;
}

export type AttendanceEventType = 'check_in' | 'check_out';
export type AttendanceStatus = 'present' | 'late' | 'early_leave' | 'leave' | 'absent' | 'missed_checkout';

export interface TeacherAttendanceEvent {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string; // YYYY-MM-DD
  eventType: AttendanceEventType;
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

export interface SalaryPayment {
  id: string;
  voucherNumber: string; // Unique, e.g. SAL-2024-01-001
  teacherId: string;
  teacherName: string;
  month: string; // e.g. "২০২৪-০১"
  baseSalary: number;
  allowances: number;
  bonus: number;
  advanceDeduction: number;
  otherDeduction: number;
  attendanceDeduction: number;
  payableAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'bank' | 'bkash';
  referenceNo?: string;
  preparedBy: string;
  remarks?: string;
  createdAt: string;
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
  type: 'approval_request' | 'approval_result' | 'import_summary' | 'system';
  read: boolean;
  linkPage?: string;
  createdAt: string;
}
