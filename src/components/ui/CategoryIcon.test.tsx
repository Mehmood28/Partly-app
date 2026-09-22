import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategoryIcon } from './CategoryIcon';

const renderIcon = (category?: string) => renderToStaticMarkup(
  <CategoryIcon category={category} className="test-icon" />
);

describe('CategoryIcon', () => {
  it.each([
    ['GPU', 'lucide-monitor'],
    ['CPU', 'lucide-cpu'],
    ['RAM', 'lucide-hard-drive'],
    ['Storage', 'lucide-database'],
    ['Motherboard', 'lucide-circuit-board'],
    ['PSU', 'lucide-zap'],
    ['Cooling', 'lucide-fan'],
    ['Fans', 'lucide-fan'],
    ['Case', 'lucide-box'],
  ])('maps %s to the shared icon', (category, iconClass) => {
    const markup = renderIcon(category);
    expect(markup).toContain(iconClass);
    expect(markup).toContain('test-icon');
  });

  it('uses the package fallback for accessories, other, and unknown categories', () => {
    expect(renderIcon('Accessories')).toContain('lucide-package');
    expect(renderIcon('Other')).toContain('lucide-package');
    expect(renderIcon('Unknown')).toContain('lucide-package');
  });
});
