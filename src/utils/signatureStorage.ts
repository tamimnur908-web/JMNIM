import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Uploads a base64 signature image to Firebase Storage.
 * If storage upload fails (e.g. security rules or offline/unsupported),
 * it returns the base64 dataUrl as safe fallback to prevent user data loss.
 */
export async function uploadSignatureImage(
  dataUrl: string,
  salaryId: string,
  teacherId: string
): Promise<string> {
  if (!dataUrl) {
    throw new Error('Signature data is empty');
  }

  try {
    const timestamp = Date.now();
    const cleanSalaryId = salaryId.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanTeacherId = teacherId.replace(/[^a-zA-Z0-9_-]/g, '');
    const path = `signatures/salaries/${cleanSalaryId}_${cleanTeacherId}_${timestamp}.png`;
    
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/png',
      customMetadata: {
        salaryId,
        teacherId,
        uploadedAt: new Date().toISOString()
      }
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err: any) {
    console.warn("Firebase Storage signature upload fallback to dataURL:", err?.message || err);
    // Return base64 dataUrl as reliable fallback so signature is permanently saved
    return dataUrl;
  }
}