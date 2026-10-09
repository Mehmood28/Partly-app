# Revert AI Bulk Import to Stable Extraction & Clean Staging

Rollback the AI Bulk Import pipeline to its clean, reliable staging table workflow by eliminating the over-engineered semantic matching engine (`catalogMatcher.ts`), stripping out the auto-link badges and override dropdowns from the staging modal, restoring an intuitive, unencumbered LLM extraction prompt, and safeguarding the calendar-day calculation for "Last PC Sale".

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed during Phase 1:
> - **Removal of `catalogMatcher.ts`**: Confirmed to delete `src/utils/catalogMatcher.ts` completely to keep the codebase clean and avoid dead weight.
> - **Stock Update & Inventory Ingestion**: Confirmed to use deterministic exact name and category matching against existing catalog components (via `handleAddComponents` / `findUniqueCatalogMatchIndex`) to update existing stock batches or add new components.
> - **Metadata Precedence**: Confirmed that line-item details strictly override global header values (e.g. if a global header states "Condition: New No Box", but an individual line notes "used", the item remains "Used Open Box").

---

## 1. Overview & Core Concept

- **What It Does**: The Fast Bulk Stock Entry modal allows users to paste raw text lists, unstructured supplier notes, or scan invoice receipts. The AI engine parses these inputs into structured hardware component entries (Name, Category, Quantity, Unit Cost, Condition, Seller, Date, Payment, and Tags) presented in a clean, high-density staging table. The user visually reviews and adjusts fields, then confirms to commit them to inventory.
- **Target Audience / Persona**: PC builders, repair technicians, and hardware resellers who frequently process batches of parts from varied suppliers and need rapid, trustworthy stock ingestion without fighting rigid automated linkage algorithms.
- **Key Value**: Restores speed, reliability, and visual clarity. Eliminates parsing degradation caused by overly complex prompt instructions, eliminates layout clutter from auto-link dropdowns and confidence badges, and returns to a predictable, human-in-the-loop workflow.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Input Phase**:
   - The user opens "Fast Bulk Stock Entry".
   - Either pastes unstructured text (e.g. `Supplier: Roop | Date: 2026-10-09\nRyzen 7 7800X3D $420\nMSI RTX 4070 Super Ventus $750`) or uploads receipt images.
   - Optionally toggles "Add to Existing Purchase" to tie all items to a prior purchase transaction.
   - Clicks "Extract Parts".

2. **Clean Staging & Review Phase**:
   - The modal transitions smoothly into the Quick Review workspace.
   - Each extracted component is displayed in a dedicated, high-density form row without distracting badges, confidence percentages, or overflowing destination select dropdowns.
   - Fields (Name, Category, Quantity, Unit Cost, Condition, Seller, Date, Payment, and Subcategory Tag chips) are cleanly aligned and editable.
   - Global header values (Seller, Date, Condition, Payment) are cleanly cascaded into each item unless overridden by the line item itself.
   - Individual items can be removed via the "Remove" button, or the entire batch can be cleared via "Start Over".

3. **Confirmation & Ingestion Phase**:
   - The user clicks "Confirm & Save All to Stock" (or "Confirm & Append to Purchase Record").
   - Staging items are committed: items matching an existing catalog component by exact name and category append a new purchase batch to that component; otherwise, a fresh catalog component is created.
   - Modal resets and closes with a success notification.

### Visual Identity & Layout Disciplines

- **Anti-Slop Restraint**: Zero pill badge sandwiches, no floating pseudo-match confidence percentages, and no noisy status chips crowding the row headers.
- **High-Density Data Grid**: Row heights kept compact ($36\text{px}$–$44\text{px}$ inputs) with tabular figures (`font-mono`) on currency and quantity fields.
- **Strict Label Alignment**: Inputs and labels sit flush with zero offset padding, honoring the design system layout principles.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Complete Removal vs Retaining `catalogMatcher.ts`**
  - *Chosen Approach*: Completely delete `src/utils/catalogMatcher.ts`.
  - *Why*: User confirmed deletion. Retaining unused 450-line heuristic matcher code creates tech debt, confusion, and potential regressions.
  - *Alternatives Considered*: Retaining as an unused helper was rejected to keep codebase pristine.

- **Decision 2: Reverting Complex LLM Rulebook to Natural Canonical Extraction**
  - *Chosen Approach*: Strip out the exhaustive VRAM inference matrices (5090, 5080, 4070 Ti Super, etc.), RAM CAS timing rules, and strict PCIe generation mandates from `server.ts`. Maintain the clear boundary between Shared Metadata Headers and Hardware Items, cascading global metadata, and line-item override rules.
  - *Why*: Overly rigid prompt rules degraded the model's fundamental parsing capabilities, causing it to misclassify header lines as items or drop necessary context. A natural extraction instruction produces superior, robust structured JSON.
  - *Alternatives Considered*: Keeping the VRAM matrix was rejected because edge cases continuously broke other component extractions.

- **Decision 3: Preserving Calendar-Day Calculation for "Last PC Sale"**
  - *Chosen Approach*: Protect `formatRelativeCalendarDate` and `getLocalCalendarTimestamp` in `src/utils/helpers.ts` and their integration in `src/components/home/DashboardQuickStats.tsx`.
  - *Why*: The recent calendar-day fix (calculating whole-calendar-day offsets rather than 24-hour elapsed timestamps) is stable, tested, and requested to remain strictly untouched.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│               Client: Fast Bulk Stock Entry                 │
│                 (BulkStockEntryModal.tsx)                   │
├─────────────────────────────────────────────────────────────┤
│  1. User Input: Unstructured Text / Receipt Images          │
│  2. POST /api/parse-bulk-entry                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Server API: Express Router                  │
│                        (server.ts)                          │
├─────────────────────────────────────────────────────────────┤
│  • Gemini 3.8 Flash with Type.ARRAY JSON Schema             │
│  • Prompt: Clear Separation of Global Headers vs Line Items │
│  • Cascades Seller, Date, Condition, Payment to line items  │
│  • Line-item details override global header values          │
│  • Post-processing: Filters header rows & cleans names      │
│  • Deterministic fallback parser on quota/network error     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Clean Staging Table (Modal Workspace)           │
│                 (BulkStockEntryModal.tsx)                   │
├─────────────────────────────────────────────────────────────┤
│  • High-density editable rows (Name, Cat, Qty, Cost, etc.)  │
│  • NO matching engine, NO confidence %, NO Link dropdowns   │
│  • User visually audits and edits fields                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ "Confirm & Save All"
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           Inventory State Engine (handleAddComponents)      │
│                   (componentActions.ts)                     │
├─────────────────────────────────────────────────────────────┤
│  • Deterministic exact name + category check                │
│    (findUniqueCatalogMatchIndex)                            │
│  • Match found  ─► Appends purchase batch to existing part  │
│  • No match     ─► Creates new catalog component            │
│  • Optional: Appends to targeted purchase transaction       │
└─────────────────────────────────────────────────────────────┘
```

### Component State & Handler Mapping

1. **`BulkStockEntryModal.tsx`**:
   - `parsedItems`: Array of `ParsedBulkStockItem` without `matchedComponentId`, `matchedComponentName`, `matchConfidence`, or `candidates`.
   - `handleParse`: Sends input to `/api/parse-bulk-entry`, receives array, strips any residual header rows defensively, cascades global metadata, sets `parsedItems`.
   - `updateParsedItem`: Direct field mutator for Quantity, Unit Cost, Condition, Seller, Date, Payment, and Health.
   - `handleNameChange`: Direct name updater without invoking catalog matching.
   - `handleCategoryChange`: Category updater with automatic tag pruning for valid subcategories.
   - `handleConfirm`: Dispatches `onSaveAll` with final clean items.

2. **`server.ts`**:
   - Revert prompt to natural canonical hardware extraction.
   - Maintain Header vs Line Item prohibition and cascading instructions.
   - Line-item details override global header values.
   - Preserve deterministic regex fallback for offline/quota resiliency.

3. **`src/utils/catalogMatcher.ts`**:
   - Delete file completely.

4. **Preservation Invariant**:
   - `src/utils/helpers.ts` (`formatRelativeCalendarDate`, `getLocalCalendarTimestamp`) and `src/components/home/DashboardQuickStats.tsx` remain unmodified.
