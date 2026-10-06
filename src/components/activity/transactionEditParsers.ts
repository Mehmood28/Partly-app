import { PaymentMethod, TransactionType } from '../../types';
import { isValidCalendarDate, parseStrictNumber } from '../builds/sellBuildParsers';
import { roundToCents } from '../../utils/helpers';

export const TRANSACTION_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'Cash',
  'E-Transfer',
  'PayPal',
  'Credit Card',
  'Debit',
  'Crypto',
  'Trade-In',
];

export interface TransactionEditInputs {
  type: TransactionType;
  title: string;
  customTitleOverride?: string;
  itemNameOrSummary: string;
  totalAmount: string;
  profitMargin: string;
  seller?: string;
  platform?: string;
  paymentMethod: string;
  dateSortable: string;
  detailsList?: string[];
}

export type PreparedTransactionEdit =
  | {
      success: true;
      value: {
        title: string;
        customTitleOverride?: string;
        itemNameOrSummary: string;
        totalAmount: number;
        profitMargin?: number;
        seller?: string;
        platform?: string;
        paymentMethod?: PaymentMethod;
        dateSortable: string;
        detailsList?: string[];
      };
    }
  | { success: false; error: string };

export const prepareTransactionEdit = (
  inputs: TransactionEditInputs
): PreparedTransactionEdit => {
  const title = inputs.title.trim();
  if (!title) return { success: false, error: 'Record title is required.' };

  const customTitleOverride = inputs.customTitleOverride !== undefined
    ? inputs.customTitleOverride.trim() || undefined
    : undefined;

  const itemNameOrSummary = inputs.itemNameOrSummary.trim();
  if (!itemNameOrSummary) return { success: false, error: 'Item or summary is required.' };

  const amountResult = parseStrictNumber(inputs.totalAmount);
  if (!amountResult.success || amountResult.value < 0) {
    return { success: false, error: 'Total amount must be a finite non-negative number.' };
  }

  let profitMargin: number | undefined;
  if (inputs.type === 'SALE') {
    const profitResult = parseStrictNumber(inputs.profitMargin);
    if (!profitResult.success) {
      return { success: false, error: 'Net profit must be a finite number.' };
    }
    profitMargin = profitResult.value;
  }

  const dateSortable = inputs.dateSortable.trim();
  if (!isValidCalendarDate(dateSortable)) {
    return { success: false, error: 'Date must be a valid calendar date.' };
  }

  const paymentMethodValue = inputs.paymentMethod.trim();
  if (
    paymentMethodValue &&
    !TRANSACTION_PAYMENT_METHODS.includes(paymentMethodValue as PaymentMethod)
  ) {
    return { success: false, error: 'Select a valid payment method.' };
  }

  const rawSeller = (inputs.seller !== undefined ? inputs.seller : inputs.platform) || '';
  const seller = rawSeller.trim() || undefined;

  return {
    success: true,
    value: {
      title,
      customTitleOverride,
      itemNameOrSummary,
      totalAmount: roundToCents(amountResult.value),
      profitMargin: profitMargin !== undefined ? roundToCents(profitMargin) : undefined,
      seller,
      platform: seller,
      paymentMethod: paymentMethodValue
        ? (paymentMethodValue as PaymentMethod)
        : undefined,
      dateSortable,
      detailsList: inputs.detailsList,
    },
  };
};
