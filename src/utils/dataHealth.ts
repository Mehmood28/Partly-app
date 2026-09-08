import { AppState } from '../types';

export type DataHealthSeverity = 'warning' | 'info';

export interface DataHealthIssue {
  code:
    | 'DUPLICATE_COMPONENT_ID'
    | 'DUPLICATE_BUILD_ID'
    | 'DUPLICATE_TRANSACTION_ID'
    | 'DUPLICATE_PURCHASE_ENTRY_ID'
    | 'MISSING_COMPONENT_REFERENCE'
    | 'MISSING_PURCHASE_ENTRY_REFERENCE'
    | 'UNLINKED_ACTIVE_BUILD_PART'
    | 'UNLINKED_HISTORICAL_BUILD_PART';
  severity: DataHealthSeverity;
  title: string;
  detail: string;
  recordId: string;
}

export interface DataHealthReport {
  issues: DataHealthIssue[];
  warningCount: number;
  infoCount: number;
}

const findDuplicateIds = <T>(
  records: T[],
  getId: (record: T) => unknown,
  code: DataHealthIssue['code'],
  label: string
): DataHealthIssue[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    const rawId = getId(record);
    if (typeof rawId !== 'string' || rawId.length === 0) continue;
    counts.set(rawId, (counts.get(rawId) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({
      code,
      severity: 'warning' as const,
      title: `Duplicate ${label} ID`,
      detail: `${count} records use the same ID. Partly has not changed them.`,
      recordId: id,
    }));
};

export const inspectDataHealth = (state: AppState): DataHealthReport => {
  const issues: DataHealthIssue[] = [
    ...findDuplicateIds(state.components, (component) => component.id, 'DUPLICATE_COMPONENT_ID', 'component'),
    ...findDuplicateIds(state.builds, (build) => build.id, 'DUPLICATE_BUILD_ID', 'build'),
    ...findDuplicateIds(state.transactions, (transaction) => transaction.id, 'DUPLICATE_TRANSACTION_ID', 'transaction'),
  ];

  const componentIds = new Set(state.components.map((component) => component.id));
  const purchaseEntries = new Map<string, Set<string>>();
  const allPurchaseEntries = state.components.flatMap((component) =>
    (component.purchaseHistory || []).map((entry) => ({ componentId: component.id, entryId: entry.id }))
  );

  issues.push(
    ...findDuplicateIds(
      allPurchaseEntries,
      (entry) => entry.entryId,
      'DUPLICATE_PURCHASE_ENTRY_ID',
      'purchase batch'
    )
  );

  for (const component of state.components) {
    purchaseEntries.set(
      component.id,
      new Set((component.purchaseHistory || []).map((entry) => entry.id))
    );
  }

  for (const build of state.builds) {
    for (const [partIndex, part] of (build.parts || []).entries()) {
      const recordId = `${build.id} / part ${partIndex + 1}`;
      if (!componentIds.has(part.componentId)) {
        issues.push({
          code: 'MISSING_COMPONENT_REFERENCE',
          severity: 'warning',
          title: 'Build part references a missing component',
          detail: `${build.name}: ${part.componentName}. Historical cost remains stored on the build part.`,
          recordId,
        });
        continue;
      }

      if (part.purchaseEntryId) {
        if (!purchaseEntries.get(part.componentId)?.has(part.purchaseEntryId)) {
          issues.push({
            code: 'MISSING_PURCHASE_ENTRY_REFERENCE',
            severity: 'warning',
            title: 'Build part references a missing purchase batch',
            detail: `${build.name}: ${part.componentName}. Partly will treat this as an unresolved legacy allocation.`,
            recordId: `${recordId} / ${part.purchaseEntryId}`,
          });
        }
        continue;
      }

      const isHistorical = build.status === 'Sold';
      issues.push({
        code: isHistorical
          ? 'UNLINKED_HISTORICAL_BUILD_PART'
          : 'UNLINKED_ACTIVE_BUILD_PART',
        severity: isHistorical ? 'info' : 'warning',
        title: isHistorical
          ? 'Historical build part has no purchase batch link'
          : 'Active build part has no purchase batch link',
        detail: `${build.name}: ${part.componentName}. Partly has not guessed a batch.`,
        recordId,
      });
    }
  }

  return {
    issues,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    infoCount: issues.filter((issue) => issue.severity === 'info').length,
  };
};
