import { useMemo, useState } from 'react';

import { type WorkflowTransaction } from '../lib/authClient';

type PaymentMethod = 'CARD' | 'BANK' | 'WALLET';

type PaymentMockupPayload = {
  amount?: number;
  provider_reference?: string;
};

type PaymentMockupModalProps = {
  transaction: WorkflowTransaction;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: PaymentMockupPayload) => Promise<void>;
};

function formatAmount(value: string | null, currency: string | null) {
  if (!value) return '-';
  return `${value} ${currency ?? ''}`.trim();
}

function formatCardNumberInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 16);
  const chunks = digitsOnly.match(/.{1,4}/g);
  return chunks ? chunks.join('-') : '';
}

function formatExpiryInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
  if (digitsOnly.length <= 2) return digitsOnly;
  return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
}

export default function PaymentMockupModal({
  transaction,
  busy,
  onClose,
  onConfirm,
}: PaymentMockupModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [amount, setAmount] = useState(transaction.total_cost ?? '');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [iban, setIban] = useState('');
  const [walletEmail, setWalletEmail] = useState('');
  const [accepted, setAccepted] = useState(false);

  const parsedAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [amount]);

  const providerRefPreview = useMemo(() => {
    const txShort = transaction.id.slice(0, 8).toUpperCase();
    if (paymentMethod === 'CARD') {
      const last4 = cardNumber.replace(/\D/g, '').slice(-4) || 'XXXX';
      return `MOCK-CARD-${txShort}-${last4}`;
    }
    if (paymentMethod === 'BANK') {
      const tail = iban.replace(/\s+/g, '').slice(-4).toUpperCase() || 'XXXX';
      return `MOCK-BANK-${txShort}-${tail}`;
    }
    const walletTag = walletEmail.split('@')[0]?.slice(0, 4).toUpperCase() || 'WALLET';
    return `MOCK-WALLET-${txShort}-${walletTag}`;
  }, [transaction.id, paymentMethod, cardNumber, iban, walletEmail]);

  const mockReady = useMemo(() => {
    if (!parsedAmount) return false;
    if (paymentMethod === 'CARD') {
      return (
        cardHolder.trim().length > 1 &&
        cardNumber.replace(/\D/g, '').length >= 12 &&
        expiry.length === 5 &&
        cvv.length >= 3
      );
    }
    if (paymentMethod === 'BANK') {
      return iban.replace(/\s+/g, '').length >= 12;
    }
    return walletEmail.includes('@');
  }, [parsedAmount, paymentMethod, cardHolder, cardNumber, expiry, cvv, iban, walletEmail]);

  async function handlePay() {
    if (!mockReady || !accepted || !parsedAmount) return;
    await onConfirm({
      amount: parsedAmount,
      provider_reference: providerRefPreview,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Payment Mockup Checkout</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Demo payment UI for transaction {transaction.id.slice(0, 8)}... This is a mock flow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
          >
            ×
          </button>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Item</p>
            <p className="text-sm">{transaction.item_name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Requested amount</p>
            <p className="text-sm">{formatAmount(transaction.total_cost, transaction.currency_code)}</p>
          </div>
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Payment status</p>
            <p className="text-sm">{transaction.payment_status}</p>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('CARD')}
            className={`rounded-lg border px-3 py-2 text-xs ${paymentMethod === 'CARD' ? 'border-sky-600/70 text-sky-300' : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'}`}
          >
            Card
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('BANK')}
            className={`rounded-lg border px-3 py-2 text-xs ${paymentMethod === 'BANK' ? 'border-sky-600/70 text-sky-300' : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'}`}
          >
            Bank Transfer
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('WALLET')}
            className={`rounded-lg border px-3 py-2 text-xs ${paymentMethod === 'WALLET' ? 'border-sky-600/70 text-sky-300' : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'}`}
          >
            Wallet
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-[rgb(var(--muted))]">Amount ({transaction.currency_code ?? 'currency'})</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
            />
          </label>

          {paymentMethod === 'CARD' && (
            <>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-[rgb(var(--muted))]">Cardholder name</span>
                <input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="John Client"
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-[rgb(var(--muted))]">Card number</span>
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                  placeholder="1111-2222-3333-4444"
                  inputMode="numeric"
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[rgb(var(--muted))]">Expiry</span>
                <input
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
                  placeholder="22/33"
                  inputMode="numeric"
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[rgb(var(--muted))]">CVV</span>
                <input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="123"
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          {paymentMethod === 'BANK' && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-[rgb(var(--muted))]">IBAN</span>
              <input
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="DE89 3704 0044 0532 0130 00"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
            </label>
          )}

          {paymentMethod === 'WALLET' && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-[rgb(var(--muted))]">Wallet email</span>
              <input
                type="email"
                value={walletEmail}
                onChange={(e) => setWalletEmail(e.target.value)}
                placeholder="demo.customer@wallet.test"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
          <p>Mock provider reference:</p>
          <p className="mt-1 font-mono text-[rgb(var(--text))]">{providerRefPreview}</p>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          I understand this is a mock payment flow and no real charge is processed.
        </label>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !accepted || !mockReady}
            onClick={() => void handlePay()}
            className="btn btn-primary flex-1 text-sm"
          >
            {busy ? 'Processing...' : 'Pay (Mock)'}
          </button>
        </div>
      </div>
    </div>
  );
}
