import { formatWarrantyLabel } from './warranty';

export function generateMarketplaceAd(
  parts: Array<{category: string, name?: string, componentName?: string, source?: string, quantity?: number}>, 
  _buildName: string,
  warrantyDays: number = 30
): string {
  const hasMultipleSources = parts.some(p => p.source === 'TRADE_IN_BASE') && parts.some(p => p.source === 'ALLOCATED_UPGRADE');
  
  const getPartsStr = (category: string) => {
    const found = parts.filter(p => String(p.category || "").toLowerCase() === String(category || "").toLowerCase());
    if (found.length === 0) return null;
    
    return found.map(p => {
      let name = p.name || p.componentName || '';
      if (hasMultipleSources && p.source === 'ALLOCATED_UPGRADE') {
        name = `${name} (Upgrade)`;
      }
      return (p.quantity && p.quantity > 1) ? `${p.quantity}x ${name}` : name;
    }).join(' + ');
  };

  const gpu = getPartsStr('GPU');
  const cpu = getPartsStr('CPU');
  const board = getPartsStr('Motherboard');
  const ram = getPartsStr('RAM');
  let cooler = getPartsStr('Cooling');
  if (!cooler) cooler = getPartsStr('Cooler');
  const ssd = getPartsStr('Storage');
  const psu = getPartsStr('PSU');
  const pcCase = getPartsStr('Case');
  const fans = getPartsStr('Fans');
  const extras = getPartsStr('Extras');

  let specs = '';
  if (gpu) specs += `\n■ GPU: ${gpu}`;
  if (cpu) specs += `\n■ CPU: ${cpu}`;
  if (board) specs += `\n■ BOARD: ${board}`;
  if (ram) specs += `\n■ RAM: ${ram}`;
  if (cooler) specs += `\n■ COOLER: ${cooler}`;
  if (ssd) specs += `\n■ SSD: ${ssd}`;
  if (psu) specs += `\n■ PSU: ${psu}`;
  if (pcCase) specs += `\n■ CASE: ${pcCase}`;
  if (fans) specs += `\n■ FANS: ${fans}`;
  if (extras) specs += `\n■ EXTRAS: ${extras}`;
  
  const hasLcd = parts.some(p => {
    const n = (p.name || p.componentName || '').toLowerCase();
    return n.includes('lcd') || n.includes('screen') || n.includes('display');
  });
  
  let perfCustom = 'RGB lighting is fully customizable';
  if (hasLcd) {
    perfCustom += '\nLCD screen is fully customizable';
  }

  const warrantyLabel = formatWarrantyLabel(warrantyDays);

  return `[ PROFESSIONALLY BUILT CUSTOM PC ]
Fully Stress Tested
Ready to Plug & Play

[ PICKUP, DELIVERY & TESTING ]
📍 Pick up near Bovaird/McLaughlin in Brampton
🚚 Delivery available for extra cost
🖥 Option to fully test before purchase

[ SYSTEM SPECS ]${specs}

[ PERFORMANCE & CUSTOMIZATION ]
${perfCustom}

[ QUALITY CHECK ]
✅ ${warrantyLabel}
✅ Windows 11 Pro Fully Set Up & All Drivers Installed
✅ Stability Tested (OCCT)
✅ BIOS Updated & XMP/EXPO Performance Profiles Enabled
✅ Custom Fan Curves for Quiet & Cool Operation
✅ Clean Cable Management & Optimized Airflow
✅ Technical Support after purchase

[ ABOUT ME ]
As a former professional PUBG player for Cloud9 and Team Envy, I know that hardware reliability is everything. What started as a hobby for my own setups has turned into my full time work in Brampton. I'm not a big corporation, I'm just one guy obsessed with making sure these systems run perfectly. I've built my reputation on Marketplace by treating every buyer with respect and every build like it's my own.

[ PRICE MATCH POLICY ]
I will match or beat the price of a comparable system from an established local PC builder. Comparisons must have equivalent specifications, component quality, condition, and warranty coverage. Private used listings and systems with lower quality part substitutions are not considered equivalent.

If you need any changes or upgrades, I can modify this PC. If this build isn't exactly what you're looking for, I also offer custom builds tailored to your needs, so message me for details.`;
}
