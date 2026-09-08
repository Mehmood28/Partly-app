import { generateMarketplaceAd } from './adGenerator';
import { isValidWarrantyDays, normalizeWarrantyDays } from './warranty';

export interface CopyAdHelperParams {
  build: { id: string; name: string; warrantyDays?: number };
  components: Array<{
    category: string;
    name?: string;
    componentName?: string;
    source?: string;
    quantity?: number;
  }>;
  copyAdWarrantyDays: string;
  copyAdCustomWarranty: string;
  updateBuild: (buildId: string, updates: { warrantyDays: number }) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setCopied: (copied: boolean) => void;
  closeModal: () => void;
  clipboard?: { writeText: (text: string) => Promise<void> } | null;
}

export interface CopyAdHelperResult {
  success: boolean;
  reason?: 'INVALID_WARRANTY' | 'CLIPBOARD_UNAVAILABLE' | 'CLIPBOARD_WRITE_FAILED';
  resolvedWarrantyDays?: number;
  adText?: string;
}

export async function executeCopyAdConfirmation(
  params: CopyAdHelperParams
): Promise<CopyAdHelperResult> {
  let resolvedWarrantyDays = 30;
  if (params.copyAdWarrantyDays === 'Custom') {
    if (!isValidWarrantyDays(params.copyAdCustomWarranty)) {
      params.showToast('Custom warranty days must be a positive whole number.', 'error');
      return { success: false, reason: 'INVALID_WARRANTY' };
    }
    resolvedWarrantyDays = Number(params.copyAdCustomWarranty);
  } else {
    resolvedWarrantyDays = normalizeWarrantyDays(params.copyAdWarrantyDays, 30);
  }

  const adText = generateMarketplaceAd(
    params.components,
    params.build.name,
    resolvedWarrantyDays
  );

  const clipboard =
    params.clipboard !== undefined
      ? params.clipboard
      : typeof navigator !== 'undefined'
      ? navigator.clipboard
      : null;

  if (!clipboard || typeof clipboard.writeText !== 'function') {
    params.showToast('Clipboard access is not available in your browser.', 'error');
    return { success: false, reason: 'CLIPBOARD_UNAVAILABLE' };
  }

  try {
    await clipboard.writeText(adText);
  } catch (_err) {
    params.showToast('Failed to copy ad to clipboard.', 'error');
    return { success: false, reason: 'CLIPBOARD_WRITE_FAILED' };
  }

  if (resolvedWarrantyDays !== params.build.warrantyDays) {
    params.updateBuild(params.build.id, { warrantyDays: resolvedWarrantyDays });
  }

  params.setCopied(true);
  setTimeout(() => params.setCopied(false), 2000);
  params.closeModal();

  return { success: true, resolvedWarrantyDays, adText };
}
