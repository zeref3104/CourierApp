# SDD Specs: Payments & Receipts

**Change:** courier-saas-platform
**Phase:** Specs
**Module:** Payments & Receipts
**Dependencies:** Packages (exists), Customers (exists), Branches (exists)

---

## 1. Payment States

- pending — Package created, not yet paid
- paid — Payment registered
- efunded — Payment reversed

## 2. Register Payment

- **Endpoint:** POST /api/v1/payments
- **Actor:** Administrador, Caja
- **Input:**
  - packageId (ObjectId, required)
  - customerId (ObjectId, required)
  - amount (number, required, positive)
  - method (string, required: "cash", "card", "transfer")
  - notes (string, optional)
- **Process:**
  1. Validate input
  2. Verify package exists and belongs to customer
  3. Check that package is not already fully paid
  4. Create payment record
  5. Auto-generate receipt number: RCP-{YYYYMMDD}-{NNNN}
  6. If amount >= package.total: mark package isPaid = true
  7. Generate receipt
  8. Emit event PAYMENT_RECEIVED
  9. Return payment + receipt
- **Response:** Payment + Receipt objects

## 3. List Payments

- **Endpoint:** GET /api/v1/payments
- **Actor:** Administrador, Caja
- **Response:** Paginated payments with package and customer info

## 4. Get Payment Detail

- **Endpoint:** GET /api/v1/payments/:id
- **Actor:** Administrador, Caja
- **Response:** Full payment + receipt URL

## 5. Partial Payments

- A package can have multiple payments (partial)
- Total paid = sum of all payments for that package
- isPaid = true when total paid >= package.total

## 6. Generate Receipt (PDF)

- **Endpoint:** POST /api/v1/payments/:id/receipt
- **Actor:** Administrador, Caja
- **Process:**
  1. Generate receipt PDF with company info, customer, package, cost breakdown
  2. Upload PDF to Cloudinary
  3. Store receipt URL
- **Response:** PDF URL

## 7. Get Daily Cash Summary

- **Endpoint:** GET /api/v1/payments/summary/daily
- **Actor:** Administrador, Caja
- **Response:** Total collected by method, pending count, transaction count
