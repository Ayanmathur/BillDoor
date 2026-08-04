# Implementation Plan — Digital Business Card Wood-Frame Border Style

Add an optional, minimal, flat wood-frame border style around the **Digital Business Card (`/card/[slug]`)**, controlled by a two-layer toggle pattern (Admin access grant + Client setting choice).

---

## User Review Required

> [!IMPORTANT]
> **Visual Frame Spec Review**
> Please review the flat wood-frame CSS treatment below before implementation begins.
>
> - **Width**: `11px` flat border (`#8B6544` warm walnut/tan).
> - **Corner Accent**: Subtle flat dark corner accent line (`#5C4033`).
> - **Card Interior**: 100% untouched navy/gold design system, typography, logo, and action buttons.
> - **No illustrated texture photos, no shine, no ropes, no hooks, no animations.**

```css
/* Wood Frame Border Treatment for Digital Business Card (/card/[slug]) */
.card-container.framed-wood {
  border: 11px solid #8B6544; /* Flat warm walnut/tan border */
  border-radius: var(--radius-xl, 20px);
  position: relative;
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.2), 0 4px 10px -2px rgba(0, 0, 0, 0.08);
}

/* Subtle flat corner accents (picture-frame miter effect) */
.card-container.framed-wood::before {
  content: '';
  position: absolute;
  inset: -11px;
  border: 1px solid #5C4033; /* Darker walnut inner miter accent */
  border-radius: var(--radius-xl, 20px);
  pointer-events: none;
  z-index: 2;
}
```

> [!NOTE]
> **Scope Scoping Constraint**:
> This frame style is strictly scoped to `/card/[slug]`. The Digital Catalog (`/catalog/[slug]`) and Digital Bill (`/bill/[slug]`) remain barebones and untouched per design system rules.

---

## Proposed Changes

### Database Migration

#### [NEW] [add_framed_card_enabled_column.sql](file:///D:/Projects/BillDoor/supabase/migrations/20260804000000_add_framed_card_enabled.sql)
- Add `framed_card_enabled` boolean column to `clients` table (default `false`).

---

### Admin Portal

#### [MODIFY] [actions.ts](file:///D:/Projects/BillDoor/admin-portal/src/app/dashboard/actions.ts)
- Update client creation and update server actions to accept `framedCardEnabled` boolean.

#### [MODIFY] [page.tsx](file:///D:/Projects/BillDoor/admin-portal/src/app/dashboard/page.tsx)
- Add "Framed Business Card Access" toggle checkbox in the Admin Client Management drawer/modal.

---

### Client Portal (Settings & Fetch Actions)

#### [MODIFY] [actions.ts](file:///D:/Projects/BillDoor/client-portal/src/app/dashboard/settings/actions.ts)
- Update `fetchSettingsAction` to return `framed_card_enabled` and `bill_settings.card_frame_style`.
- Update `updateBusinessInfoAction` or `updateBillitSettingsAction` to accept `cardFrameStyle?: 'plain' | 'framed'`.

#### [MODIFY] [page.tsx](file:///D:/Projects/BillDoor/client-portal/src/app/dashboard/settings/page.tsx)
- Add **Card Frame Style** selector (`Plain` vs `Warm Wood Frame`) under Business / Card Settings, visible only when `framed_card_enabled === true`.

---

### Public Business Card Portal (`/card/[slug]`)

#### [MODIFY] [actions.ts](file:///D:/Projects/BillDoor/client-portal/src/app/card/%5Bslug%5D/actions.ts)
- Include `framed_card_enabled` and `bill_settings` in the `select` query of `fetchBusinessCardAction`.

#### [MODIFY] [page.tsx](file:///D:/Projects/BillDoor/client-portal/src/app/card/%5Bslug%5D/page.tsx)
- Conditionally apply `className="card-container framed-wood"` when `client.framed_card_enabled === true` AND `client.bill_settings?.card_frame_style === 'framed'`.

#### [MODIFY] [card.css](file:///D:/Projects/BillDoor/client-portal/src/app/card/%5Bslug%5D/card.css)
- Add `.card-container.framed-wood` CSS rules for flat warm walnut border (`#8B6544`) and miter corner accent (`#5C4033`).

---

## Verification Plan

### Automated Tests
- Run `scratch/test_all_toggles_and_lifecycle.ts` to verify DB schema and toggle conditions.
- Run `npm --prefix client-portal run build` and `npm --prefix admin-portal run build` to confirm 0 build errors.

### Manual Verification
1. Log in to Admin Portal -> Turn `framed_card_enabled` ON for client.
2. Log in to Client Portal -> Open Settings -> Select "Warm Wood Frame" -> Save.
3. Open `/card/[slug]` -> Verify 11px warm walnut border and corner accent wrap the card.
4. Verify interior layout, text, icons, logo white background `#ffffff`, and buttons are 100% untouched.
5. Verify `/catalog/[slug]` is strictly unaffected.
