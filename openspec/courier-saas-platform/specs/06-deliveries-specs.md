# SDD Specs: Deliveries

**Change:** courier-saas-platform
**Phase:** Specs
**Module:** Deliveries
**Dependencies:** Packages (exists), Users (exists), Branches (exists)

---

## 1. Delivery Types

- ranch — Customer picks up at branch
- home — Delivery to customer's address

## 2. Register Delivery

- **Endpoint:** POST /api/v1/deliveries
- **Actor:** Administrador, Repartidor
- **Input:**
  - packageId (ObjectId, required)
  - type (string, required: "branch" | "home")
  - receiverName (string, required)
  - receiverDocument (string, required)
  - receiverPhone (string, optional)
  - address (string, required if type=home)
  - branchId (ObjectId, defaults to user's branch)
  - notes (string, optional)
  - photos (files, optional)
- **Process:**
  1. Validate package is in disponible or en_reparto status
  2. Register delivery
  3. If type=home: update package status to en_reparto
  4. If type=branch: update package status to entregado
  5. Upload photos to Cloudinary
  6. Emit event: DELIVERY_COMPLETED
  7. Return delivery record

## 3. Complete Home Delivery

- **Endpoint:** PATCH /api/v1/deliveries/:id/complete
- **Actor:** Repartidor
- **Input:** receiverName, receiverDocument, photos, notes
- **Process:**
  1. Update delivery record
  2. Change package status to entregado
  3. Set deliveredAt = now
  4. Emit event

## 4. List Deliveries

- **Endpoint:** GET /api/v1/deliveries
- **Actor:** Administrador, Repartidor
- **Query:** page, limit, type, dateFrom, dateTo, branchId, deliveredById
- **Response:** Paginated list with package and customer info

## 5. Today's Delivery Route

- **Endpoint:** GET /api/v1/deliveries/today
- **Actor:** Repartidor
- **Response:** List of deliveries assigned for today, sorted by address for route optimization

## 6. Delivery Stats

- **Endpoint:** GET /api/v1/deliveries/stats
- **Actor:** Administrador
- **Response:**
  - Today: total, completed, pending
  - By type: branch vs home
  - By delivery person
