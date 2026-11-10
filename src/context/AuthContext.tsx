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
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  setupRecaptcha: (containerId: string) => RecaptchaVerifier;
  sendPhoneOtp: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  logout: () => Promise<void>;
  registerTeacherUser: (email: string, pass: string, name: string, teacherId: string) => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const isDefaultAdmin = isAdminUser(user);
        const userPhoto = user.photoURL 
          || user.providerData?.find(p => p.photoURL)?.photoURL 
          || '';

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            const userRole: UserRole = isDefaultAdmin ? 'admin' : (data.role || 'teacher');
            const currentPhoto = data.photoURL || userPhoto;
            
            // Sync admin role and photoURL if updated
            const updateFields: Partial<UserProfile> = {};
            if (isDefaultAdmin && data.role !== 'admin') {
              updateFields.role = 'admin';
            }
            if (userPhoto && !data.photoURL) {
              updateFields.photoURL = userPhoto;
            }
            if (Object.keys(updateFields).length > 0) {
              await setDoc(userDocRef, updateFields, { merge: true });
            }

            setUserProfile({
              ...data,
              photoURL: currentPhoto,
              role: userRole
            });
            setRole(userRole);
          } else {
            // New user registered or first-time login
            const assignedRole: UserRole = isDefaultAdmin ? 'admin' : 'teacher';
            const defaultName = user.displayName 
              || (isDefaultAdmin ? 'প্রধান প্রশাসক (Admin)' : (user.phoneNumber ? `ব্যবহারকারী (${user.phoneNumber})` : 'ইউজার'));
            
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || (isDefaultAdmin ? ADMIN_EMAIL : ''),
              phoneNumber: user.phoneNumber || '',
              displayName: defaultName,
              photoURL: userPhoto,
              role: assignedRole,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile, { merge: true });
            setUserProfile(newProfile);
            setRole(assignedRole);
          }
        } catch (err) {
          console.error("Error fetching/syncing user profile:", err);
          // If firestore rules block initial read/write, fallback gracefully
          const fallbackProfile: UserProfile = {
            uid: user.uid,
            email: user.email || (isDefaultAdmin ? ADMIN_EMAIL : ''),
            phoneNumber: user.phoneNumber || '',
            displayName: user.displayName || user.phoneNumber || (isDefaultAdmin ? 'প্রধান প্রশাসক (Admin)' : 'ইউজার'),
            photoURL: userPhoto,
            role: isDefaultAdmin ? 'admin' : 'teacher',
            status: 'active'
          };
          setUserProfile(fallbackProfile);
          setRole(fallbackProfile.role);
        }
      } else {
        setUserProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signupWithEmail = async (email: string, pass: string, displayName?: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName });
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const loginWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
    // If an existing verifier exists on window, clear it to avoid duplicate widget error
    const win = window as any;
    if (win.recaptchaVerifier) {
      try {
        win.recaptchaVerifier.clear();
      } catch (e) {
        console.warn("Could not clear previous recaptcha verifier:", e);
      }
      win.recaptchaVerifier = null;
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - allow signInWithPhoneNumber
      },
      'expired-callback': () => {
        console.warn("reCAPTCHA expired, please try again.");
      }
    });

    win.recaptchaVerifier = verifier;
    return verifier;
  };

  const sendPhoneOtp = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
    setRole(null);
  };

  const registerTeacherUser = async (email: string, pass: string, name: string, teacherId: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const profile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName: name,
      role: 'teacher',
      teacherId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
  };

  const isSuperAdmin = Boolean(
    currentUser && (role === 'admin' || isAdminUser(currentUser))
  );

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
      role, 
      isSuperAdmin,
      loading, 
      login: loginWithEmail,
      loginWithEmail, 
      signupWithEmail,
      resetPassword,
      loginWithGoogle,
      setupRecaptcha,
      sendPhoneOtp,
      logout, 
      registerTeacherUser 
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
