import type { ReactNode } from 'react';
import type { WorkflowTransaction } from './authClient';
import { formatDateTime, formatMoney } from './formatting';
import type { Locale } from './i18n';
import { statusLabel } from './status';

/** The contract facts every party sees when they open an order. */
export function orderFacts(
  tx: WorkflowTransaction,
  e: (text: string) => string,
  locale: Locale
): [string, ReactNode][] {
  return [
    [e('Contract'), tx.contract_reference],
    [e('Contract date'), tx.contract_date ? formatDateTime(locale, tx.contract_date) : null],
    [e('Customer'), tx.client_legal_name],
    [e('Factory'), tx.factory_legal_name],
    [e('Carrier'), tx.logist_legal_name],
    [e('Quantity'), tx.quoted_quantity],
    [e('Goods cost'), formatMoney(locale, tx.goods_cost, tx.currency_code)],
    [e('Delivery'), formatMoney(locale, tx.delivery_price, tx.currency_code)],
    [e('Total'), formatMoney(locale, tx.total_cost, tx.currency_code)],
    [e('Delivery days'), tx.delivery_days],
    [e('Payment'), statusLabel(locale, tx.payment_status)],
    [e('Payment terms'), tx.payment_terms],
    [e('Updated'), formatDateTime(locale, tx.updated_at)],
  ];
}
