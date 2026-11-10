/**
 * Formatting utilities for Bengali / English numbers, BDT currency, and Dhaka timezone dates
 */

export const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  return str.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[parseInt(digit, 10)]);
}

export function formatNumber(val: number | string | undefined | null, isBengali: boolean = true): string {
  if (val === undefined || val === null || val === '') return '';
  return isBengali ? toBengaliNumber(val) : String(val);
}

export function formatBDT(amount: number, useBengali: boolean = true): string {
  const rounded = Math.round(amount || 0);
  const formatted = new Intl.NumberFormat('en-IN').format(rounded);
  if (useBengali) {
    return `৳ ${toBengaliNumber(formatted)}`;
  }
  return `BDT ${formatted}`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function isLateCheckIn(actualTimeStr: string, scheduledStartTime: string, graceMinutes: number): boolean {
  const [actualH, actualM] = actualTimeStr.split(':').map(Number);
  const [schedH, schedM] = scheduledStartTime.split(':').map(Number);

  const actualMinutes = actualH * 60 + actualM;
  const cutoffMinutes = schedH * 60 + schedM + (graceMinutes || 0);

  return actualMinutes > cutoffMinutes;
}

export function isEarlyCheckOut(actualTimeStr: string, scheduledEndTime: string): boolean {
  const [actualH, actualM] = actualTimeStr.split(':').map(Number);
  const [schedH, schedM] = scheduledEndTime.split(':').map(Number);

  const actualMinutes = actualH * 60 + actualM;
  const schedMinutes = schedH * 60 + schedM;

  return actualMinutes < schedMinutes;
}

export function formatDate(dateStr: string, isBengali: boolean = true): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  if (isBengali) {
    const monthsBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const day = toBengaliNumber(date.getDate());
    const month = monthsBn[date.getMonth()];
    const year = toBengaliNumber(date.getFullYear());
    return `${day} ${month} ${year}`;
  } else {
    const monthsEn = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${date.getDate()} ${monthsEn[date.getMonth()]} ${date.getFullYear()}`;
  }
}

export function formatSalaryMonth(monthStr: string, isBengali: boolean = true): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthsBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (monthIdx < 0 || monthIdx > 11) return monthStr;
  if (isBengali) {
    return `${monthsBn[monthIdx]} ${toBengaliNumber(year)}`;
  }
  return `${monthsEn[monthIdx]} ${year}`;
}
