import { PCBuild, PCBuildComponentBreakdown } from '../types';

export const isAcquiredPC = (build: PCBuild | null | undefined): boolean =>
  build?.acquisitionSource === 'Trade-In' || build?.acquisitionSource === 'Purchased';

export const isPurchasedPC = (build: PCBuild | null | undefined): boolean =>
  build?.acquisitionSource === 'Purchased';

export const getAcquiredPCBreakdown = (
  build: PCBuild | null | undefined
): PCBuildComponentBreakdown[] => {
  if (!build) return [];
  if (build.acquisitionSource === 'Purchased') {
    return build.acquisitionComponentBreakdown || [];
  }
  if (build.acquisitionSource === 'Trade-In') {
    return build.tradeInComponentBreakdown?.length
      ? build.tradeInComponentBreakdown
      : build.acquisitionComponentBreakdown || [];
  }
  return [];
};

export const getAcquiredPCLabel = (build: PCBuild): string =>
  build.acquisitionSource === 'Purchased' ? 'Purchased PC' : 'Trade-In PC';
