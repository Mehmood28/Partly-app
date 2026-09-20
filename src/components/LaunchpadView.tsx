import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { GoalBar } from './GoalBar';
import { InventoryComponent, PCBuildPart } from '../types';
import { 
  calculateUnassignedQuantityStrict, 
  calculateAverageUnitCost, 
  precomputeAssignedBatches,
  getUnassignedBatches 
} from '../utils/helpers';
import { RecommendedBuild, LaunchpadViewProps } from './launchpad/launchpadTypes';
import { formatShortCpuAndGpu } from './launchpad/launchpadHelpers';
import { DashboardQuickStats } from './launchpad/DashboardQuickStats';
import { DashboardQuickActions } from './launchpad/DashboardQuickActions';
import { CustomAIBuildRequest } from './launchpad/CustomAIBuildRequest';
import { CustomBuildResultCard } from './launchpad/CustomBuildResultCard';

export type { RecommendedBuild, LaunchpadViewProps };

export const LaunchpadView: React.FC<LaunchpadViewProps> = React.memo(({ 
  setActiveTab, 
  onNavigateToBuilds,
  onOpenAddBuild, 
  onOpenAddComponent, 
  onOpenBulkEntry 
}) => {
  const { state } = useInventory();
  const [customPrompt, setCustomPrompt] = useState('');
  const [customBuild, setCustomBuild] = useState<RecommendedBuild | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [isGeneratingCustomBuild, setIsGeneratingCustomBuild] = useState(false);

  const handleGenerateCustomBuild = async () => {
    setCustomError(null);
    setCustomBuild(null);
    
    if (!customPrompt.trim()) return;
    
    setIsGeneratingCustomBuild(true);
    
    try {
      const precomputedMap = precomputeAssignedBatches(state.builds);
      const pool = state.components.map(c => ({
        ...c,
        unassignedQty: calculateUnassignedQuantityStrict(c, state.builds, precomputedMap),
        avgCost: calculateAverageUnitCost(c)
      })).filter(c => c.unassignedQty > 0);
      
      if (pool.length === 0) {
        setCustomError('No in-stock components available in inventory to generate a build.');
        return;
      }

      const payload = {
        prompt: customPrompt,
        inventory: pool.map(c => ({
          id: c.id,
          name: c.name,
          category: c.category,
          avgCost: c.avgCost,
          unassignedQty: c.unassignedQty,
          tags: c.tags || [],
          specifications: c.specifications
        }))
      };

      const res = await fetch('/api/generate-custom-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate custom build');
      }
      
      const partIds = data.partIds || [];
      const buildParts = partIds.map((id: string) => pool.find(p => p.id === id)).filter((p): p is (InventoryComponent & { unassignedQty: number; avgCost: number }) => Boolean(p));
      
      if (buildParts.length === 0) {
        setCustomError('Could not match any available parts in your inventory to this request. Try adjusting your prompt or checking stock.');
        return;
      }
      
      const totalCost = buildParts.reduce((sum: number, p) => sum + p.avgCost, 0);
      let estimatedPrice = totalCost * 1.35; // Initial pricing seed; displayed percentage is revenue-based margin.
      let projectedProfit = estimatedPrice - totalCost;
      if (projectedProfit < 250) {
        estimatedPrice = totalCost + 250;
        projectedProfit = 250;
      }
      estimatedPrice = Math.round(estimatedPrice / 10) * 10;
      projectedProfit = estimatedPrice - totalCost;
      const margin = (projectedProfit / estimatedPrice) * 100;

      const cpuName = buildParts.find((p) => p.category === 'CPU')?.name || '';
      const gpuName = buildParts.find((p) => p.category === 'GPU')?.name || '';
      const fallbackName = formatShortCpuAndGpu(cpuName, gpuName) || customPrompt;

      setCustomBuild({
        id: 'custom-' + Date.now(),
        name: data.buildName || fallbackName,
        parts: buildParts.map((p) => ({ ...p, assignedQty: 1 })),
        totalCost,
        estimatedPrice,
        projectedProfit,
        margin,
        tier: 'tier1',
        notes: data.notes || undefined,
        warning: undefined
      });
      
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : 'Error communicating with AI service.');
    } finally {
      setIsGeneratingCustomBuild(false);
    }
  };

  const handleStartBuild = (recBuild: RecommendedBuild) => {
    const buildParts: PCBuildPart[] = recBuild.parts.map(p => {
      const comp = state.components.find(c => c.id === p.id);
      let purchaseEntryId = comp?.purchaseHistory?.[0]?.id;
      let unitCost = p.avgCost || (comp?.purchaseHistory?.[0]?.unitPrice ?? 0);

      if (comp) {
        const unassignedBatches = getUnassignedBatches(comp, state.builds);
        const availableBatch = unassignedBatches.find(b => b.availableQuantity > 0);
        if (availableBatch) {
          purchaseEntryId = availableBatch.entry.id;
          unitCost = availableBatch.unitCost;
        }
      }

      return {
        componentId: p.id,
        componentName: p.name,
        category: p.category,
        quantity: p.assignedQty || 1,
        unitCostAtAssignment: unitCost,
        purchaseEntryId
      };
    });

    const cpuName = buildParts.find(p => p.category === 'CPU')?.componentName || 'CPU';
    const gpuName = buildParts.find(p => p.category === 'GPU')?.componentName || '';
    const defaultTitle = recBuild.name || formatShortCpuAndGpu(cpuName, gpuName);

    onOpenAddBuild({
      name: defaultTitle,
      parts: buildParts,
      status: 'Listed for Sale',
      estimatedCost: recBuild.estimatedPrice,
      notes: recBuild.notes ? `AI Synergy: ${recBuild.notes}` : 'Generated from custom AI request.'
    });
  };

  return (
    <div className="launchpad-layout pb-2">
      {/* Monthly Profit Goal */}
      <GoalBar />
      
      {/* Quick Stats Row */}
      <DashboardQuickStats
        onNavigateToBuilds={(filter) => {
          if (onNavigateToBuilds) {
            onNavigateToBuilds(filter);
          } else {
            setActiveTab('builds');
          }
        }}
        onNavigateToStock={() => setActiveTab('inventory')}
      />

      {/* Quick Action Buttons */}
      <DashboardQuickActions
        onOpenAddBuild={() => onOpenAddBuild()}
        onOpenAddComponent={onOpenAddComponent}
        onOpenBulkEntry={onOpenBulkEntry}
        onNavigateToStock={() => setActiveTab('inventory')}
        onNavigateToBuilds={() => {
          if (onNavigateToBuilds) {
            onNavigateToBuilds('Available');
          } else {
            setActiveTab('builds');
          }
        }}
      />

      {/* Custom AI Build Request */}
      <CustomAIBuildRequest
        customPrompt={customPrompt}
        setCustomPrompt={setCustomPrompt}
        isGeneratingCustomBuild={isGeneratingCustomBuild}
        onGenerate={handleGenerateCustomBuild}
        customError={customError}
      />

      {/* Custom Build Result */}
      {customBuild && (
        <CustomBuildResultCard
          customBuild={customBuild}
          onDismiss={() => setCustomBuild(null)}
          onStartBuild={handleStartBuild}
        />
      )}
    </div>
  );
});
