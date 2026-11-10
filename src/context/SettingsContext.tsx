import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { InstitutionSettings } from '../types';

export const DEFAULT_SETTINGS: InstitutionSettings = {
  institutionName: "জামিয়া মাদীনাতুন নূর ইসলামিয়া মাদরাসা",
  institutionNameEn: "Jamia Madinatun Nur Islamia Madrasha",
  establishedYear: "২০১৬ইং",
  logoUrl: "/logo.png",
  address: "JMNIN",
  phone: "01670529333",
  email: "tamimnur908@gmail.com",
  gpsLat: 23.8103, // Editable from Admin Settings
  gpsLng: 90.4125, // Editable from Admin Settings
  allowedRadiusMeters: 100, // Editable from Admin Settings
  dailyCheckInTime: "08:30",
  dailyCheckOutTime: "11:30",
  lateGraceMinutes: 15, // Editable from Admin Settings
  weeklyHolidays: ["Friday"],
  currentSessionId: "2024-2025",
  currencySymbol: "৳",
  feePricingMethod: 'general',
  generalFees: {
    residential: 3500,
    non_residential: 1500,
    day_care: 2200,
  },
  autoCheckOutEnabled: true,
  autoCheckOutWaitingMinutes: 30,
  autoCheckOutNotifyAdmin: true,
  autoCheckOutNotifyTeacher: true,
  missedCheckOutNotifyAdmin: true,
  missedCheckOutNotifyTeacher: true,
  authorizedSignatoryName: "মাওলানা তামিম নূর",
  authorizedSignatoryTitle: "মুহতামিম / প্রধান হিসাবরক্ষক",
  authorizedSignatoryType: "text",
  authorizedSignatorySignatureUrl: "",
  authorizedSignatorySealUrl: "",
};

interface SettingsContextType {
  settings: InstitutionSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<InstitutionSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<InstitutionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const docRef = doc(db, 'institution_settings', 'default');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
      } else {
        // Document doesn't exist yet, seed with defaults
        setDoc(docRef, DEFAULT_SETTINGS).catch(console.error);
        setSettings(DEFAULT_SETTINGS);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Could not load remote settings; using defaults:", error);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<InstitutionSettings>) => {
    const updated = { ...settings, ...newSettings, updatedAt: new Date().toISOString() };
    const docRef = doc(db, 'institution_settings', 'default');
    await setDoc(docRef, updated, { merge: true });
    setSettings(updated);
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};
