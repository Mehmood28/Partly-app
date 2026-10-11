# Tag Selection & Multi-Tag Filtering Accuracy Fix

Resolve tag filtering issues where selecting multiple tags (e.g., `ATX` and `White`) incorrectly includes parts with conflicting or substring tags (such as `mATX` cases showing up under `ATX`), ensuring accurate part matching across all inventory and build pickers.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed based on user feedback:

- **Confirmed Decision 1**: Tag matching will prioritize explicitly assigned tags (`comp.tags`). If a component already has an explicit tag in a tag group (e.g. `mATX` in the Form Factor group), it will strictly respect that tag and never fall back to matching `ATX` from the component name. For untagged items, matching will use strict whole-word boundary token matching.
- **Confirmed Decision 2**: The fix applies uniformly across all views where tags are selected or filtered:
  - **Stock / Inventory View** (`InventoryView.tsx`)
  - **Swap Part Modal** (`SwapPartModal.tsx`)
  - **Allocate Part Modal** (`AllocatePartModal.tsx`)
  - **Create Build Part Picker** (`BuildInventoryPicker.tsx`)

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades the inventory filtering engine (`filterAndSortComponents` and `determineSubCategory`) so multi-tag selections (e.g., selecting `ATX` and `White`) strictly filter for parts that match all selected tags. Eliminates substring collisions like `mATX` matching `ATX`, `Non-RGB` matching `RGB`, and `mITX` matching `ITX`.
- **Target Audience / Persona**: PC builders and inventory managers filtering through hundreds of stock components who need exact, reliable results when selecting form factors, colors, and hardware generations.
- **Key Value**: Accurate inventory filtering prevents selecting incompatible parts (like putting an mATX case into an ATX build filter) and ensures search and tag filters work with zero false positives.

---

### 2. User Experience & Visual Design

- **Tag Selection Flow**:
  - The user taps a category (e.g. `Case`).
  - The user taps a Form Factor tag (e.g. `ATX`) and a Color tag (e.g. `White`).
  - Both tags illuminate with the active accent highlight (`#B9EF68`).
  - The filtered list updates instantly, showing **only** parts that are both `ATX` and `White`.
  - Parts tagged or titled with `mATX` or `ITX` are strictly excluded.
- **Empty States & Feedback**:
  - If no components match the combined tag criteria (e.g., `ITX` + `White` with 0 available stock), the clean "No parts found / No compatible parts found" empty state is displayed with clear guidance.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Tag-First Resolution with Conflict Elimination**:
  - *Chosen Approach*: When a part has explicit tags (`comp.tags`), check if any tag belongs to the same mutually exclusive group as the target tag. If the part has an explicit tag from that group (e.g. `mATX` when searching for `ATX`), immediately reject it without falling back to fuzzy text matching.
  - *Why*: Eliminates false positives when a part name mentions other terms or contains substrings.
  - *Alternatives Considered*: Pure substring search (caused the current bug); strict tags-only (would break legacy or un-tagged inventory items).

- **Decision 2: Token-Level Boundary Matching for Untagged Fallbacks**:
  - *Chosen Approach*: If a component has no tags in a given group, evaluate `name` and `specifications` using isolated word/token boundary regexes that guard against prefixes (e.g., `(?<![a-z0-9\-])atx(?![a-z0-9])` with explicit exclusion of `m-?atx`, `micro-?atx`, `e-?atx`, and `non-rgb`).
  - *Why*: Preserves support for untagged parts while guaranteeing that "Starlight mATX White" will never match an "ATX" filter.

- **Decision 3: Centralized Engine Upgrade**:
  - *Chosen Approach*: Implement `matchesComponentTag` and update `filterAndSortComponents` and `determineSubCategory` in `src/utils/helpers.ts`.
  - *Why*: All four views (`InventoryView`, `SwapPartModal`, `AllocatePartModal`, `BuildInventoryPicker`) consume `filterAndSortComponents`, guaranteeing 100% consistent behavior across the entire app with zero code duplication.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Tag Filter Selection                       │
│             e.g. Active Sub-Tags: ["ATX", "White"]                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   filterAndSortComponents(...) Engine                  │
│                                                                        │
│   For each selected sub-tag, evaluate matchesComponentTag(comp, tag):  │
│                                                                        │
│   1. Explicit Tag Check:                                               │
│      - comp.tags has exact tag? ───────────────► MATCH (true)          │
│      - comp.tags has conflicting tag from same                         │
│        mutually exclusive group (e.g. mATX)? ──► REJECT (false)        │
│                                                                        │
│   2. Fallback for Untagged Dimensions:                                 │
│      - Token/word boundary match in name/specs                         │
│        excluding negative & parent tokens? ────► MATCH (true)          │
│      - Otherwise ──────────────────────────────► REJECT (false)        │
│                                                                        │
│   3. Combined Tag Enforcement (AND):                                   │
│      - Every selected tag must return MATCH!                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Filtered Part Lists                           │
│  ├─ Stock / Inventory Tab (InventoryView.tsx)                          │
│  ├─ Swap Case / Swap Part Modal (SwapPartModal.tsx)                    │
│  ├─ Allocate Part Modal (AllocatePartModal.tsx)                        │
│  └─ Create Build Picker (BuildInventoryPicker.tsx)                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed State & Implementation Steps:

1. **`src/utils/helpers.ts`**:
   - Implement `matchesComponentTag(comp: InventoryComponent, targetTag: string, category?: string): boolean`:
     - Normalize target tag (case-insensitive).
     - Identify if target tag belongs to a known tag group (e.g. `Form Factor: ['ATX', 'mATX', 'ITX']`, `Color: ['Black', 'White']`, `Lighting: ['RGB', 'Non-RGB']`, etc.).
     - Check explicit `comp.tags`:
       - If `comp.tags` contains target tag: return `true`.
       - If `comp.tags` contains another tag from the same group: return `false` (explicit conflict).
     - For components without a tag in that group, perform word-boundary token matching on `comp.name` and `comp.specifications`:
       - Special handling for form factors (`atx` does not match `matx`, `micro-atx`, `eatx`).
       - Special handling for lighting (`rgb` does not match `non-rgb`).
       - Special handling for RAM generations (`ddr4` vs `ddr5`).
   - Update `filterAndSortComponents`:
     - Multi-tag filtering verifies `options.subTags.every(tag => matchesComponentTag(comp, tag, options.category))`.
     - Single subCategory filtering verifies `matchesComponentTag(comp, options.subCategory, options.category)`.
   - Update `determineSubCategory`:
     - Prioritize explicit `comp.tags` first.
     - When matching against name/specs, sort candidate tags by specificity (e.g. `mATX` and `ITX` before `ATX`, `Non-RGB` before `RGB`) and use token-bounded matching.

2. **Verify All Consuming Views**:
   - Verify `InventoryView.tsx`, `SwapPartModal.tsx`, `AllocatePartModal.tsx`, and `BuildInventoryPicker.tsx`.
   - Confirm active subtag toggle handlers properly clear conflicting tags using `getConflictingTags`.

3. **Validation & Quality Assurance**:
   - Verify cases like "Starlight mATX White" are correctly excluded when `ATX` + `White` are selected.
   - Verify that true ATX cases (e.g., "Lian Li O11 Vision Compact White") remain displayed when `ATX` + `White` are selected.
   - Verify "Starlight mATX White" appears when `mATX` + `White` are selected.
   - Verify RAM lighting (`RGB` vs `Non-RGB`), platform (`AM4` vs `AM5`), and cooler sizes work correctly.
   - Run compilation and linting to ensure zero regressions.
