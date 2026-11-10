import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { 
  UserProfile, 
  UserRole, 
  UserStatus, 
  ERPModule, 
  PermissionAction, 
  UserPermissions,
  RegistrationRequest,
  isPendingStatus
} from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  canApproveRegistrations: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string, pass: string) => Promise<void>;
  signupWithPhone: (phoneNumber: string, pass: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  hasPermission: (module: ERPModule, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configured admin credentials
export const ADMIN_EMAIL = "tamimnur908@gmail.com";
export const ADMIN_UID = "ymWfOe8MvbeLT2Pw1ILqDI4F8yH3";

export const isAdminUser = (user: User | null): boolean => {
  if (!user) return false;
  return (
    user.uid === ADMIN_UID ||
    Boolean(user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  );
};

// Formats phone number into standard E.164 and creates a dedicated institutional auth identifier
export const phoneToInternalAuthEmail = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, '');
  return `phone_${digits}@auth.jmnim.internal`;
};

export const normalizePhoneNumber = (raw: string, countryCode: string = '+880'): string => {
  let cleaned = raw.trim().replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  const cleanCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
  return `${cleanCode}${cleaned}`;
};

// Helper to ensure registration request document and notification exist idempotently
export const ensureRegistrationRequestAndNotify = async (
  uid: string,
  profile: Partial<UserProfile>,
  method: 'email' | 'phone' | 'google'
): Promise<void> => {
  const isDefaultAdmin = uid === ADMIN_UID || (profile.email && profile.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (isDefaultAdmin) return;

  const reqDocRef = doc(db, 'registration_requests', uid);
  const reqSnap = await getDoc(reqDocRef);

  if (!reqSnap.exists()) {
    const displayName = profile.displayName || (profile.phoneNumber ? `ব্যবহারকারী (${profile.phoneNumber})` : 'ইউজার');
    const now = new Date().toISOString();
    const regReq: RegistrationRequest = {
      id: uid,
      uid: uid,
      displayName: displayName,
      email: profile.email || undefined,
      phoneNumber: profile.phoneNumber || undefined,
      photoURL: profile.photoURL || undefined,
      registrationMethod: method,
      registrationDate: profile.createdAt || now,
      status: 'pending',
      approvalStatus: 'pending',
      createdAt: profile.createdAt || now
    };
    await setDoc(reqDocRef, regReq);

    // Create targeted notification for approvers
    try {
      await addDoc(collection(db, 'notifications'), {
        title: `নতুন ইউজার নিবন্ধন আবেদন (${method === 'google' ? 'Google' : method === 'phone' ? 'Mobile' : 'Email'})`,
        message: `${displayName} (${profile.email || profile.phoneNumber || 'অ্যাকাউন্ট'}) সিস্টেম ব্যবহারের অনুমোদনের জন্য আবেদন করেছেন।`,
        type: 'approval_request',
        linkPage: 'userApprovals',
        applicantUid: uid,
        applicantName: displayName,
        registrationMethod: method,
        targetRole: ['admin', 'principal'],
        read: false,
        createdAt: now
      });
    } catch (nErr) {
      console.warn("Could not write notification doc:", nErr);
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [status, setStatus] = useState<UserStatus>('pending');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAndSyncProfile = async (user: User) => {
    const isDefaultAdmin = isAdminUser(user);
    const userPhoto = user.photoURL 
      || user.providerData?.find(p => p.photoURL)?.photoURL 
      || '';

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        const userRole: UserRole = isDefaultAdmin ? 'admin' : (data.role || 'staff');
        
        // Strict pending check: If account is newly registered and waiting for approval, keep pending
        const isPending = !isDefaultAdmin && (
          isPendingStatus(data) ||
          data.status === 'pending' ||
          data.status === 'pending_approval' ||
          data.approvalStatus === 'pending' ||
          data.accountStatus === 'pending_approval' ||
          (!data.approvedBy && (data.role === 'staff' || !data.role) && (!data.permissions || Object.keys(data.permissions).length === 0))
        );

        const isRej = !isDefaultAdmin && (data.status === 'rejected' || data.approvalStatus === 'rejected');

        const userStatus: UserStatus = isDefaultAdmin 
          ? 'active' 
          : (isRej ? 'rejected' : (isPending ? 'pending' : (data.status || 'active')));

        const currentPhoto = data.photoURL || userPhoto;

        const updateFields: Partial<UserProfile> = {};
        if (isDefaultAdmin && (data.role !== 'admin' || data.status !== 'active')) {
          updateFields.role = 'admin';
          updateFields.status = 'active';
        }
        if (userPhoto && !data.photoURL) {
          updateFields.photoURL = userPhoto;
        }
        if (Object.keys(updateFields).length > 0) {
          await setDoc(userDocRef, updateFields, { merge: true });
        }

        const resolvedProfile: UserProfile = {
          ...data,
          photoURL: currentPhoto,
          role: userRole,
          status: userStatus
        };

        // IDEMPOTENT SELF-REPAIR: If account is pending, guarantee registration_requests document exists
        if (userStatus === 'pending' && !isDefaultAdmin) {
          try {
            const method = resolvedProfile.registrationMethod || (user.providerData?.some(p => p.providerId === 'google.com') ? 'google' : 'email');
            await ensureRegistrationRequestAndNotify(user.uid, resolvedProfile, method);
          } catch (repairErr) {
            console.warn("Could not auto-repair registration request doc:", repairErr);
          }
        }

        setUserProfile(resolvedProfile);
        setRole(userRole);
        setStatus(userStatus);
      } else {
        // First-time login / New user registration via Google or other provider
        const assignedRole: UserRole = isDefaultAdmin ? 'admin' : 'staff';
        const assignedStatus: UserStatus = isDefaultAdmin ? 'active' : 'pending';
        const defaultName = user.displayName 
          || (isDefaultAdmin ? 'প্রধান প্রশাসক (Admin)' : (user.phoneNumber ? `ব্যবহারকারী (${user.phoneNumber})` : 'ইউজার'));
        const regMethod = user.providerData?.some(p => p.providerId === 'google.com') ? 'google' : 'email';
        const now = new Date().toISOString();

        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || (isDefaultAdmin ? ADMIN_EMAIL : ''),
          phoneNumber: user.phoneNumber || '',
          displayName: defaultName,
          photoURL: userPhoto,
          role: assignedRole,
          status: assignedStatus,
          approvalStatus: isDefaultAdmin ? 'approved' : 'pending',
          accountStatus: isDefaultAdmin ? 'active' : 'pending_approval',
          permissions: isDefaultAdmin ? undefined : {},
          registrationMethod: regMethod,
          createdAt: now,
          updatedAt: now
        };

        await setDoc(userDocRef, newProfile, { merge: true });

        // Save registration request and notification before confirming
        if (!isDefaultAdmin) {
          await ensureRegistrationRequestAndNotify(user.uid, newProfile, regMethod);
        }

        setUserProfile(newProfile);
        setRole(assignedRole);
        setStatus(assignedStatus);
      }
    } catch (err) {
      console.error("Error fetching/syncing user profile:", err);
      const fallbackProfile: UserProfile = {
        uid: user.uid,
        email: user.email || (isDefaultAdmin ? ADMIN_EMAIL : ''),
        phoneNumber: user.phoneNumber || '',
        displayName: user.displayName || user.phoneNumber || (isDefaultAdmin ? 'প্রধান প্রশাসক (Admin)' : 'ইউজার'),
        photoURL: userPhoto,
        role: isDefaultAdmin ? 'admin' : 'staff',
        status: isDefaultAdmin ? 'active' : 'pending'
      };
      setUserProfile(fallbackProfile);
      setRole(fallbackProfile.role);
      setStatus(fallbackProfile.status);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchAndSyncProfile(user);
      } else {
        setUserProfile(null);
        setRole(null);
        setStatus('pending');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (auth.currentUser) {
      await fetchAndSyncProfile(auth.currentUser);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
  };

  const signupWithEmail = async (email: string, pass: string, displayName: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const cleanEmail = email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    const isDefaultAdmin = isAdminUser(cred.user);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email: cleanEmail,
      displayName: displayName.trim(),
      role: isDefaultAdmin ? 'admin' : 'staff',
      status: isDefaultAdmin ? 'active' : 'pending',
      approvalStatus: isDefaultAdmin ? 'approved' : 'pending',
      accountStatus: isDefaultAdmin ? 'active' : 'pending_approval',
      permissions: isDefaultAdmin ? undefined : {},
      registrationMethod: 'email',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', cred.user.uid), newProfile);

    if (!isDefaultAdmin) {
      await ensureRegistrationRequestAndNotify(cred.user.uid, newProfile, 'email');
    }

    setUserProfile(newProfile);
    setRole(newProfile.role);
    setStatus(newProfile.status);
  };

  const loginWithPhone = async (phoneNumber: string, pass: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const internalEmail = phoneToInternalAuthEmail(phoneNumber);
    await signInWithEmailAndPassword(auth, internalEmail, pass);
  };

  const signupWithPhone = async (phoneNumber: string, pass: string, displayName: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const internalEmail = phoneToInternalAuthEmail(phoneNumber);
    const cred = await createUserWithEmailAndPassword(auth, internalEmail, pass);

    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    const isDefaultAdmin = isAdminUser(cred.user);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      phoneNumber: phoneNumber.trim(),
      displayName: displayName.trim(),
      role: isDefaultAdmin ? 'admin' : 'staff',
      status: isDefaultAdmin ? 'active' : 'pending',
      approvalStatus: isDefaultAdmin ? 'approved' : 'pending',
      accountStatus: isDefaultAdmin ? 'active' : 'pending_approval',
      permissions: isDefaultAdmin ? undefined : {},
      registrationMethod: 'phone',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', cred.user.uid), newProfile);

    if (!isDefaultAdmin) {
      await ensureRegistrationRequestAndNotify(cred.user.uid, newProfile, 'phone');
    }

    setUserProfile(newProfile);
    setRole(newProfile.role);
    setStatus(newProfile.status);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  };

  const loginWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    if (cred.user) {
      await fetchAndSyncProfile(cred.user);
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
    setRole(null);
    setStatus('pending');
  };

  const isSuperAdmin = Boolean(
    currentUser && (role === 'admin' || isAdminUser(currentUser))
  );

  const hasPermission = (module: ERPModule, action: PermissionAction): boolean => {
    if (isSuperAdmin) return true;
    if (status !== 'active') return false;
    // Critical: Teachers can always view and print their own salary records
    if (role === 'teacher' && module === 'payroll' && (action === 'view' || action === 'print')) return true;
    if (!userProfile?.permissions) return false;
    const modulePerms = userProfile.permissions[module];
    if (!modulePerms || !Array.isArray(modulePerms)) return false;
    return modulePerms.includes(action);
  };

  const canApproveRegistrations = Boolean(
    isSuperAdmin || role === 'principal' || hasPermission('userApprovals', 'view') || hasPermission('userApprovals', 'approve')
  );

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
      role, 
      status,
      isSuperAdmin,
      canApproveRegistrations,
      loading, 
      login: loginWithEmail,
      loginWithEmail, 
      signupWithEmail,
      loginWithPhone,
      signupWithPhone,
      resetPassword,
      loginWithGoogle,
      logout, 
      refreshUserProfile,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
