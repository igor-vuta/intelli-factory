import type { WorkflowTransaction } from '../lib/authClient';
import type { GuidanceKey } from '../lib/guidance';
import GuidanceHint from './GuidanceHint';

export default function OrderGuidance({ transaction }: { transaction: WorkflowTransaction }) {
  const statusHints: Record<string, GuidanceKey> = {
    CONTRACT_DRAFTED: 'waitingSignatures',
    CONTRACT_SIGNING: 'waitingSignatures',
    FULLY_SIGNED: 'waitingPayment',
    AWAITING_PAYMENT: 'waitingPayment',
    PAYMENT_CONFIRMED: 'waitingFactory',
    FULFILLMENT_STARTED: 'waitingCarrier',
    IN_PROGRESS: 'waitingCustomer',
    COMPLETED: 'completed',
  };
  const hint = transaction.can_sign
    ? 'sign'
    : transaction.can_pay
      ? 'payment'
      : transaction.can_start_fulfillment
        ? 'fulfill'
        : transaction.can_mark_in_progress
          ? 'transit'
          : transaction.can_accept_completion
            ? 'accept'
            : (statusHints[transaction.status] ?? 'unavailable');
  return <GuidanceHint hint={hint} />;
}
