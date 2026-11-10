import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Uploads a base64 signature image to Firebase Storage with a strict 1-second timeout.
 * If storage upload takes longer than 1s or fails (e.g. CORS, offline, or unconfigured bucket),
 * it returns the base64 dataUrl immediately as a 100% reliable, instant fallback.
 */
export async function uploadSignatureImage(
  dataUrl: string,
  salaryId: string,
  teacherId: string
): Promise<string> {
  if (!dataUrl) {
    throw new Error('Signature data is empty');
  }

  // Fast-path: Canvas signature data is typically ~5-15 KB.
  // We race Firebase Storage with a strict 1.0-second timeout so the UI never hangs.
  try {
    const uploadWithTimeout = new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        // Fallback to dataUrl after 1 second to prevent endless loading spinner
        resolve(dataUrl);
      }, 1000);

      (async () => {
        try {
          const timestamp = Date.now();
          const cleanSalaryId = (salaryId || 'sal').replace(/[^a-zA-Z0-9_-]/g, '');
          const cleanTeacherId = (teacherId || 'tch').replace(/[^a-zA-Z0-9_-]/g, '');
          const path = `signatures/salaries/${cleanSalaryId}_${cleanTeacherId}_${timestamp}.png`;
          const storageRef = ref(storage, path);
          
          await uploadString(storageRef, dataUrl, 'data_url', { 
            contentType: 'image/png' 
          });
          const downloadUrl = await getDownloadURL(storageRef);
          clearTimeout(timer);
          resolve(downloadUrl);
        } catch (storageErr) {
          clearTimeout(timer);
          resolve(dataUrl);
        }
      })();
    });

    return await uploadWithTimeout;
  } catch (err: any) {
    return dataUrl;
  }
}
