// Readable, translated labels and a semantic tone for every lifecycle status the API returns
// (RequestStatus, TransactionStatus, CandidateStatus, PaymentStatus, SignatureStatus in
// backend/app/api/prisma/schema.prisma). Russian and Kazakh come from experienceI18n, keyed by
// the enum value.
import { experienceText } from './experienceI18n';
import type { Locale } from './i18n';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Waiting', tone: 'neutral' },
  PAIRING_IN_PROGRESS: { label: 'Collecting proposals', tone: 'warning' },
  MATCHED: { label: 'Partners found', tone: 'info' },
  CONTRACT_DRAFTED: { label: 'Contract ready', tone: 'warning' },
  CONTRACT_SIGNING: { label: 'Signing the contract', tone: 'warning' },
  FULLY_SIGNED: { label: 'Signed by everyone', tone: 'info' },
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'warning' },
  PAYMENT_CONFIRMED: { label: 'Payment confirmed', tone: 'info' },
  FULFILLMENT_STARTED: { label: 'In production', tone: 'info' },
  IN_PROGRESS: { label: 'In delivery', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  DISPUTED: { label: 'Disputed', tone: 'danger' },
  ACCEPTED: { label: 'Chosen', tone: 'success' },
  REJECTED: { label: 'Not chosen', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  ACTIVE: { label: 'Active', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'neutral' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
  SIGNED: { label: 'Signed', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  AUTHORIZED: { label: 'Authorised', tone: 'info' },
  CAPTURED: { label: 'Paid', tone: 'success' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

export function statusTone(status: string): StatusTone {
  return STATUS[status]?.tone ?? 'neutral';
}

export function statusLabel(locale: Locale, status: string | null | undefined): string {
  if (!status) return '—';
  const english = STATUS[status]?.label ?? status.toLowerCase().replace(/_/g, ' ');
  if (locale === 'en') return english;
  const translated = experienceText(locale, status);
  return translated === status ? english : translated;
}
