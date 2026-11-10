import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MadrasaClass, Section, ResidentialCategory, InstitutionSettings } from '../types';

export const DEFAULT_CLASSES: Omit<MadrasaClass, 'id'>[] = [
  { 
    name: 'নূরানী বিভাগ', 
    nameEn: 'Noorani Section', 
    order: 1, 
    fees: { residential: 3000, non_residential: 1200, day_care: 2000 } 
  },
  { 
    name: 'নাজেরা বিভাগ', 
    nameEn: 'Nazera Section', 
    order: 2, 
    fees: { residential: 3200, non_residential: 1300, day_care: 2100 } 
  },
  { 
    name: 'হিফজুল কুরআন বিভাগ', 
    nameEn: 'Hifzul Quran Department', 
    order: 3, 
    fees: { residential: 3500, non_residential: 1500, day_care: 2200 } 
  },
  { 
    name: 'ইবতেদায়ী ১ম শ্রেণি', 
    nameEn: 'Ibtedaee Class 1', 
    order: 4, 
    fees: { residential: 3200, non_residential: 1200, day_care: 2000 } 
  },
  { 
    name: 'ইবতেদায়ী ২য় শ্রেণি', 
    nameEn: 'Ibtedaee Class 2', 
    order: 5, 
    fees: { residential: 3200, non_residential: 1200, day_care: 2000 } 
  },
  { 
    name: 'ইবতেদায়ী ৩য় শ্রেণি', 
    nameEn: 'Ibtedaee Class 3', 
    order: 6, 
    fees: { residential: 3300, non_residential: 1300, day_care: 2100 } 
  },
  { 
    name: 'ইবতেদায়ী ৪র্থ শ্রেণি', 
    nameEn: 'Ibtedaee Class 4', 
    order: 7, 
    fees: { residential: 3400, non_residential: 1400, day_care: 2200 } 
  },
  { 
    name: 'ইবতেদায়ী ৫ম শ্রেণি', 
    nameEn: 'Ibtedaee Class 5', 
    order: 8, 
    fees: { residential: 3500, non_residential: 1500, day_care: 2300 } 
  },
  { 
    name: 'কিতাব বিভাগ (মিশকাত/দাওরা)', 
    nameEn: 'Kitab Department', 
    order: 9, 
    fees: { residential: 4000, non_residential: 1800, day_care: 2500 } 
  }
];

export async function fetchClasses(): Promise<MadrasaClass[]> {
  const snap = await getDocs(collection(db, 'madrasa_classes'));
  const list: MadrasaClass[] = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() } as MadrasaClass));

  if (list.length === 0) {
    // Seed initial classes
    for (const c of DEFAULT_CLASSES) {
      const docRef = await addDoc(collection(db, 'madrasa_classes'), c);
      list.push({ id: docRef.id, ...c });
    }
  }

  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  return list;
}

export async function fetchSections(classId?: string): Promise<Section[]> {
  const coll = collection(db, 'sections');
  const snap = classId ? await getDocs(query(coll, where('classId', '==', classId))) : await getDocs(coll);
  const list: Section[] = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() } as Section));

  if (list.length === 0 && !classId) {
    // If no sections exist yet, we can provide general defaults when needed
  }
  return list;
}

export async function createClass(data: Omit<MadrasaClass, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'madrasa_classes'), data);
  return docRef.id;
}

export async function updateClass(id: string, data: Partial<MadrasaClass>): Promise<void> {
  await updateDoc(doc(db, 'madrasa_classes', id), data);
}

export async function canDeleteClass(classId: string): Promise<{ canDelete: boolean; studentCount: number }> {
  const q = query(collection(db, 'students'), where('classId', '==', classId));
  const snap = await getDocs(q);
  return {
    canDelete: snap.empty,
    studentCount: snap.size
  };
}

export async function removeClass(classId: string): Promise<{ success: boolean; message: string }> {
  const check = await canDeleteClass(classId);
  if (!check.canDelete) {
    return {
      success: false,
      message: `এই ক্লাসে বর্তমানে ${check.studentCount} জন শিক্ষার্থীর রেকর্ড সংরক্ষিত রয়েছে। ক্লাসটি মুছে ফেলা সম্ভব নয়।`
    };
  }
  // Also delete associated sections
  const secSnap = await getDocs(query(collection(db, 'sections'), where('classId', '==', classId)));
  for (const s of secSnap.docs) {
    await deleteDoc(doc(db, 'sections', s.id));
  }
  await deleteDoc(doc(db, 'madrasa_classes', classId));
  return { success: true, message: 'ক্লাস ও সংশ্লিষ্ট শাখা সফলভাবে মুছে ফেলা হয়েছে।' };
}

export async function createSection(classId: string, name: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'sections'), { classId, name });
  return docRef.id;
}

export async function removeSection(sectionId: string): Promise<{ success: boolean; message: string }> {
  const q = query(collection(db, 'students'), where('sectionId', '==', sectionId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return {
      success: false,
      message: `এই শাখায় ${snap.size} জন শিক্ষার্থী নিবন্ধিত রয়েছে। শাখাটি মুছে ফেলা সম্ভব নয়।`
    };
  }
  await deleteDoc(doc(db, 'sections', sectionId));
  return { success: true, message: 'শাখাটি সফলভাবে মুছে ফেলা হয়েছে।' };
}

/**
 * Calculates the applicable monthly fee based on pricing method, class fees, and student category
 */
export function calculateDefaultMonthlyFee(
  settings: InstitutionSettings,
  targetClass?: MadrasaClass,
  category: ResidentialCategory = 'residential'
): number {
  if (settings.feePricingMethod === 'class_wise' && targetClass && targetClass.fees) {
    const fee = targetClass.fees[category];
    if (fee !== undefined && fee !== null && fee > 0) {
      return fee;
    }
  }

  // Fallback to general default fees
  if (settings.generalFees && settings.generalFees[category] !== undefined) {
    return settings.generalFees[category];
  }

  // Hard fallback defaults
  switch (category) {
    case 'residential':
      return 3500;
    case 'non_residential':
      return 1500;
    case 'day_care':
      return 2200;
    default:
      return 1500;
  }
}
