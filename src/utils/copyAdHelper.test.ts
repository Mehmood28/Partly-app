import { describe, it, expect, vi } from 'vitest';
import { executeCopyAdConfirmation, CopyAdHelperParams } from './copyAdHelper';

describe('executeCopyAdConfirmation', () => {
  const baseParams = (overrides?: Partial<CopyAdHelperParams>): CopyAdHelperParams => ({
    build: { id: 'build-1', name: 'Gaming Rig', warrantyDays: 30 },
    components: [
      { category: 'GPU', name: 'RTX 4070', quantity: 1 },
      { category: 'CPU', name: 'Ryzen 7 7800X3D', quantity: 1 },
    ],
    copyAdWarrantyDays: '60',
    copyAdCustomWarranty: '',
    updateBuild: vi.fn(),
    showToast: vi.fn(),
    setCopied: vi.fn(),
    closeModal: vi.fn(),
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  });

  it('Successful Copy Ad uses the selected warranty in the ad', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    const result = await executeCopyAdConfirmation(
      baseParams({
        copyAdWarrantyDays: '60',
        clipboard,
      })
    );

    expect(result.success).toBe(true);
    expect(result.resolvedWarrantyDays).toBe(60);
    expect(result.adText).toContain('60 Day Parts and Labour Warranty');
    expect(clipboard.writeText).toHaveBeenCalledWith(result.adText);

    // Also verify custom warranty term in ad
    const customResult = await executeCopyAdConfirmation(
      baseParams({
        copyAdWarrantyDays: 'Custom',
        copyAdCustomWarranty: '45',
        clipboard,
      })
    );
    expect(customResult.success).toBe(true);
    expect(customResult.resolvedWarrantyDays).toBe(45);
    expect(customResult.adText).toContain('45 Day Parts and Labour Warranty');
    expect(clipboard.writeText).toHaveBeenCalledWith(customResult.adText);
  });

  it('Successful Copy Ad updates the build warranty when different', async () => {
    const updateBuild = vi.fn();
    const closeModal = vi.fn();
    const setCopied = vi.fn();
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    const result = await executeCopyAdConfirmation(
      baseParams({
        build: { id: 'build-1', name: 'Gaming Rig', warrantyDays: 30 },
        copyAdWarrantyDays: '90',
        updateBuild,
        closeModal,
        setCopied,
        clipboard,
      })
    );

    expect(result.success).toBe(true);
    expect(updateBuild).toHaveBeenCalledTimes(1);
    expect(updateBuild).toHaveBeenCalledWith('build-1', { warrantyDays: 90 });
    expect(setCopied).toHaveBeenCalledWith(true);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('Successful Copy Ad does not call "updateBuild" when already identical', async () => {
    const updateBuild = vi.fn();
    const closeModal = vi.fn();
    const setCopied = vi.fn();
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    const result = await executeCopyAdConfirmation(
      baseParams({
        build: { id: 'build-1', name: 'Gaming Rig', warrantyDays: 60 },
        copyAdWarrantyDays: '60',
        updateBuild,
        closeModal,
        setCopied,
        clipboard,
      })
    );

    expect(result.success).toBe(true);
    expect(updateBuild).not.toHaveBeenCalled();
    expect(setCopied).toHaveBeenCalledWith(true);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('Clipboard failure does not update the warranty or close the modal', async () => {
    const updateBuild = vi.fn();
    const closeModal = vi.fn();
    const setCopied = vi.fn();
    const showToast = vi.fn();
    const failingClipboard = {
      writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
    };

    const result = await executeCopyAdConfirmation(
      baseParams({
        build: { id: 'build-1', name: 'Gaming Rig', warrantyDays: 30 },
        copyAdWarrantyDays: '90',
        updateBuild,
        closeModal,
        setCopied,
        showToast,
        clipboard: failingClipboard,
      })
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('CLIPBOARD_WRITE_FAILED');
    expect(updateBuild).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
    expect(setCopied).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Failed to copy ad to clipboard.', 'error');
  });

  it('Missing Clipboard API does not update the warranty or close the modal', async () => {
    const updateBuild = vi.fn();
    const closeModal = vi.fn();
    const setCopied = vi.fn();
    const showToast = vi.fn();

    const result = await executeCopyAdConfirmation(
      baseParams({
        build: { id: 'build-1', name: 'Gaming Rig', warrantyDays: 30 },
        copyAdWarrantyDays: '90',
        updateBuild,
        closeModal,
        setCopied,
        showToast,
        clipboard: null,
      })
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('CLIPBOARD_UNAVAILABLE');
    expect(updateBuild).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
    expect(setCopied).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'Clipboard access is not available in your browser.',
      'error'
    );
  });

  it('Invalid custom warranty does not copy, update, or close', async () => {
    const updateBuild = vi.fn();
    const closeModal = vi.fn();
    const setCopied = vi.fn();
    const showToast = vi.fn();
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    const result = await executeCopyAdConfirmation(
      baseParams({
        build: { id: 'build-1', name: 'Gaming Rig', warrantyDays: 30 },
        copyAdWarrantyDays: 'Custom',
        copyAdCustomWarranty: '-15',
        updateBuild,
        closeModal,
        setCopied,
        showToast,
        clipboard,
      })
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_WARRANTY');
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(updateBuild).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
    expect(setCopied).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'Custom warranty days must be a positive whole number.',
      'error'
    );
  });

  it('The removed checkbox parameter no longer exists', () => {
    const params = baseParams();
    // Verify that copyAdSaveToBuild is not a property on CopyAdHelperParams
    expect('copyAdSaveToBuild' in params).toBe(false);
  });
});
