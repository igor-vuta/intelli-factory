import { useExperienceCopy } from '../hooks/useExperienceCopy';
const stages: Record<string, number> = {
  CONTRACT_DRAFTED: 0,
  CONTRACT_SIGNING: 0,
  FULLY_SIGNED: 1,
  AWAITING_PAYMENT: 1,
  PAYMENT_CONFIRMED: 2,
  FULFILLMENT_STARTED: 2,
  IN_PROGRESS: 2,
  COMPLETED: 3,
};
export default function OrderProgress({ status }: { status: string }) {
  const e = useExperienceCopy();
  const current = stages[status] ?? 0;
  return (
    <ol className="order-progress" aria-label={e('Order journey')}>
      {['Contract', 'Payment', 'Delivery', 'Complete'].map((step, index) => (
        <li
          key={e(step)}
          className={index <= current ? 'is-reached' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          <i aria-hidden>{index < current ? '✓' : index + 1}</i>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
