import React, { useState } from 'react';
import { TransactionLogItem, PCBuild, InventoryComponent } from '../../types';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { ConfirmModal } from '../ConfirmModal';
import { TransactionCardHeader } from './TransactionCardHeader';
import { TransactionCardActions } from './TransactionCardActions';
import { PartSaleExpandedView } from './PartSaleExpandedView';
import { PurchaseExpandedView } from './PurchaseExpandedView';
import { TradeUpExpandedView } from './TradeUpExpandedView';
import { classifyTransaction } from '../../utils/transactionClassification';
import { parseBatchItem } from './activityHelpers';
import { calculateProfitMarginPercent } from '../../utils/financialDisplay';

export interface TransactionActivityCardProps {
  isActive?: boolean;
  tx: TransactionLogItem;
  isExpanded?: boolean;
  onToggle?: () => void;
  onEdit: (tx: TransactionLogItem) => void;
  onDelete: (id: string) => void;
}

export const TransactionActivityCard: React.FC<TransactionActivityCardProps> = React.memo(({
  isActive = true,
  tx,
  isExpanded: propIsExpanded,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const { state, relistPartSale, relistBulkPartSale } = useInventory();
  const { showToast } = useToast();
  const { hideSupplierNames } = usePrivacy();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isRelistConfirmOpen, setIsRelistConfirmOpen] = useState(false);
  const [isRelistBulkConfirmOpen, setIsRelistBulkConfirmOpen] = useState(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggle) onToggle();
    else setInternalExpanded(!internalExpanded);
  };

  const classification = classifyTransaction(tx, state.builds);
  const isExchange = classification.isExchange;
  const isPartSale = classification.isPartSale;
  const isPurchase = classification.isPurchase;
  const isBulkPurchase = classification.isBulkPurchase;
  // Older purchased-PC records did not always save purchaseKind. Resolve a
  // linked build only when every stored link that is present agrees.
  const relatedBuildId = tx.relatedComponentId?.trim();
  const purchasedBuild: PCBuild | undefined = isPurchase
    ? state.builds.find((build) => {
        const purchaseTransactionId = build.purchaseTransactionId?.trim();
        const matchesRelatedBuild = !relatedBuildId || build.id === relatedBuildId;
        const matchesPurchaseTransaction = !purchaseTransactionId || purchaseTransactionId === tx.id;
        const hasMatchingLink = relatedBuildId ? build.id === relatedBuildId : purchaseTransactionId === tx.id;
        return matchesRelatedBuild && matchesPurchaseTransaction && hasMatchingLink;
      })
    : undefined;
  const hasConflictingLiveBuildLinks = isPurchase && !!relatedBuildId && state.builds.some((build) =>
    (build.id === relatedBuildId && !!build.purchaseTransactionId && build.purchaseTransactionId !== tx.id) ||
    (build.purchaseTransactionId === tx.id && build.id !== relatedBuildId)
  );
  const isPCPurchase = isPurchase && (tx.purchaseKind === 'PC' || !!purchasedBuild);
  const singletonPurchaseItem =
    isPurchase && !isBulkPurchase && tx.detailsList?.length === 1
      ? parseBatchItem(tx.detailsList[0], state.components, tx)
      : undefined;

  // Trade-up basis resolution
  let outgoingCostBasis = tx.outgoingCostBasis;
  let cashPaidOnTop = tx.cashPaidOnTop;
  let incomingCostBasis = tx.incomingCostBasis;

  if (isExchange) {
    if (outgoingCostBasis === undefined && tx.detailsList) {
      for (const d of tx.detailsList) {
        const outMatch = d.match(/Outgoing:.*=\s*\$([\d\.,]+)/i) || d.match(/Outgoing:.*\$([\d\.,]+)/i);
        if (outMatch) outgoingCostBasis = parseFloat(outMatch[1].replace(/,/g, ''));
        
        const cashMatch = d.match(/Cash Paid on Top:\s*\$([\d\.,]+)/i) || d.match(/Cash Paid:\s*\$([\d\.,]+)/i);
        if (cashMatch) cashPaidOnTop = parseFloat(cashMatch[1].replace(/,/g, ''));
        
        const inMatch = d.match(/Incoming:.*New Cost Basis:\s*\$([\d\.,]+)/i) || d.match(/Incoming:.*\$([\d\.,]+)/i);
        if (inMatch) incomingCostBasis = parseFloat(inMatch[1].replace(/,/g, ''));
      }
    }
    if (cashPaidOnTop === undefined && tx.totalAmount !== undefined) {
      cashPaidOnTop = tx.totalAmount;
    }
    if (outgoingCostBasis === undefined && incomingCostBasis !== undefined && cashPaidOnTop !== undefined) {
      outgoingCostBasis = Math.max(0, incomingCostBasis - cashPaidOnTop);
    }
    if (incomingCostBasis === undefined && outgoingCostBasis !== undefined) {
      incomingCostBasis = outgoingCostBasis + (cashPaidOnTop || 0);
    }
  }

  // Clean Display Title
  let displayTitle = tx.title || '';
  let subCategoryLabel = '';
  if (isExchange) {
    displayTitle = tx.itemNameOrSummary ? String(tx.itemNameOrSummary) : (tx.title ? String(tx.title).replace(/^Trade Up:\s*/i, '') : 'Trade Up');
    subCategoryLabel = 'TRADE UP';
  } else if (isPartSale) {
    displayTitle = tx.itemNameOrSummary ? String(tx.itemNameOrSummary) : (tx.title ? String(tx.title).replace(/^(Sold \(Part\)|Part Sold):\s*/i, '') : 'Part Sale');
    subCategoryLabel = 'PART SOLD';
  } else if (isPurchase) {
    displayTitle = singletonPurchaseItem?.itemName || tx.itemNameOrSummary || (tx.title ? String(tx.title).replace(/^Purchased:\s*/i, '') : 'Purchase');
    if (hideSupplierNames) {
      if (tx.platform) {
        const escaped = tx.platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        displayTitle = displayTitle
          .replace(new RegExp(`^Bulk Purchase:\\s*${escaped}$`, 'i'), 'Bulk Purchase')
          .replace(new RegExp(`\\s+from\\s+${escaped}$`, 'i'), '')
          .trim();
      }
      displayTitle = displayTitle
        .replace(/^Bulk Purchase:\s*.+$/i, 'Bulk Purchase')
        .replace(/^(Bulk added\s+\d+\s+items?)\s+from\s+.+$/i, '$1');
    }
    subCategoryLabel = isPCPurchase ? 'PC PURCHASE' : 'PURCHASE';
  }

  // Linked component for part sales, single purchases & exchanges
  const matchedComp: InventoryComponent | undefined = (!isExchange && tx.relatedComponentId)
    ? state.components.find(c => c.id === tx.relatedComponentId)
    : singletonPurchaseItem?.comp;

  const matchedOutgoingComp: InventoryComponent | undefined = isExchange && tx.outgoingComponentId
    ? state.components.find(c => c.id === tx.outgoingComponentId)
    : undefined;

  const matchedIncomingComp: InventoryComponent | undefined = isExchange && tx.incomingComponentId
    ? state.components.find(c => c.id === tx.incomingComponentId)
    : undefined;

  const matchedTradeInComp: InventoryComponent | undefined = isPartSale && tx.incomingComponentId
    ? state.components.find(c => c.id === tx.incomingComponentId)
    : undefined;

  // Financial Calculations
  let partsCost = 0;
  let salePrice = tx.totalAmount ?? 0;
  let netProfit = tx.profitMargin ?? 0;
  let profitMarginPercent = 0;

  if (isPartSale) {
    netProfit = tx.profitMargin ?? 0;
    partsCost = Math.max(0, salePrice - netProfit);
    profitMarginPercent = calculateProfitMarginPercent(netProfit, salePrice);
  }

  const saleDate = tx.dateSortable || tx.timestamp;
  const buyerName = tx.buyerName;
  const platform = tx.platform;
  const paymentMethod = tx.paymentMethod;

  // Condition string for purchases. Exact batch identity or a stored snapshot
  // may supply it; current-inventory heuristics must not rewrite history.
  let conditionStr = '';
  if (isPurchase) {
    const relatedPurchaseEntryId = tx.relatedPurchaseEntryId?.trim();
    const exactPurchaseEntry = relatedPurchaseEntryId
      ? matchedComp?.purchaseHistory?.find((entry) => entry.id === relatedPurchaseEntryId)
      : undefined;
    const storedSnapshot = tx.originalPurchaseEntrySnapshot;
    const matchingSnapshot = storedSnapshot && (!relatedPurchaseEntryId || storedSnapshot.id === relatedPurchaseEntryId)
      ? storedSnapshot
      : undefined;
    conditionStr = exactPurchaseEntry?.condition || matchingSnapshot?.condition || '';
    if (!conditionStr && (isBulkPurchase || (tx.quantity && tx.quantity > 1 && !matchedComp))) {
      conditionStr = 'MIXED';
    }
  }

  const parsedPurchaseItems = isPurchase
    ? (tx.detailsList || []).map((detail) => parseBatchItem(detail, state.components, tx))
    : [];
  const usablePurchaseValue = (value?: string) => {
    const normalized = String(value || '').trim();
    return normalized && !/^(n\/?a|unknown|none|—|-)$/i.test(normalized) ? normalized : undefined;
  };
  const resolvedPurchaseValue = (
    values: Array<string | undefined>,
    fallback?: string,
  ) => {
    const uniqueValues = [...new Set(values.map(usablePurchaseValue).filter(Boolean) as string[])];
    if (uniqueValues.length === 1) return uniqueValues[0];
    if (uniqueValues.length > 1) return 'Mixed';
    return usablePurchaseValue(fallback);
  };
  const purchasePlatform = isPurchase
    ? resolvedPurchaseValue(parsedPurchaseItems.map((item) => item.platform), tx.platform)
    : platform;
  const purchasePaymentMethod = isPurchase
    ? resolvedPurchaseValue(parsedPurchaseItems.map((item) => item.paymentMethod), tx.paymentMethod)
    : paymentMethod;
  const purchaseCondition = isPurchase
    ? resolvedPurchaseValue(parsedPurchaseItems.map((item) => item.condition), conditionStr)
    : conditionStr;

  return (
    <div className="app-panel transaction-card group flex flex-col transition-colors">
      {/* Unexpanded (Collapsed) Header */}
      <TransactionCardHeader
        tx={tx}
        displayTitle={displayTitle}
        subCategoryLabel={subCategoryLabel}
        isPartSale={isPartSale}
        isPurchase={isPurchase}
        isBulkPurchase={isBulkPurchase}
        isPCPurchase={isPCPurchase}
        isExchange={isExchange}
        outgoingCostBasis={outgoingCostBasis}
        cashPaidOnTop={cashPaidOnTop}
        incomingCostBasis={incomingCostBasis}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        partsCost={partsCost}
        salePrice={salePrice}
        netProfit={netProfit}
        profitMarginPercent={profitMarginPercent}
        platform={isPurchase && hideSupplierNames ? undefined : purchasePlatform}
        paymentMethod={isPurchase ? purchasePaymentMethod : paymentMethod}
        buyerName={buyerName}
        saleDate={saleDate}
        matchedComp={matchedComp}
        conditionStr={purchaseCondition}
      />

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="record-expanded space-y-4">
          {/* Action Buttons Row - Only for real sales / purchases */}
          {!isExchange && (
            <TransactionCardActions
              tx={tx}
              isPartSale={isPartSale}
              onEdit={onEdit}
              onDelete={onDelete}
              onRelistPart={() => setIsRelistConfirmOpen(true)}
              onRelistBulkSale={tx.bulkSaleGroupId ? () => setIsRelistBulkConfirmOpen(true) : undefined}
            />
          )}

          {/* Relist Part Confirmation Modal */}
          {isPartSale && (
            <ConfirmModal
              isOpen={isRelistConfirmOpen && isActive}
              title="Relist Part"
              message="Relist this part back into stock?"
              confirmText="Relist Part"
              cancelText="Cancel"
              variant="emerald"
              onConfirm={() => {
                const result = relistPartSale(tx.id);
                setIsRelistConfirmOpen(false);
                showToast(
                  result.success
                    ? 'Part relisted successfully to Stock!'
                    : result.error || 'Part could not be relisted.',
                  result.success ? 'success' : 'error'
                );
              }}
              onCancel={() => setIsRelistConfirmOpen(false)}
            />
          )}

          {/* Relist Entire Bulk Sale Confirmation Modal */}
          {isPartSale && tx.bulkSaleGroupId && (
            <ConfirmModal
              isOpen={isRelistBulkConfirmOpen && isActive}
              title="Relist Entire Bulk Sale"
              message="Relist all parts from this bulk sale back into stock?"
              confirmText="Relist Entire Bulk Sale"
              cancelText="Cancel"
              variant="emerald"
              onConfirm={() => {
                relistBulkPartSale(tx.bulkSaleGroupId!);
                setIsRelistBulkConfirmOpen(false);
                showToast('All parts from bulk sale relisted successfully to Stock!');
              }}
              onCancel={() => setIsRelistBulkConfirmOpen(false)}
            />
          )}

          {/* Trade-Up / Exchange Expanded View */}
          {isExchange && (
            <TradeUpExpandedView
              tx={tx}
              outgoingCostBasis={outgoingCostBasis || 0}
              cashPaidOnTop={cashPaidOnTop || 0}
              incomingCostBasis={incomingCostBasis || 0}
              matchedOutgoingComp={matchedOutgoingComp}
              matchedIncomingComp={matchedIncomingComp}
            />
          )}

          {/* Part Sale Expanded View */}
          {isPartSale && (
            <PartSaleExpandedView
              tx={tx}
              matchedComp={matchedComp}
              matchedTradeInComp={matchedTradeInComp}
              partsCost={partsCost}
              salePrice={salePrice}
              netProfit={netProfit}
              profitMarginPercent={profitMarginPercent}
              platform={platform}
              paymentMethod={paymentMethod}
              buyerName={buyerName}
              saleDate={saleDate}
            />
          )}

          {/* Purchase Expanded View */}
          {isPurchase && (
            <PurchaseExpandedView
              tx={tx}
              isBulkPurchase={isBulkPurchase}
              isPCPurchase={isPCPurchase}
              matchedComp={matchedComp}
              purchasedBuild={purchasedBuild}
              hasConflictingLiveBuildLinks={hasConflictingLiveBuildLinks}
              components={state.components}
            />
          )}

        </div>
      )}
    </div>
  );
});
