# Proposal: Responsive Layout

## Intent

CourierApp is desktop-only. Sidebar has no drawer mode, tables only use `overflow-x-auto`, forms with `grid grid-cols-2` break on mobile, and pagination crowds on small screens. Users accessing from tablets or phones cannot operate the app. This change makes the entire UI usable across mobile, tablet, and desktop without altering backend or business logic.

## Scope

### In Scope
- Sidebar: drawer overlay with hamburger toggle on `<768px`, collapsible on desktop
- Navbar: hamburger button for mobile drawer trigger
- AdminLayout + ClientLayout: responsive wrappers with breakpoint logic
- Table: card view on `<640px` using `useMediaQuery`
- Modal: fullscreen variant on `<640px`
- Pagination: compact layout (prev/next only) on `<480px`
- Forms: `grid-cols-1 md:grid-cols-2` on all form pages
- `useMediaQuery` hook — shared breakpoint utility
- `uiSlice`: add `sidebarOpen` state for mobile drawer

### Out of Scope
- Backend, business logic, data model changes
- New features or pages
- Dark/light theme adjustments not related to responsive layout
- Animations beyond basic drawer slide-in

## Capabilities

### New Capabilities
- `responsive-layout`: responsive sidebar drawer, table card view, modal fullscreen variant, compact pagination, form grid breakpoints, and a shared `useMediaQuery` hook.

### Modified Capabilities
- None — no existing spec changes behavior at the requirements level.

## Approach

1. **`useMediaQuery` hook** — shared utility wrapping `matchMedia` with React state sync
2. **`uiSlice`** — add `sidebarOpen` boolean for mobile drawer control
3. **Sidebar** — wrap in `<div>` that renders as fixed overlay drawer on `<768px` (with backdrop), and inline collapsible on desktop
4. **Navbar** — add hamburger button visible on `<768px` that dispatches `sidebarOpen`
5. **AdminLayout** — add `lg:ml-64` margin shift, relative positioning for drawer
6. **ClientLayout** — simple responsive nav collapse with hamburger
7. **Table** — detect `<640px` via `useMediaQuery`, render `<div className="space-y-3">` card list instead of `<table>`, each row becomes a card with header labels
8. **Modal** — when `<640px`, switch to `fixed inset-0 rounded-none w-full h-full` (fullscreen)
9. **Pagination** — on `<480px`, hide numbered buttons, show only "Anterior / Siguiente" + page counter
10. **Form pages** — change `grid grid-cols-2` to `grid grid-cols-1 md:grid-cols-2`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/hooks/useMediaQuery.ts` | New | Shared `matchMedia` hook |
| `apps/web/src/store/slices/uiSlice.ts` | Modified | Add `sidebarOpen` state + reducers |
| `apps/web/src/components/layout/Sidebar.tsx` | Modified | Drawer mode + backdrop overlay |
| `apps/web/src/components/layout/Navbar.tsx` | Modified | Hamburger button on mobile |
| `apps/web/src/components/layout/AdminLayout.tsx` | Modified | Responsive margin/positioning |
| `apps/web/src/components/layout/ClientLayout.tsx` | Modified | Mobile nav collapse |
| `apps/web/src/components/ui/Table.tsx` | Modified | Card view on `<640px` |
| `apps/web/src/components/ui/Modal.tsx` | Modified | Fullscreen on `<640px` |
| `apps/web/src/components/ui/Pagination.tsx` | Modified | Compact mobile variant |
| `apps/web/src/pages/admin/customers/CustomerFormPage.tsx` | Modified | Grid breakpoint fix |
| `apps/web/src/pages/admin/payments/PaymentFormPage.tsx` | Modified | Grid breakpoint fix |
| `apps/web/src/pages/admin/users/UserFormPage.tsx` | Modified | Grid breakpoint fix |
| `apps/web/src/pages/admin/packages/PackageFormPage.tsx` | Modified | Grid breakpoint fix (if any) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sidebar state conflict (`sidebarCollapsed` + `sidebarOpen`) | Medium | Separate concerns: `collapsed` = desktop toggle, `open` = mobile drawer. Mutually exclusive via breakpoint. |
| Cards without explicit `<Select>` adaptation | Low | Select already wraps via full-width by default. Verify each form page after merge. |
| Manual testing required for all breakpoints | High | Use browser DevTools device emulation. No E2E tests exist yet — defer to future SDD. |

## Rollback Plan

Revert all 12-15 files via `git checkout` on each modified file, then restore `uiSlice.ts` from its previous commit. No DB migration or config change is involved.

## Dependencies

- TailwindCSS `lg:` (`1024px`), `md:` (`768px`), `sm:` (`640px`) breakpoints — already configured
- React 18 / Redux Toolkit — already in use

## Success Criteria

- [ ] Sidebar renders as drawer overlay on `<768px` with backdrop, opens/closes via hamburger
- [ ] Tables render as stacked cards on `<640px` with all columns readable
- [ ] Modals go fullscreen on `<640px` (no rounded corners, full width/height)
- [ ] Pagination shows compact layout on `<480px` (no numbered buttons)
- [ ] All `grid-cols-2` forms wrap to single column on mobile via `md:` breakpoint
- [ ] All pages are usable at 375px width without horizontal scroll
