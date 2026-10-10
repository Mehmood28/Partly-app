# Fix "Recently Bought" Inventory Sorting Logic Universally

Fix the "Recently Bought" inventory sorting filter so that whenever components have multiple batches (e.g., buying a second "Gigabyte X870E AORUS PRO ICE" on Oct 6th when the original component was added on Apr 30th), sorting is determined by the most recent batch date rather than the component's original creation date, with graceful fallback to creation date when no batches exist. Ensure universal consistency across all tabs and modals containing the filter.

## User Review & Critical Decisions

> [!IMPORTANT]
> The codebase audit identified that all inventory catalog dropdowns and pickers share the centralized `filterAndSortComponents` engine in `src/utils/helpers.ts`, while `SwapPartModal.tsx` additionally contains a local comparator that must be aligned.
> - **Batch Date Evaluation**: Evaluates `Math.max` across all batch dates in `(component as any).batches || component.purchaseHistory`. Dates will be parsed using the app's established local calendar parser (`getLocalCalendarTimestamp`) with ISO fallback to prevent timezone off-by-one shifts.
> - **Graceful Fallback**: If a component has no batches (or all batch dates are missing/unparseable), sorting gracefully falls back to the component's creation date (`createdAt`, `createdDate`, `dateAdded`, or creation timestamp embedded in `component.id`).
> - **Universal Application**: The fix applies automatically across all 6 views and modals consuming `SortOption = 'newest-purchase'`, and replaces the secondary custom sort in `SwapPartModal.tsx`.

---

## 1. Overview & Core Concept

- **What It Does**: The "Recently Bought" filter in Partly allows users to view stock sorted with newly purchased inventory at the top. This fix ensures that adding a new batch to an existing component catalog card immediately bumps that component to the top of the "Recently Bought" view, matching user expectations.
- **Target Audience / Persona**: PC builders and inventory managers restocking high-volume components (like motherboards, RAM, and SSDs) who need to find and allocate newly purchased batches quickly without scrolling past older catalog items.
- **Key Value**: Eliminates catalog misordering and lost visibility when re-ordering existing parts, making stock tracking reliable and predictable.

---

## 2. User Experience & Visual Design

- **Zero Visual Regression**: The UI remains completely identical across all views. The dropdown label `"Recently Bought"` in `InventoryFilterBar` remains unchanged.
- **Dynamic List Response**:
  - When a user logs a purchase for a component that was originally created months ago, selecting "Recently Bought" in the In-Stock view immediately reflects the latest purchase date.
  - In build modals (`BuildModal`, `AllocatePartModal`, `SwapPartModal`) and sell modals (`SellPartModal`, `BulkSaleForm`), newly restocked components appear at the top of their respective category lists.
- **Tie-Breaking Determinism**: If two components share the same recent batch date, the comparator falls back to component name or ID deterministically without list jumping.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Centralized Helper vs Per-Component Comparator**
  - *Chosen Approach*: Export a shared helper `getComponentLatestPurchaseTimestamp(component: InventoryComponent): number` from `src/utils/helpers.ts` and use it inside `filterAndSortComponents` and `SwapPartModal.tsx`.
  - *Why*: Prevents divergence. If batch schema or date normalization rules evolve, the sorting logic remains unified in one place.
  - *Alternatives Considered*: Writing inline comparator logic in each modal was rejected as it caused the original divergence in `SwapPartModal.tsx`.

- **Decision 2: Timezone-Safe Date Parsing**
  - *Chosen Approach*: Use `getLocalCalendarTimestamp` from `src/utils/helpers.ts` first, falling back to `new Date(date).getTime()`.
  - *Why*: Component purchase dates are stored as `"YYYY-MM-DD"`. Using vanilla `new Date("2026-10-06").getTime()` evaluates to UTC midnight, which in Western Hemisphere timezones can cause calendar offset discrepancies. `getLocalCalendarTimestamp` normalizes local midnight deterministically.

- **Decision 3: Multi-Layer Creation Date Fallback**
  - *Chosen Approach*: For components with 0 batches, inspect `createdAt`, `createdDate`, `dateAdded`, and regex timestamp from `component.id` (`comp-<timestamp>-...`).
  - *Why*: Handles legacy data, imported backups, and in-memory drafts where explicit timestamps might be in varying properties.

---

## 4. Technical Architecture & Data Strategy

### Component & Data Flow Diagram

```
┌────────────────────────────────────────────────────────┐
│             Inventory Filter & Sort Engine             │
│                 (src/utils/helpers.ts)                 │
├────────────────────────────────────────────────────────┤
│  getComponentLatestPurchaseTimestamp(component):       │
│   1. Batches: Math.max(...validBatchTimestamps)        │
│   2. Fallback: createdAt / createdDate / ID timestamp  │
└───────────────────────────┬────────────────────────────┘
                            │
            Used by filterAndSortComponents()
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│InventoryView │     │  BuildModal  │     │AllocatePart  │
│  (Stock Tab) │     │ (Part Picker)│     │    Modal     │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                    ▲                    ▲
       ├────────────────────┼────────────────────┤
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ SwapPartModal│     │ SellPartModal│     │ BulkSaleForm │
│  (Build Rig) │     │ (Loose Part) │     │ (Batch Pool) │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Detailed Code Audit & Affected Locations

1. **`src/utils/helpers.ts`**:
   - Implement and export `getComponentLatestPurchaseTimestamp(comp: InventoryComponent): number`:
     ```ts
     export function getComponentLatestPurchaseTimestamp(comp: InventoryComponent): number {
       const batches = (comp as any).batches || comp.purchaseHistory || [];
       if (Array.isArray(batches) && batches.length > 0) {
         let max = 0;
         for (let i = 0; i < batches.length; i++) {
           const b = batches[i];
           if (!b || !b.date) continue;
           const t = getLocalCalendarTimestamp(b.date) || new Date(b.date).getTime() || 0;
           if (t > max) max = t;
         }
         if (max > 0) return max;
       }

       // Fallback to component creation date if no batches or valid batch dates exist
       const creationDate = (comp as any).createdAt || (comp as any).createdDate || (comp as any).dateAdded;
       if (creationDate) {
         const t = getLocalCalendarTimestamp(creationDate) || new Date(creationDate).getTime() || 0;
         if (t > 0) return t;
       }

       // ID timestamp fallback (e.g. comp-1729000000000-...)
       const idMatch = String(comp.id || '').match(/^(?:comp|item)-(\d{10,13})/);
       if (idMatch) {
         const idTime = parseInt(idMatch[1], 10);
         if (!isNaN(idTime) && idTime > 0) return idTime;
       }

       return 0;
     }
     ```
   - In `filterAndSortComponents`:
     - Update default/`'newest-purchase'` sort:
       `return getComponentLatestPurchaseTimestamp(b) - getComponentLatestPurchaseTimestamp(a);`
     - Update tie-breaking fallback in `'highest-health'` and `'lowest-health'`:
       `return getComponentLatestPurchaseTimestamp(b) - getComponentLatestPurchaseTimestamp(a);`

2. **`src/components/builds/SwapPartModal.tsx`**:
   - Lines 105-107:
     Replace the incomplete `latest(b.validEntries) - latest(a.validEntries)` with `getComponentLatestPurchaseTimestamp(b.comp) - getComponentLatestPurchaseTimestamp(a.comp)`.

3. **Universal Verification Sites**:
   - `src/components/InventoryView.tsx`: verified to invoke `filterAndSortComponents`.
   - `src/components/builds/createBuild/BuildInventoryPicker.tsx`: verified to invoke `filterAndSortComponents`.
   - `src/components/builds/AllocatePartModal.tsx`: verified to invoke `filterAndSortComponents`.
   - `src/components/parts/sellPart/SellPartModal.tsx`: verified to invoke `filterAndSortComponents`.
   - `src/components/parts/sellPart/BulkSaleForm.tsx`: verified to invoke `filterAndSortComponents`.
