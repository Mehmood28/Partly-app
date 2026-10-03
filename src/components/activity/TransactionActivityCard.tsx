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
import { formatCategoryPlural } from '../../utils/helpers';
import { generateBuildTitleFromParts } from '../../utils/buildTitle';

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

  const purchaseNames = [
    purchasedBuild?.name,
    tx.itemNameOrSummary,
    tx.title?.replace(/^Purchased:\s*/i, ''),
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  const sourceBuildId = tx.relatedComponentId?.trim() || purchasedBuild?.id;
  const orphanedBuild = !!sourceBuildId && !purchasedBuild;
  const pcPartedOutItems = isPCPurchase && !hasConflictingLiveBuildLinks
    ? state.components.flatMap((component) => component.purchaseHistory
      .filter((entry) => {
        const entrySourceTransactionId = entry.sourcePurchaseTransactionId?.trim();
        const entrySourceBuildId = entry.sourcePurchasedBuildId?.trim();
        if (entrySourceTransactionId || entrySourceBuildId) {
          if (orphanedBuild && !entrySourceTransactionId) return false;
          const transactionMatches = !entrySourceTransactionId || entrySourceTransactionId === tx.id;
          const buildMatches = !entrySourceBuildId || (!!sourceBuildId && entrySourceBuildId === sourceBuildId);
          return transactionMatches && buildMatches;
        }
        return !orphanedBuild && !!entry.notes && purchaseNames.some((name) =>
          entry.notes!.toLowerCase().includes(`purchased pc: ${name}`)
        );
      })
      .map((entry) => ({
        category: component.category,
        itemName: component.name,
        condition: entry.condition,
        platform: entry.platform,
        paymentMethod: entry.paymentMethod,
      })))
    : [];

  const parsedPurchaseItems = isPurchase
    ? (tx.detailsList || []).map((detail) => parseBatchItem(detail, state.components, tx))
    : [];

  const effectivePurchaseItems = isPCPurchase
    ? [...(purchasedBuild?.acquisitionComponentBreakdown?.map((item) => ({
        category: item.category,
        itemName: item.name,
        condition: undefined,
        platform: tx.platform,
        paymentMethod: tx.paymentMethod,
      })) || []), ...pcPartedOutItems]
    : parsedPurchaseItems;

  // Linked component for part sales, single purchases & exchanges
  const matchedComp: InventoryComponent | undefined = (!isExchange && tx.relatedComponentId)
    ? state.components.find(c => c.id === tx.relatedComponentId)
    : (singletonPurchaseItem?.comp || (isPurchase && tx.itemNameOrSummary ? state.components.find(c => {
        const cName = String(c.name || '').toLowerCase().trim();
        const tName = String(tx.itemNameOrSummary || '').toLowerCase().trim();
        return cName === tName || (cName && tName && (cName.includes(tName) || tName.includes(cName)));
      }) : undefined));

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
    subCategoryLabel = isPCPurchase ? 'PC PURCHASE' : 'PURCHASE';
    if (isPCPurchase || purchasedBuild) {
      const allOriginalParts = effectivePurchaseItems.map(p => ({
        category: p.category as any,
        componentName: p.itemName,
      }));
      const hasCpuOrGpu = allOriginalParts.some(p => p.category === 'CPU' || p.category === 'GPU');
      let originalGeneratedName = '';
      if (hasCpuOrGpu) {
        originalGeneratedName = generateBuildTitleFromParts(allOriginalParts);
      }
      const rawPcName = originalGeneratedName || tx.itemNameOrSummary || tx.title?.replace(/^Purchased:\s*/i, '') || purchasedBuild?.name || 'PC';
      const cleanPCName = String(rawPcName).replace(/^Purchased\s*(PC:?)?\s*/i, '').trim();
      displayTitle = `Purchased PC: ${cleanPCName || 'Custom PC'}`;
    } else {
      const detailItems = parsedPurchaseItems;
      const totalQty = tx.quantity || tx.relatedComponentQty || (detailItems.length > 0 ? detailItems.reduce((acc, it) => acc + (it.quantity || 1), 0) : singletonPurchaseItem?.quantity) || 1;
      const itemNames = Array.from(new Set(detailItems.map(it => it.itemName).filter(Boolean)));
      const categories = Array.from(new Set(detailItems.map(it => it.category).filter((c) => Boolean(c) && c !== 'Other')));

      if (detailItems.length > 0) {
        if (detailItems.length === 1 || itemNames.length === 1) {
          const singleName = detailItems[0].itemName.replace(/^\d+x\s+/i, '');
          displayTitle = totalQty > 1 ? `Purchased ${totalQty}x ${singleName}` : `Purchased ${singleName}`;
        } else if (categories.length === 1) {
          const catPlural = formatCategoryPlural(categories[0]);
          displayTitle = `Purchased ${totalQty}x ${catPlural}`;
        } else {
          displayTitle = `Purchased Mixed Parts (${totalQty} ${totalQty === 1 ? 'Part' : 'Parts'})`;
        }
      } else if (singletonPurchaseItem) {
        const singleName = singletonPurchaseItem.itemName.replace(/^\d+x\s+/i, '');
        displayTitle = totalQty > 1 ? `Purchased ${totalQty}x ${singleName}` : `Purchased ${singleName}`;
      } else if (matchedComp) {
        const compName = matchedComp.name.replace(/^\d+x\s+/i, '');
        displayTitle = totalQty > 1 ? `Purchased ${totalQty}x ${compName}` : `Purchased ${compName}`;
      } else if (tx.itemNameOrSummary) {
        const raw = String(tx.itemNameOrSummary).trim();
        if (/^Bulk added\s+\d+\s+items?/i.test(raw) || /^Bulk purchase/i.test(raw)) {
          if (categories.length === 1) {
            const catPlural = formatCategoryPlural(categories[0]);
            displayTitle = `Purchased ${totalQty}x ${catPlural}`;
          } else {
            displayTitle = `Purchased Mixed Parts (${totalQty} ${totalQty === 1 ? 'Part' : 'Parts'})`;
          }
        } else {
          const clean = raw.replace(/^Purchased:?\s*/i, '').trim();
          const cleanWithoutQty = clean.replace(/^\d+x\s+/i, '');
          displayTitle = totalQty > 1 ? `Purchased ${totalQty}x ${cleanWithoutQty}` : `Purchased ${clean}`;
        }
      } else {
        displayTitle = totalQty > 1 ? `Purchased ${totalQty}x Parts` : `Purchased Part`;
      }
    }
  }

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
    partsCost = tx.soldUnitCost !== undefined
      ? tx.soldUnitCost * (tx.quantity || 1)
      : Math.max(0, salePrice - netProfit);
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

    if (!conditionStr && matchedComp?.purchaseHistory && matchedComp.purchaseHistory.length > 0) {
      const txDate = tx.dateSortable || tx.timestamp;
      const dateMatch = matchedComp.purchaseHistory.find((entry) => entry.date === txDate || entry.platform === tx.platform);
      if (dateMatch?.condition) {
        conditionStr = dateMatch.condition;
      } else {
        const uniqueConditions = [...new Set(matchedComp.purchaseHistory.map((e) => e.condition).filter(Boolean))];
        if (uniqueConditions.length === 1) {
          conditionStr = uniqueConditions[0];
        } else if (uniqueConditions.length > 1) {
          conditionStr = 'MIXED';
        }
      }
    }

    if (!conditionStr && (isBulkPurchase || (tx.quantity && tx.quantity > 1))) {
      conditionStr = 'MIXED';
    }
  }

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
    if (uniqueValues.length > 1) return 'MIXED';
    return usablePurchaseValue(fallback);
  };
  const purchasePlatform = isPurchase
    ? resolvedPurchaseValue(effectivePurchaseItems.map((item) => item.platform), tx.platform)
    : platform;
  const purchasePaymentMethod = isPurchase
    ? resolvedPurchaseValue(effectivePurchaseItems.map((item) => item.paymentMethod), tx.paymentMethod)
    : paymentMethod;
  
  const itemConditions = effectivePurchaseItems.map((item) => item.condition).filter(Boolean);
  let purchaseCondition = conditionStr;
  if (itemConditions.length > 0) {
    const uniqueItemConditions = [...new Set(itemConditions)];
    if (uniqueItemConditions.length === 1) {
      purchaseCondition = uniqueItemConditions[0];
    } else if (uniqueItemConditions.length > 1) {
      purchaseCondition = 'MIXED';
    }
  }
  if (isPurchase && (!purchaseCondition || purchaseCondition === '—' || purchaseCondition === '-')) {
    if (isBulkPurchase || (tx.quantity && tx.quantity > 1)) {
      purchaseCondition = 'MIXED';
    } else if (matchedComp?.purchaseHistory?.[0]?.condition) {
      purchaseCondition = matchedComp.purchaseHistory[0].condition;
    } else {
      purchaseCondition = 'MIXED';
    }
  }

  const parsedCategories = effectivePurchaseItems.map((item) => item.category).filter((c) => Boolean(c) && c !== 'Other');
  let resolvedCategory = '';
  if (isPCPurchase) {
    resolvedCategory = 'PC';
  } else if (parsedCategories.length > 0) {
    const uniqueCats = [...new Set(parsedCategories)];
    if (uniqueCats.length === 1) {
      resolvedCategory = uniqueCats[0];
    } else {
      resolvedCategory = 'Bulk';
    }
  } else if (matchedComp?.category) {
    resolvedCategory = matchedComp.category;
  } else if (isBulkPurchase) {
    resolvedCategory = 'Bulk';
  }

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
        categoryStr={resolvedCategory}
      />

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="record-expanded flex flex-col">
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
