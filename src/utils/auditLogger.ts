import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AuditLog, NotificationItem } from '../types';

export interface LogAuditParams {
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
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const entry: Omit<AuditLog, 'id'> = {
      action: params.action,
      module: params.module,
      recordId: params.recordId || '',
      recordType: params.recordType || '',
      performedBy: params.performedBy || 'System',
      performedByRole: params.performedByRole || 'user',
      performedByUid: params.performedByUid || '',
      previousValue: params.previousValue !== undefined ? JSON.stringify(params.previousValue) : '',
      newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : '',
      approvalStatus: params.approvalStatus || 'auto',
      approvedBy: params.approvedBy || '',
      reason: params.reason || '',
      details: params.details || '',
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, 'audit_logs'), entry);
  } catch (err) {
    console.warn("Could not write audit log:", err);
  }
}

export interface CreateNotificationParams {
  title: string;
  message: string;
  type?: 'approval_request' | 'approval_result' | 'import_summary' | 'system';
  linkPage?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const notif: Omit<NotificationItem, 'id'> = {
      title: params.title,
      message: params.message,
      type: params.type || 'system',
      read: false,
      linkPage: params.linkPage || '',
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'notifications'), notif);
  } catch (err) {
    console.warn("Could not create notification:", err);
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const notifRef = doc(db, 'notifications', id);
    await updateDoc(notifRef, { read: true });
  } catch (err) {
    console.warn("Could not mark notification as read:", err);
  }
}
