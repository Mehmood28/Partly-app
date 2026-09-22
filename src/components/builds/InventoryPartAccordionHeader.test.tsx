import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InventoryPartAccordionHeader } from './InventoryPartAccordionHeader';

describe('InventoryPartAccordionHeader', () => {
  it('renders a native button with accordion state for keyboard activation', () => {
    const markup = renderToStaticMarkup(
      <InventoryPartAccordionHeader
        category="GPU"
        name="RTX 5070 Ti"
        metadata={<span>2 in stock</span>}
        isExpanded
        onToggle={() => undefined}
      />
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('RTX 5070 Ti');
  });
});
