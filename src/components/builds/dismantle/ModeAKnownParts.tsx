import React from 'react';
import { PCBuild } from '../../../types';
import { formatCurrency, calculateBuildPartsCost, formatReadableDate, getCategoryPresentation, getConditionDotColor } from '../../../utils/helpers';
import { useInventory } from '../../../context/InventoryContext';
import { usePrivacy } from '../../../context/PrivacyContext';
import { normalizePlatform } from '../../../utils/platformDisplay';

interface ModeAKnownPartsProps {
  build: PCBuild;
}

export const ModeAKnownParts: React.FC<ModeAKnownPartsProps> = ({ build }) => {
  const { state } = useInventory();
  const { hideSupplierNames } = usePrivacy();

  return (
    <div className="dismantle-known-parts">
      <div className="dismantle-summary">
        <span><em>Parts</em><strong>{build.parts.length}</strong></span>
        <span><em>Total Cost</em><strong>{formatCurrency(calculateBuildPartsCost(build))}</strong></span>
      </div>

      <div className="dismantle-ledger">
        <div className="dismantle-ledger-title">Parts returning to their original batches</div>
        {build.parts.map((part, idx) => {
          const component = state.components.find((candidate) => candidate.id === part.componentId);
          const entry = component?.purchaseHistory.find((candidate) => candidate.id === part.purchaseEntryId);
          const category = getCategoryPresentation(part.category);
          const details = [
            ...(component?.tags || []).filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0),
            typeof component?.specifications === 'string' && component.specifications.trim()
              ? component.specifications.trim()
              : undefined,
            entry?.condition,
            !hideSupplierNames && entry?.platform ? normalizePlatform(String(entry.platform)) : undefined,
            entry?.paymentMethod,
            entry?.date ? formatReadableDate(entry.date) || entry.date : undefined,
          ].filter(Boolean) as string[];

          return (
            <div key={`${part.componentId}-${part.purchaseEntryId || idx}`} className="dismantle-part-row">
              <span className={`dismantle-part-category ${category.textClass}`}>{category.label}</span>
              <div className="dismantle-part-main">
                <strong>{part.componentName}</strong>
                {details.length > 0 && (
                  <span>
                    {entry?.condition && <i className={`h-1.5 w-1.5 rounded-full ${getConditionDotColor(entry.condition)}`} />}
                    {details.join(' · ')}
                  </span>
                )}
              </div>
              <div className="dismantle-part-value">
                <strong>{formatCurrency(part.quantity * part.unitCostAtAssignment)}</strong>
                <span>{part.quantity > 1 ? `${part.quantity} × ${formatCurrency(part.unitCostAtAssignment)}` : formatCurrency(part.unitCostAtAssignment)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="dismantle-note">
        All {build.parts.length} allocated parts return to their exact original batches with condition and cost basis unchanged.
      </p>
    </div>
  );
};
