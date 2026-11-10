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
  RegistrationRequest
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
        // Existing accounts preserve their active status; Super Admin is always active
        const userStatus: UserStatus = isDefaultAdmin 
          ? 'active' 
          : (data.status || 'active');
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

        setUserProfile(resolvedProfile);
        setRole(userRole);
        setStatus(userStatus);
      } else {
        // First-time login / New user registration via Google or other provider
        const assignedRole: UserRole = isDefaultAdmin ? 'admin' : 'staff';
        const assignedStatus: UserStatus = isDefaultAdmin ? 'active' : 'pending';
        const defaultName = user.displayName 
          || (isDefaultAdmin ? 'প্রধান প্রশাসক (Admin)' : (user.phoneNumber ? `ব্যবহারকারী (${user.phoneNumber})` : 'ইউজার'));

        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || (isDefaultAdmin ? ADMIN_EMAIL : ''),
          phoneNumber: user.phoneNumber || '',
          displayName: defaultName,
          photoURL: userPhoto,
          role: assignedRole,
          status: assignedStatus,
          permissions: isDefaultAdmin ? undefined : {},
          registrationMethod: user.providerData?.some(p => p.providerId === 'google.com') ? 'google' : 'email',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(userDocRef, newProfile, { merge: true });

        // If not super admin, create registration request & notification
        if (!isDefaultAdmin) {
          try {
            const regReq: RegistrationRequest = {
              id: user.uid,
              uid: user.uid,
              displayName: defaultName,
              email: user.email || undefined,
              phoneNumber: user.phoneNumber || undefined,
              photoURL: userPhoto || undefined,
              registrationMethod: 'google',
              registrationDate: new Date().toISOString(),
              status: 'pending',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'registration_requests', user.uid), regReq);

            await addDoc(collection(db, 'notifications'), {
              title: 'নতুন ইউজার নিবন্ধন আবেদন (Google)',
              message: `${defaultName} (${user.email || 'Google Account'}) সিস্টেম ব্যবহারের অনুমোদনের জন্য আবেদন করেছেন।`,
              type: 'approval_request',
              linkPage: 'userApprovals',
              read: false,
              createdAt: new Date().toISOString()
            });
          } catch (reqErr) {
            console.warn("Could not write registration request doc:", reqErr);
          }
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
      permissions: isDefaultAdmin ? undefined : {},
      registrationMethod: 'email',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', cred.user.uid), newProfile);

    if (!isDefaultAdmin) {
      const regReq: RegistrationRequest = {
        id: cred.user.uid,
        uid: cred.user.uid,
        displayName: displayName.trim(),
        email: cleanEmail,
        registrationMethod: 'email',
        registrationDate: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'registration_requests', cred.user.uid), regReq);

      await addDoc(collection(db, 'notifications'), {
        title: 'নতুন ইউজার নিবন্ধন আবেদন (Email)',
        message: `${displayName.trim()} (${cleanEmail}) সিস্টেম ব্যবহারের অনুমোদনের জন্য আবেদন করেছেন।`,
        type: 'approval_request',
        linkPage: 'userApprovals',
        read: false,
        createdAt: new Date().toISOString()
      });
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
      permissions: isDefaultAdmin ? undefined : {},
      registrationMethod: 'phone',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', cred.user.uid), newProfile);

    if (!isDefaultAdmin) {
      const regReq: RegistrationRequest = {
        id: cred.user.uid,
        uid: cred.user.uid,
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        registrationMethod: 'phone',
        registrationDate: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'registration_requests', cred.user.uid), regReq);

      await addDoc(collection(db, 'notifications'), {
        title: 'নতুন ইউজার নিবন্ধন আবেদন (Mobile)',
        message: `${displayName.trim()} (${phoneNumber.trim()}) মোবাইল নম্বর দিয়ে নিবন্ধন করেছেন। অনুমোদনের জন্য রিভিউ করুন।`,
        type: 'approval_request',
        linkPage: 'userApprovals',
        read: false,
        createdAt: new Date().toISOString()
      });
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
    await signInWithPopup(auth, provider);
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

  const canApproveRegistrations = Boolean(
    isSuperAdmin || role === 'principal'
  );

  const hasPermission = (module: ERPModule, action: PermissionAction): boolean => {
    if (isSuperAdmin) return true;
    if (status !== 'active') return false;
    if (!userProfile?.permissions) return false;
    const modulePerms = userProfile.permissions[module];
    if (!modulePerms || !Array.isArray(modulePerms)) return false;
    return modulePerms.includes(action);
  };

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
