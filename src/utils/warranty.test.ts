import { describe, it, expect } from 'vitest';
import { formatWarrantyLabel, getBuildWarrantyInfo, isValidWarrantyDays, normalizeWarrantyDays } from './warranty';
import { generateMarketplaceAd } from './adGenerator';

describe('Warranty Logic', () => {
  it('validates warranty days correctly', () => {
    expect(isValidWarrantyDays(30)).toBe(true);
    expect(isValidWarrantyDays(365)).toBe(true);
    expect(isValidWarrantyDays('90')).toBe(true);
    expect(isValidWarrantyDays(0)).toBe(false);
    expect(isValidWarrantyDays(-10)).toBe(false);
    expect(isValidWarrantyDays(1.5)).toBe(false);
    expect(isValidWarrantyDays(NaN)).toBe(false);
    expect(isValidWarrantyDays(Infinity)).toBe(false);
    expect(isValidWarrantyDays(null)).toBe(false);
    expect(isValidWarrantyDays(undefined)).toBe(false);
    expect(isValidWarrantyDays('')).toBe(false);
    expect(isValidWarrantyDays('abc')).toBe(false);
  });

  it('normalizes warranty days correctly with fallback', () => {
    expect(normalizeWarrantyDays(30)).toBe(30);
    expect(normalizeWarrantyDays(60)).toBe(60);
    expect(normalizeWarrantyDays('90')).toBe(90);
    expect(normalizeWarrantyDays(0)).toBe(30);
    expect(normalizeWarrantyDays(-5)).toBe(30);
    expect(normalizeWarrantyDays(NaN)).toBe(30);
    expect(normalizeWarrantyDays(null)).toBe(30);
    expect(normalizeWarrantyDays(undefined)).toBe(30);
    expect(normalizeWarrantyDays(undefined, 60)).toBe(60);
  });

  it('formats warranty labels correctly', () => {
    expect(formatWarrantyLabel(30)).toBe('30 Day Parts and Labour Warranty');
    expect(formatWarrantyLabel(60)).toBe('60 Day Parts and Labour Warranty');
    expect(formatWarrantyLabel(365)).toBe('1 Year Parts and Labour Warranty');
    expect(formatWarrantyLabel(730)).toBe('2 Year Parts and Labour Warranty');
    expect(formatWarrantyLabel(90)).toBe('90 Day Parts and Labour Warranty');
  });

  it('calculates Day 0 correctly', () => {
    const saleDate = '2026-07-23';
    // Reference date same as saleDate
    const refDate = new Date(2026, 6, 23, 12, 0, 0); 
    const info = getBuildWarrantyInfo(saleDate, refDate, 60);
    expect(info?.isActive).toBe(true);
    expect(info?.daysLeft).toBe(60);
  });

  it('calculates exact expiry correctly', () => {
    const saleDate = '2026-07-23';
    // 60 days later
    const refDate = new Date(2026, 6, 23 + 60, 12, 0, 0); 
    const info = getBuildWarrantyInfo(saleDate, refDate, 60);
    expect(info?.isActive).toBe(false);
    expect(info?.daysLeft).toBe(0);
  });

  it('returns null for future dates', () => {
    const saleDate = '2026-07-24';
    const refDate = new Date(2026, 6, 23, 12, 0, 0);
    const info = getBuildWarrantyInfo(saleDate, refDate, 60);
    expect(info).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(getBuildWarrantyInfo('invalid', new Date(), 60)).toBeNull();
  });
  
  it('formats invalid warranty labels gracefully', () => {
    expect(formatWarrantyLabel(0 as any)).toBe('30 Day Parts and Labour Warranty');
    expect(formatWarrantyLabel(-5 as any)).toBe('30 Day Parts and Labour Warranty');
    expect(formatWarrantyLabel(NaN as any)).toBe('30 Day Parts and Labour Warranty');
    expect(formatWarrantyLabel(1.5 as any)).toBe('30 Day Parts and Labour Warranty');
  });

  it('falls back to 30 days for legacy', () => {
    const saleDate = '2026-07-23';
    // 30 days later
    const refDate = new Date(2026, 6, 23 + 30, 12, 0, 0); 
    const info = getBuildWarrantyInfo(saleDate, refDate);
    expect(info?.isActive).toBe(false);
  });
});

describe('Ad Generator', () => {
  it('generates marketplace ad correctly', () => {
    const parts = [
      { category: 'GPU', name: 'RTX 4070' },
      { category: 'CPU', name: 'i7-13700K' },
      { category: 'Cooling', name: 'AIO 240mm' }
    ];
    const ad = generateMarketplaceAd(parts, 'Custom Rig', 60);
    expect(ad).toContain('[ PROFESSIONALLY BUILT CUSTOM PC ]');
    expect(ad).toContain('Fully Stress Tested');
    expect(ad).toContain('Ready to Plug & Play');
    
    expect(ad).toContain('[ PICKUP, DELIVERY & TESTING ]');
    expect(ad).toContain('📍 Pick up near');
    
    expect(ad).toContain('[ SYSTEM SPECS ]');
    expect(ad).toContain('■ GPU: RTX 4070');
    expect(ad).toContain('■ CPU: i7-13700K');
    expect(ad).toContain('■ COOLER: AIO 240mm');
    expect(ad).not.toContain('■ BOARD:');
    
    expect(ad).toContain('[ QUALITY CHECK ]');
    expect(ad).toContain('✅ 60 Day Parts and Labour Warranty');
    expect(ad).toContain('✅ Windows 11 Pro Fully Set Up');
    expect(ad).toContain('✅ BIOS Updated & XMP/EXPO Performance Profiles Enabled');
    expect(ad).not.toContain('✅ BIOS Updated & XMP Performance Profiles Enabled');
    
    expect(ad).toContain('[ PERFORMANCE & CUSTOMIZATION ]');
    expect(ad).toContain('RGB lighting is fully customizable');
    expect(ad).not.toContain('LCD screen displays');
    
    expect(ad).toContain('[ ABOUT ME ]');
    expect(ad).toContain('As a former professional PUBG player');
    
    expect(ad).toContain('[ PRICE MATCH POLICY ]');
    expect(ad).toContain('I will match or beat');
    
    expect(ad).toContain('If you need any changes or upgrades, I can modify this PC.');
    
    // Check no dash punctuation in words like full time, stress tested
    expect(ad).not.toContain('Stress-Tested');
    expect(ad).not.toContain('full-time');
    expect(ad).not.toContain('apples-to-apples');
  });

  it('includes LCD text if LCD is in parts', () => {
    const parts = [{ category: 'Cooling', name: 'Kraken LCD Cooler' }];
    const ad = generateMarketplaceAd(parts, 'Test');
    expect(ad).toContain('LCD screen is fully customizable');
  });
  
  it('shows fans and extras conditionally', () => {
    const ad1 = generateMarketplaceAd([], 'Test');
    expect(ad1).not.toContain('■ FANS');
    expect(ad1).not.toContain('■ EXTRAS');
    
    const ad2 = generateMarketplaceAd([{ category: 'Fans', name: 'Lian Li' }, { category: 'Extras', name: 'Cables' }], 'Test');
    expect(ad2).toContain('■ FANS: Lian Li');
    expect(ad2).toContain('■ EXTRAS: Cables');
  });
});
