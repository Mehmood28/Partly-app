import React, { useState } from 'react';
import { TransactionLogItem, PCBuild, InventoryComponent } from '../../types';
import { calculateBuildPartsCost } from '../../utils/helpers';
import { generateInvoice } from '../../utils/invoiceGenerator';
import { useInventory } from '../../context/InventoryContext';
import { useToast } from '../../context/ToastContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { ConfirmModal } from '../ConfirmModal';
import { TransactionCardHeader } from './TransactionCardHeader';
import { TransactionCardActions } from './TransactionCardActions';
import { PCSaleExpandedView } from './PCSaleExpandedView';
import { PartSaleExpandedView } from './PartSaleExpandedView';
import { PurchaseExpandedView } from './PurchaseExpandedView';
import { BuildAllocationExpandedView } from './BuildAllocationExpandedView';
import { TradeUpExpandedView } from './TradeUpExpandedView';
import { classifyTransaction } from '../../utils/transactionClassification';
import { parseBatchItem } from './activityHelpers';
import { calculateProfitMarginPercent } from '../../utils/financialDisplay';

export interface TransactionActivityCardProps {
  tx: TransactionLogItem;
  isExpanded?: boolean;
  onToggle?: () => void;
  onEdit: (tx: TransactionLogItem) => void;
  onDelete: (id: string) => void;
}

export const TransactionActivityCard: React.FC<TransactionActivityCardProps> = React.memo(({
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
  const [isInvoiceConfirmOpen, setIsInvoiceConfirmOpen] = useState(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggle) onToggle();
    else setInternalExpanded(!internalExpanded);
  };

  const classification = classifyTransaction(tx, state.builds);
  const isExchange = classification.isExchange;
  const isSale = !isExchange && tx.type === 'SALE';
  const isPurchase = !isExchange && tx.type === 'PURCHASE';
  const isBuildAllocation = !isExchange && tx.type === 'BUILD_ALLOCATION';

  // Check if this is a PC sale
  const matchedBuild: PCBuild | undefined = (isSale && tx.relatedComponentId)
    ? state.builds.find(b => b.id === tx.relatedComponentId)
    : undefined;

  const isPCSale = isSale && (
    !!matchedBuild ||
    (tx.title && (tx.title.startsWith('Sold (PC)') || tx.title.startsWith('PC Sold'))) || 
    (tx.relatedComponentId && tx.relatedComponentId.startsWith('build-')) ||
    (tx.detailsList && tx.detailsList.length > 0 && tx.detailsList.some(d => d && d.includes('x ')))
  );

  const isPartSale = isSale && !isPCSale;

  const isBulkPurchase = classification.isBulkPurchase;
  const isPCPurchase = isPurchase && tx.purchaseKind === 'PC';
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
  } else if (isPCSale) {
    displayTitle = matchedBuild?.name || (tx.itemNameOrSummary ? String(tx.itemNameOrSummary).replace(/^PC Sold:\s*/i, '') : (tx.title ? String(tx.title).replace(/^(Sold \(PC\)|PC Sold):\s*/i, '') : 'PC Sale'));
    subCategoryLabel = 'PC BUILD';
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
  } else if (isBuildAllocation) {
    displayTitle = tx.itemNameOrSummary || (tx.title ? String(tx.title).replace(/^(PC Built|Build Allocation):\s*/i, '') : 'PC Built');
    subCategoryLabel = 'ASSEMBLED';
  }

  // Linked component for part sales, single purchases & exchanges
  const matchedComp: InventoryComponent | undefined = (!isPCSale && !isExchange && tx.relatedComponentId)
    ? state.components.find(c => c.id === tx.relatedComponentId)
    : singletonPurchaseItem?.comp;

  const matchedOutgoingComp: InventoryComponent | undefined = isExchange && tx.outgoingComponentId
    ? state.components.find(c => c.id === tx.outgoingComponentId)
    : undefined;

  const matchedIncomingComp: InventoryComponent | undefined = isExchange && tx.incomingComponentId
    ? state.components.find(c => c.id === tx.incomingComponentId)
    : undefined;

  // Financial Calculations
  let partsCost = 0;
  let salePrice = tx.totalAmount ?? 0;
  let netProfit = tx.profitMargin ?? 0;
  let profitMarginPercent = 0;

  if (isPCSale) {
    if (matchedBuild) {
      partsCost = calculateBuildPartsCost(matchedBuild);
      salePrice = tx.totalAmount ?? matchedBuild.salePrice ?? 0;
      netProfit = tx.profitMargin !== undefined ? tx.profitMargin : (salePrice - partsCost);
    } else {
      if (tx.detailsList && tx.detailsList.length > 0) {
        let sum = 0;
        tx.detailsList.forEach(d => {
          if (!d) return;
          const match = d.match(/\$([\d\.,]+)\/ea/);
          const qtyMatch = d.match(/^(\d+)x/);
          if (match) {
            const unit = parseFloat(match[1].replace(/,/g, '')) || 0;
            const q = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
            sum += unit * q;
          }
        });
        partsCost = sum > 0 ? sum : Math.max(0, salePrice - (tx.profitMargin ?? 0));
      } else {
        partsCost = Math.max(0, salePrice - (tx.profitMargin ?? 0));
      }
      netProfit = tx.profitMargin ?? (salePrice - partsCost);
    }
    profitMarginPercent = calculateProfitMarginPercent(netProfit, salePrice);
  } else if (isPartSale) {
    netProfit = tx.profitMargin ?? 0;
    partsCost = Math.max(0, salePrice - netProfit);
    profitMarginPercent = calculateProfitMarginPercent(netProfit, salePrice);
  }

  // Details for Warranty & Market Duration on PC Sales
  const saleDate = matchedBuild?.saleDate || tx.dateSortable || tx.timestamp;
  const daysOnMarket = matchedBuild?.daysOnMarket;
  const buyerName = matchedBuild?.buyerName || tx.buyerName;
  const platform = matchedBuild?.platformSoldOn || tx.platform;
  const paymentMethod = matchedBuild?.paymentMethod || tx.paymentMethod;
  const imageUrl = matchedBuild?.imageUrl;

  // Condition string for purchases
  let conditionStr = '';
  if (isPurchase) {
    if (matchedComp && matchedComp.purchaseHistory && matchedComp.purchaseHistory.length > 0) {
      const ph = matchedComp.purchaseHistory.find(p => {
        const matchesDate = p.date === tx.dateSortable || p.date === tx.timestamp;
        const matchesPlatform = !tx.platform || p.platform === tx.platform;
        const matchesPayment = !tx.paymentMethod || p.paymentMethod === tx.paymentMethod;
        const matchesPrice = !tx.totalAmount || Math.abs(p.totalPrice - tx.totalAmount) < 0.01 || Math.abs((p.unitPrice * (tx.quantity || 1)) - tx.totalAmount) < 0.01;
        return matchesDate && (matchesPlatform || matchesPayment || matchesPrice);
      }) || matchedComp.purchaseHistory.find(p => p.date === tx.dateSortable || p.date === tx.timestamp) || matchedComp.purchaseHistory[0];

      if (ph) conditionStr = ph.condition;
    }
    if (!conditionStr && (isBulkPurchase || (tx.quantity && tx.quantity > 1 && !matchedComp))) {
      conditionStr = 'MIXED';
    }
  }

  const executeDownloadInvoice = () => {
    if (matchedBuild) {
      generateInvoice(matchedBuild, state.components);
    } else if (isPCSale && tx.detailsList) {
      const syntheticBuild: PCBuild = {
        id: tx.id,
        name: displayTitle,
        parts: tx.detailsList.map((d, i) => {
          const match = d.match(/^(?:(\d+)x\s+)?(.*?)(?:\s+\(\$([\d\.,]+)\/ea\))?$/);
          return {
            componentId: `comp-${i}`,
            componentName: match ? match[2] : d,
            category: 'Other',
            quantity: match && match[1] ? parseInt(match[1], 10) : 1,
            unitCostAtAssignment: match && match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0,
          };
        }),
        status: 'Sold',
        createdDate: tx.dateSortable || tx.timestamp,
        saleDate: tx.dateSortable || tx.timestamp,
        salePrice: tx.totalAmount,
        platformSoldOn: tx.platform,
        paymentMethod: tx.paymentMethod,
      };
      generateInvoice(syntheticBuild, state.components);
    }
  };

  const handleDownloadInvoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInvoiceConfirmOpen(true);
  };

  return (
    <div className="app-panel transaction-card group flex flex-col transition-colors">
      {/* Unexpanded (Collapsed) Header */}
      <TransactionCardHeader
        tx={tx}
        displayTitle={displayTitle}
        subCategoryLabel={subCategoryLabel}
        imageUrl={imageUrl}
        isPCSale={isPCSale}
        isPartSale={isPartSale}
        isPurchase={isPurchase}
        isBuildAllocation={isBuildAllocation}
        isBulkPurchase={isBulkPurchase}
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
        platform={isPurchase && hideSupplierNames ? undefined : platform}
        paymentMethod={paymentMethod}
        buyerName={buyerName}
        saleDate={saleDate}
        daysOnMarket={daysOnMarket}
        matchedComp={matchedComp}
        conditionStr={conditionStr}
      />

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="record-expanded space-y-4">
          {/* Action Buttons Row - Only for real sales / purchases */}
          {!isExchange && (
            <TransactionCardActions
              tx={tx}
              isPCSale={isPCSale}
              hasLinkedBuild={!!matchedBuild}
              isPartSale={isPartSale}
              onEdit={onEdit}
              onDelete={onDelete}
              onDownloadInvoice={handleDownloadInvoice}
              onRelistPart={() => setIsRelistConfirmOpen(true)}
              onRelistBulkSale={tx.bulkSaleGroupId ? () => setIsRelistBulkConfirmOpen(true) : undefined}
            />
          )}

          {/* Relist Part Confirmation Modal */}
          {isPartSale && (
            <ConfirmModal
              isOpen={isRelistConfirmOpen}
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
              isOpen={isRelistBulkConfirmOpen}
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

          {/* Invoice Confirmation Modal */}
          {(isPCSale || isPartSale) && (
            <ConfirmModal
              isOpen={isInvoiceConfirmOpen}
              title="Download Invoice?"
              message={`Generate and download a PDF invoice for "${displayTitle}"?`}
              confirmText="Download Invoice"
              variant="violet"
              onConfirm={() => {
                setIsInvoiceConfirmOpen(false);
                executeDownloadInvoice();
              }}
              onCancel={() => setIsInvoiceConfirmOpen(false)}
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

          {/* PC Sale Expanded View */}
          {isPCSale && (
            <PCSaleExpandedView
              tx={tx}
              matchedBuild={matchedBuild}
              partsCost={partsCost}
              salePrice={salePrice}
              netProfit={netProfit}
              profitMarginPercent={profitMarginPercent}
              platform={platform}
              paymentMethod={paymentMethod}
              buyerName={buyerName}
              saleDate={saleDate}
              components={state.components}
            />
          )}

          {/* Part Sale Expanded View */}
          {isPartSale && (
            <PartSaleExpandedView
              tx={tx}
              matchedComp={matchedComp}
              partsCost={partsCost}
              salePrice={salePrice}
              netProfit={netProfit}
              profitMarginPercent={profitMarginPercent}
            />
          )}

          {/* Purchase Expanded View */}
          {isPurchase && (
            <PurchaseExpandedView
              tx={tx}
              isBulkPurchase={isBulkPurchase}
              matchedComp={matchedComp}
              components={state.components}
            />
          )}

          {/* PC Build Allocation Expanded View */}
          {isBuildAllocation && (
            <BuildAllocationExpandedView
              tx={tx}
            />
          )}
        </div>
      )}
    </div>
  );
});
