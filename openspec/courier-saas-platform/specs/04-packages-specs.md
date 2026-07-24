# SDD Specs: Packages

**Change:** `courier-saas-platform`
**Phase:** Specs
**Module:** Packages
**Dependencies:** Customers (exists), Branches (exists), Auth

---

## 1. Package States

Estado | Descripción | Transiciones posibles
-------|-------------|----------------------
`recibido_miami` | Recibido en warehouse de Miami | `almacen_miami`
`almacen_miami` | En almacén Miami, pending to ship | `en_transito`
`en_transito` | En vuelo/barco hacia RD | `llego_rd`
`llego_rd` | Llegó a RD, en aduana | `almacen_rd`
`almacen_rd` | En almacén RD, pending pickup | `disponible`, `cancelado`, `extraviado`
`disponible` | Listo para entrega | `en_reparto`, `entregado`, `cancelado`
`en_reparto` | En ruta de entrega a domicilio | `entregado`, `disponible` (devuelto)
`entregado` | Entregado al cliente | (terminal)
`cancelado` | Cancelado por el cliente | (terminal)
`extraviado` | Pérdida reportada | (terminal)

**Reglas de negocio:**
- Un paquete solo puede avanzar en la cadena de estados (excepto cancelado/extraviado)
- Para volver a estado anterior se requiere rol Administrador
- Cada cambio de estado genera:
  1. Registro en `packagehistories`
  2. Registro en `activitylogs`
  3. Notificación al cliente (in-app + email si configurado)
  4. Evento Socket.io (actualización en tiempo real)

## 2. Create Package

- **Endpoint:** `POST /api/v1/packages`
- **Actor:** Administrador, Recepción
- **Input:**
  - customerId (ObjectId, required)
  - description (string, required, max 500 chars)
  - weight (number, required, positive, max 500 lbs)
  - length (number, optional)
  - width (number, optional)
  - height (number, optional)
  - declaredValue (number, optional, in USD)
  - notes (string, optional, max 500 chars)
  - branchId (ObjectId, defaults to user's branch)
  - photos (array of files, optional, max 5, 5MB each)
- **Process:**
  1. Validate input with Zod
  2. Auto-generate tracking number: `{companyPrefix}-{YYYYMMDD}-{sequential 4-digit}`
     - Company prefix from company slug (e.g., RPD for rapidbox)
  3. Calculate cost:
     - baseCost = weight × pricePerLb (from settings)
     - if baseCost < minimumPrice → baseCost = minimumPrice
     - tax = baseCost × taxRate / 100
     - total = baseCost + tax
  4. If photos uploaded: Multer → Cloudinary → store URLs
  5. Initial status: `recibido_miami`
  6. Save package
  7. Create first PackageHistory entry
  8. Emit events: `PACKAGE_CREATED`, `PACKAGE_STATUS_CHANGED`
  9. Return created package with tracking number
- **Response:** Full package object + tracking URL

## 3. List Packages

- **Endpoint:** `GET /api/v1/packages`
- **Actor:** All roles (filtered by permissions)
- **Query Params:**
  - page, limit
  - search (tracking, customer name, description)
  - status (one or more states)
  - branchId
  - customerId
  - dateFrom, dateTo (filter by receivedAt)
  - isPaid (boolean)
  - sortBy, sortOrder
- **Response:** Paginated list with customer info embedded

## 4. Get Package by Tracking

- **Endpoint:** `GET /api/v1/packages/:tracking`
- **Actor:** All roles + Client panel (own packages)
- **Response:** Full package detail + history + customer info

## 5. Get Package by ID

- **Endpoint:** `GET /api/v1/packages/id/:id`
- **Actor:** All roles
- **Response:** Full package detail

## 6. Update Package

- **Endpoint:** `PATCH /api/v1/packages/:id`
- **Actor:** Administrador, Recepción
- **Input:** Same as create, all optional
- **Rules:**
  - Cannot change tracking number
  - Cannot change status here (use dedicated endpoint)
  - Changing customerId: verify customer exists
  - Changing weight: recalculate cost
- **Response:** Updated package

## 7. Change Package Status

- **Endpoint:** `PATCH /api/v1/packages/:id/status`
- **Actor:** Depends on the status transition
- **Input:**
  - status (string, required — new status)
  - notes (string, optional)
  - branchId (ObjectId, optional — for branch transfers)
- **Process:**
  1. Validate transition is allowed
  2. If transitioning to `entregado`: require deliveryId or create delivery record
  3. If transitioning to `cancelado`: require reason in notes
  4. Update status
  5. If `entregado`: set deliveredAt = now
  6. Create PackageHistory entry
  7. Emit events
  8. If status is `disponible`: trigger notification "Tu paquete está listo para recoger"
- **Response:** Updated package

## 8. Upload Package Photos

- **Endpoint:** `POST /api/v1/packages/:id/photos`
- **Actor:** Administrador, Recepción, Almacén
- **Input:** Files (multipart, max 5, 5MB each)
- **Process:** Multer → Cloudinary → append URLs to package.photos array
- **Response:** Updated photos array

## 9. Get Package History

- **Endpoint:** `GET /api/v1/packages/:id/history`
- **Actor:** All roles
- **Response:** Array of status changes with timestamps, user, notes

## 10. Delete Package (Soft)

- **Endpoint:** `DELETE /api/v1/packages/:id`
- **Actor:** Administrador
- **Rules:**
  - Cannot delete if delivered
  - Sets isActive = false (soft delete concept via status=cancelado with system note)

## 11. Package Cost Calculation

```javascript
// Calculation logic
const rate = await settings.get('price_per_lb');    // e.g., 350 DOP/lb
const minimum = await settings.get('minimum_price');  // e.g., 500 DOP
const taxRate = await settings.get('tax_rate');       // e.g., 18%

let baseCost = package.weight * rate;
if (baseCost < minimum) baseCost = minimum;
const tax = baseCost * (taxRate / 100);
const total = baseCost + tax;

// Cost breakdown stored in package:
// { "cost": baseCost, "shippingCost": baseCost, "tax": tax, "total": total }
```

## 12. Tracking Number Format

```
{COMPANY_PREFIX}-{YYYYMMDD}-{NNNN}

Examples:
RPD-20260724-0001
RPD-20260724-0002
FCG-20260724-0001   (fastcargo)

Company prefix: first 3 letters of slug, uppercase
Sequence: resets daily
```