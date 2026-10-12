# Comprehensive Universal Rounded Scrollbar & Modal Containment Plan

A root-cause investigation and universal implementation architecture to ensure scrollbars throughout Partly have smooth rounded pill tips, stay strictly within rounded modal bounds, and operate in dedicated non-overlapping tracks with minimal card spacing.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Root Cause Diagnostic Summary**:
> 1. **Sharp edges on scrollbars**: Modern Chromium (Chrome 121+) treats `scrollbar-width: thin` and `scrollbar-color` as standard CSS Scrollbars Level 1. When `* { scrollbar-width: thin; }` is present, Chromium **completely disables** all `::-webkit-scrollbar*` styling rules (including `border-radius: 9999px`), falling back to a flat rectangular box. Firefox alone needs `scrollbar-width`; Blink/WebKit engines must use dedicated `::-webkit-scrollbar` with `border-radius: 9999px` and ambient lime glow.
> 2. **Hovering over cards**: Overzealous reduction to `pr-1` (4px) / `padding-right: 3px` eliminated the buffer required for a 4px scrollbar track plus border clearance. On mobile touch browsers (Android Chrome), overlay scrollbars directly overlap cards unless a balanced 6px gutter (`pr-1.5` / `padding-right: 6px`) and `scrollbar-gutter: stable` are enforced.
> 3. **Bleeding past modal rounded corners**: In CSS, an element's native scrollbar cannot be clipped by its own `border-radius`. When outer modal containers (`confirm-modal-panel`, `modal-layout-content`) scroll directly, their scrollbars span from top=0 to bottom=100%, cutting across the curved corners. In addition, without `margin-block: 8px` on `::-webkit-scrollbar-track`, scroll thumbs run to the absolute edge of curved shells.

- **Confirmed Decision 1 (Universal Pill Aesthetics)**: The scrollbar styling will mathematically mirror `WindowScrollIndicator` across all scrollable containers: 4px width, vibrant lime `#B9EF68` (`rgba(185, 239, 104, 0.8)`), soft ambient glow (`box-shadow: 0 0 6px rgba(185, 239, 104, 0.3)`), and full pill rounding (`border-radius: 9999px`).
- **Confirmed Decision 2 (Dedicated 6px Scroll Lane)**: Replace the cramped 3px padding with a dedicated 6px lane (`pr-1.5` / `padding-right: 6px`) across all lists and modals. This provides a 4px scroll track plus 2px clearance, guaranteeing that scrollbars never hover over cards while preventing large empty gaps.
- **Confirmed Decision 3 (Strict Modal Containment & Track Insets)**: Apply `margin-block: 8px` to `::-webkit-scrollbar-track` universally, preventing thumbs from reaching curved corner radii. Enforce outer shell `overflow: hidden` on modals while delegating vertical scrolling to bounded inner content bodies.

---

### 1. Overview & Core Concept

- **What It Does**: Resolves all visual and ergonomic scrollbar discrepancies across desktop and mobile browsers. Restores true rounded pill ends (`border-radius: 9999px`) on every scrollbar thumb, separates scroll tracks from component cards with minimal 2px clearance, and confines modal scrollbars within rounded borders.
- **Target Audience / Persona**: PC builders, inventory managers, and hardware enthusiasts using mobile devices (Android Chrome, iOS Safari) and desktop browsers to manage inventory parts, review builds, and inspect transactions.
- **Key Value**: Delivers a cohesive, dark-cyber UI feel where scrollbars match the main page indicator without covering cards or breaking container boundaries.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  - *Inventory & Stock View*: Scrolling through components shows a sleek 4px lime pill running alongside cards in a dedicated 6px gutter. Cards retain full hover effects without the scrollbar overlapping borders.
  - *Modals (Allocate Part, Swap Part, Build Editor, Quick Quote, Component Modal)*: Opening any dialog displays a contained list where the scrollbar starts below the top curve and ends above the bottom curve, never cutting across the rounded modal frame.
  - *Small Alert & Confirm Dialogs (`ConfirmModal`)*: Dialog text and confirmation buttons remain fully visible, and any internal overflow scrolls cleanly within the inner body without bleeding past the 10px rounded corners.

- **Visual Identity & Theme**:
  - *Scrollbar Thumb*: `rgba(185, 239, 104, 0.8)` (`#B9EF68`), transitioning to `rgba(201, 238, 158, 0.95)` on hover.
  - *Thumb Border Radius*: `9999px` (fully rounded pill ends).
  - *Thumb Glow*: `box-shadow: 0 0 6px rgba(185, 239, 104, 0.3)`.
  - *Track Background*: Fully transparent (`background: transparent`).
  - *Track Vertical Inset*: `margin-block: 8px` (stops scrollbar travel 8px before container edges).
  - *Card Clearance*: 6px right gutter (`pr-1.5` / `padding-right: 6px;`), ensuring a 4px scroll lane and 2px separation from card edges.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removal of Universal `scrollbar-width: thin` on WebKit/Blink**:
  - *Chosen Approach*: Remove `* { scrollbar-width: thin; scrollbar-color: ... }` from the global rule in `src/index.css`. Scope standard CSS scrollbar properties exclusively to Firefox using `@supports (-moz-appearance: none)`. Provide pristine `::-webkit-scrollbar` rules with `border-radius: 9999px` for Chrome, Edge, and Safari.
  - *Why*: In Chrome 121+, declaring `scrollbar-width` completely shuts off the `::-webkit-scrollbar` engine, which is why previous fixes produced sharp rectangular blocks instead of pills.
  - *Alternatives Considered*: Retaining `scrollbar-width: thin` globally was the root cause of the bug; removing it from WebKit restores full pill rendering.

- **Decision 2: Universal Track Insets via `margin-block: 8px`**:
  - *Chosen Approach*: Add `margin-block: 8px` to `::-webkit-scrollbar-track`.
  - *Why*: Browsers do not curve scrollbar tracks when an element has `border-radius`. By insetting the track by 8px vertically, the thumb stops moving before it enters the curved quadrant of the container.
  - *Alternatives Considered*: Custom JavaScript scroll overlays inside every individual modal would add high complexity and performance overhead. CSS track insets combined with outer shell clipping solve the problem universally.

- **Decision 3: Dedicated 6px Scroll Gutter (`pr-1.5` / `padding-right: 6px`)**:
  - *Chosen Approach*: Standardize scroll padding from `pr-1` (4px) / 3px to `pr-1.5` (6px) / `padding-right: 6px` paired with `scrollbar-gutter: stable`.
  - *Why*: A 4px scrollbar inside a 4px/3px padding box overlaps the card's 1px border. A 6px lane reserves 4px for the scrollbar and 2px for clean whitespace, preventing overlap without creating excessive gaps.

- **Decision 4: Nested Scroll Architecture for Rounded Modals**:
  - *Chosen Approach*: Ensure modal containers (`BottomSheetModal`, `ConfirmModal`) act as strict boundary shells (`overflow: hidden; rounded-[14px] sm:rounded-2xl`), while scrollable lists inside them are wrapped in dedicated inner containers (`overflow-y: scroll`) with top and bottom padding.
  - *Why*: An element cannot clip its own scrollbar. Moving the scroll property to an inset inner container guarantees that the outer shell's `border-radius` and `overflow: hidden` strictly contain all visual elements.

---

### 4. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                      Modal Dialog Shell                     │
│    border-radius: 14px / 16px; overflow: hidden;            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Modal Header / Sticky Controls                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Inner Scroll Container                              │   │
│   │ overflow-y: scroll; scrollbar-gutter: stable;       │   │
│   │ padding-right: 6px; padding-block: 4px;             │   │
│   │                                                     │   │
│   │  ┌───────────────────────────────┐ ┌──────────────┐ │   │
│   │  │ Component Cards (w-full)      │ │ Pill Thumb   │ │   │
│   │  │                               │ │ 4px width    │ │   │
│   │  │                               │ │ 2px gap      │ │   │
│   │  │                               │ │ rounded ends │ │   │
│   │  │                               │ │ stops 8px    │ │   │
│   │  │                               │ │ before edge  │ │   │
│   │  └───────────────────────────────┘ └──────────────┘ │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Modal Footer / Sticky Actions                       │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Detailed Change Matrix

1. **Global Styles (`src/index.css`)**:
   - Update scrollbar rules:
     - Remove `* { scrollbar-width: thin; scrollbar-color: ... }` from WebKit scope.
     - Add `@supports (-moz-appearance: none)` block for Firefox fallback.
     - Configure `::-webkit-scrollbar { width: 4px; height: 4px; }`.
     - Configure `::-webkit-scrollbar-track { background: transparent; margin-block: 8px; }`.
     - Configure `::-webkit-scrollbar-thumb { background-color: rgba(185, 239, 104, 0.8); border-radius: 9999px; box-shadow: 0 0 6px rgba(185, 239, 104, 0.3); }`.
     - Configure hover: `background-color: rgba(201, 238, 158, 0.95);`.
   - Update list scroll classes (`.modal-results-list`, `.build-editor-body`, `.stock-inventory-scroll`):
     - Set `padding-right: 6px;`.
     - Set `scrollbar-gutter: stable;`.
     - Set `overflow-y: scroll !important;`.

2. **Modal Shell Containment**:
   - `src/components/ui/BottomSheetModal.tsx`:
     - Maintain strict `overflow-hidden` on the dialog card.
     - Ensure `.modal-layout-content` delegates scrolling to inner body regions.
   - `src/components/ConfirmModal.tsx`:
     - Remove `overflow-y: auto` from `.confirm-modal-panel`.
     - Wrap dialog message content in an inner scrollable container when text is long.

3. **Gutter Normalization Across Components**:
   - Update `pr-1` to `pr-1.5` (6px) across:
     - `src/components/InventoryView.tsx` (virtualized and non-virtualized inventory rows)
     - `src/components/builds/AllocatePartModal.tsx` (`.modal-results-list`)
     - `src/components/builds/SwapPartModal.tsx` (`.modal-results-list`)
     - `src/components/BuildModal.tsx` (`.build-editor-body`)
     - `src/components/builds/QuickQuoteModal.tsx` (`.build-editor-body`)
     - `src/components/BuildsView.tsx`
     - `src/components/history/TransactionHistoryView.tsx`
     - `src/components/stock/PurchaseHistoryView.tsx`
     - `src/components/activity/EditTransactionModal.tsx`
     - `src/components/stock/SetStorageHealthModal.tsx`
