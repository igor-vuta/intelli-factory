import { useMemo, useState } from 'react';

import { type ContractSigningPayload, type WorkflowTransaction } from '../lib/authClient';
import { formatQuantityWithUnit } from '../lib/formatting';

type AgreementSignModalProps = {
  transaction: WorkflowTransaction;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: ContractSigningPayload) => Promise<void>;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function AgreementSignModal({
  transaction,
  busy,
  onClose,
  onConfirm,
}: AgreementSignModalProps) {
  const [jurisdiction, setJurisdiction] = useState('');
  const [negotiationDays, setNegotiationDays] = useState('10');
  const [disputeWindowDays, setDisputeWindowDays] = useState('5');
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const todayDate = new Date();
  const contractDate = todayDate.toLocaleDateString();
  const contractDateIso = todayDate.toISOString();

  function formatScore(value: number | null) {
    if (value == null) return '-';
    if (Math.abs(value) < 0.0001 && value !== 0) return value.toExponential(3);
    return Number(value.toFixed(4)).toString();
  }

  const agreementText = useMemo(() => {
    const factoryName = transaction.factory_legal_name ?? '[Factory Legal Name]';
    const clientName = transaction.client_legal_name ?? '[Client Legal Name]';
    const logistName = transaction.logist_legal_name ?? '[Logistics Provider Legal Name]';
    const currencyCode = transaction.currency_code ?? '[CURRENCY_CODE]';
    const quotedQty = formatQuantityWithUnit(transaction.quoted_quantity, null);
    const requestStatus = transaction.request_status ?? transaction.status;
    const goodsCost = transaction.goods_cost ?? '-';
    const paymentTerms = transaction.payment_terms ?? 'Full payment before fulfillment start';
    const candidateCreatedAt =
      transaction.candidate_created_at ? formatDate(transaction.candidate_created_at) : '-';
    const candidateUpdatedAt =
      transaction.candidate_updated_at ? formatDate(transaction.candidate_updated_at) : '-';
    const candidateDeletedAt =
      transaction.candidate_deleted_at ? formatDate(transaction.candidate_deleted_at) : '-';

    return `THREE-PARTY SUPPLY & LOGISTICS AGREEMENT

Contract Reference: ${transaction.contract_reference}
Date: ${contractDate}
Currency: ${currencyCode}

PARTIES
1. THE FACTORY - ${factoryName}, hereinafter referred to as "Factory"
2. THE CLIENT - ${clientName}, hereinafter referred to as "Client"
3. THE LOGIST - ${logistName}, hereinafter referred to as "Logist"

Collectively referred to as "the Parties."

RECITALS
This Agreement governs the terms under which the Factory supplies goods to the Client and the Logist facilitates delivery, as matched through the platform under a specific Match Candidate record identified by a unique Request ID and Inventory Entry ID.

ARTICLE 1 - MATCH & ORDER IDENTIFICATION
1.1 Each transaction under this Agreement is uniquely identified by:
- Match Candidate ID - ${transaction.match_candidate_id ?? '[MATCH_CANDIDATE_ID]'}
- Request ID - ${transaction.request_id}
- Inventory Entry ID - ${transaction.inventory_entry_id ?? '[INVENTORY_ENTRY_ID]'}
- Logistic Offer ID - ${transaction.logistic_offer_id ?? '[LOGISTIC_OFFER_ID]'}

1.2 Candidate Status progression:
PENDING -> [ACCEPTED / REJECTED / CONFIRMED / COMPLETED / CANCELLED]

1.3 No obligations under Articles 2, 3, or 4 become binding until Candidate Status moves from PENDING.

ARTICLE 2 - FACTORY OBLIGATIONS
2.1 Inventory Accuracy - Goods referenced by Inventory Entry ID must be available and accurately described.
2.2 Quoted Quantity - Factory commits to supply no less than quoted_quantity (${quotedQty}).
2.3 Pricing - Unit pricing included in total_cost is fixed at match creation.
2.4 Factory Notes - Declared notes before confirmation carry contractual weight.
2.5 Reliability - Reliability and fitness metrics must not be manipulated.
2.6 Readiness - Goods must be ready within delivery_days (${transaction.delivery_days ?? '-'}) window.
2.7 Soft Delete Compliance - If candidate is soft-deleted, fulfilment activity must cease.

ARTICLE 3 - CLIENT OBLIGATIONS
3.1 Request Accuracy - Originating request details must be accurate and complete.
3.2 Payment - Client agrees to total_cost (${transaction.total_cost ?? '-'}) in ${currencyCode}.
3.3 Delivery Acceptance - Delivery must be accepted within agreed delivery window.
3.4 Delivery Address - Client is responsible for accurate and accessible delivery address.
3.5 Transaction Confirmation - Candidate selection constitutes formal acceptance.
3.5.1 selected_by_tx - ${transaction.id}
3.6 Dispute Window - Disputes must be raised within ${disputeWindowDays || '[X]'} business days.

ARTICLE 4 - LOGIST OBLIGATIONS
4.1 Offer Validity - Logistic offer must be valid at match creation.
4.2 Delivery Price - Delivery price is binding at ${transaction.delivery_price ?? '-'} ${currencyCode}.
4.3 Delivery Timeline - Delivery must be completed in ${transaction.delivery_days ?? '-'} days.
4.4 Liability in Transit - Logist assumes responsibility in transit.
4.5 Proof of Delivery - Verifiable proof of delivery is required.
4.6 No Logist Scenario - If logistic_offer_id is null, Factory and Client agree bilaterally.

ARTICLE 5 - PRICING & COST STRUCTURE
5.1 total_cost is binding and includes goods cost + delivery price + disclosed fees/taxes.
5.1.1 goods_cost: ${goodsCost} ${currencyCode}
5.1.2 payment_terms: ${paymentTerms}
5.2 All monetary values use ${currencyCode}.
5.3 Currency discrepancies use exchange rate at candidate creation timestamp.

ARTICLE 6 - SCORING & PERFORMANCE
6.1 reliability_score (${formatScore(transaction.reliability_score)}) and fitness_score (${formatScore(transaction.fitness_score)}) are indicative metrics.
6.2 Parties consent to performance recording for future eligibility.
6.3 Persistent underperformance may reduce match eligibility.

ARTICLE 7 - STATUS MANAGEMENT & LIFECYCLE
7.1 Current statuses:
- Candidate Status: ${transaction.candidate_status ?? '-'}
- Request Status: ${requestStatus}
- Transaction Status: ${transaction.status}

7.2 Status transitions are recorded via created_at/updated_at timestamps.
7.3 Candidate timestamps:
- candidate.created_at: ${candidateCreatedAt}
- candidate.updated_at: ${candidateUpdatedAt}
- candidate.deleted_at: ${candidateDeletedAt}

ARTICLE 8 - CANCELLATION & TERMINATION
8.1 Cancellation before CONFIRMED status may occur without penalty.
8.2 Post-CONFIRMED cancellation without cause may require cost recovery.
8.3 Logist cancellation after acceptance requires equivalent replacement or compensation.
8.4 Soft-deleted candidates are administratively cancelled.

ARTICLE 9 - GOVERNING LAW & DISPUTE RESOLUTION
9.1 Governing law: ${jurisdiction || '[JURISDICTION]'}.
9.2 Good-faith negotiation period: ${negotiationDays || '[X]'} days.
9.3 Platform-generated records are admissible evidence.

ARTICLE 10 - GENERAL PROVISIONS
10.1 Entire Agreement - This document and platform match record form entire agreement.
10.2 Amendments - Valid only via platform-confirmed status change or signed writing.
10.3 Severability - Remaining provisions remain enforceable.
10.4 Notices - Delivered via platform messaging or registered contact details.

SIGNATURES
Factory: ${transaction.factory_legal_name ?? ''}
Client: ${transaction.client_legal_name ?? ''}
Logist: ${transaction.logist_legal_name ?? ''}

Current signer (${transaction.my_role}): ${signerName || '[Type your full name below]'}
Date: ${contractDate}
`;
  }, [transaction, jurisdiction, negotiationDays, disputeWindowDays, signerName, contractDate]);

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="slide-up max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Contract Review & Signature</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Review the agreement, complete remaining blanks, then sign as {transaction.my_role}.
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

        <div className="mb-4 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-3">
          <p className="mb-2 text-xs text-[rgb(var(--muted))]">Contract completion fields</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[rgb(var(--muted))]">Governing jurisdiction</span>
              <input
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="e.g. England and Wales"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[rgb(var(--muted))]">Negotiation period (days)</span>
              <input
                type="number"
                min="1"
                value={negotiationDays}
                onChange={(e) => setNegotiationDays(e.target.value)}
                placeholder="10"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
              <span className="text-[11px] text-[rgb(var(--muted))]">Used in Article 9.2</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[rgb(var(--muted))]">Dispute window (business days)</span>
              <input
                type="number"
                min="1"
                value={disputeWindowDays}
                onChange={(e) => setDisputeWindowDays(e.target.value)}
                placeholder="5"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
              <span className="text-[11px] text-[rgb(var(--muted))]">Used in Article 3.6</span>
            </label>
          </div>
        </div>

        <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-4 text-xs leading-5 text-[rgb(var(--muted))]">
          {agreementText}
        </pre>

        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Type your full name to sign"
            className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-xl border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I agree to this contract
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !agreed || !signerName.trim()}
            onClick={() =>
              void onConfirm({
                signer_name: signerName.trim(),
                jurisdiction: jurisdiction.trim() || undefined,
                negotiation_days: negotiationDays ? Number(negotiationDays) : undefined,
                dispute_window_days: disputeWindowDays ? Number(disputeWindowDays) : undefined,
                contract_date: contractDateIso,
                rendered_contract_text: agreementText,
              })
            }
            className="btn btn-primary flex-1 text-sm"
          >
            {busy ? 'Signing...' : 'Sign Contract'}
          </button>
        </div>
      </div>
    </div>
  );
}
