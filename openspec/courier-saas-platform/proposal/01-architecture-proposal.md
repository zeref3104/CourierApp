# SDD Proposal: Courier SaaS Platform

**Change:** `courier-saas-platform`
**Status:** Proposed
**Author:** Gentle AI — Senior Architect

---

## 1. Intent & Motivation

Construir una plataforma SaaS multi-tenant para empresas de Courier que cubra la operación diaria completa: recepción de paquetes desde Miami, almacenamiento, distribución local en RD, gestión de clientes, caja, pagos, entregas, reportes y un panel de cliente.

**¿Por qué Database Per Tenant?**

- Aislamiento total de datos entre empresas competidoras
- Backup y restore independiente por cliente
- Escalabilidad horizontal: migrar un tenant grande a su propio cluster sin tocar a los demás
- Cumplimiento regulatorio: si un cliente exige borrar sus datos, se dropea la DB entera
- Latencia: cada tenant opera en su propio espacio de índices y colecciones

**¿Por qué no single DB con `tenant_id`?**

- Una consulta mal escrita de un tenant puede degradar la performance de todos
- Backup monolítico: restaurar un tenant requiere operaciones complejas
- Riesgo de fuga de datos entre tenants por errores en queries
- Escalabilidad limitada: un tenant grande forza recursos para todos

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
Internet
    │
    ├── subdomain: rapidbox.midominio.com
    │
    ▼
DNS → Nginx / Load Balancer
    │
    ▼
[Docker: courier-api (Node.js + Express)]
    │
    ├── Middleware Pipeline
    │   ├── Helmet
    │   ├── CORS
    │   ├── Rate Limiter
    │   ├── Tenant Resolver ← Extrae subdominio, busca en Master DB
    │   ├── Connection Manager ← Obtiene/conexión a Tenant DB
    │   └── Auth Middleware ← JWT + RBAC
    │
    ├── Routes → Controllers → Services → Repositories → MongoDB
    │                                              ├── Master DB
    │                                              └── Tenant DB (pool)
    │
    └── Socket.io (notificaciones en tiempo real)
            │
            ▼
    [Docker: courier-web (React + Vite + TailwindCSS)]
            │
            ├── Panel Administrativo (roles: admin, caja, recepción, almacén, repartidor)
            └── Panel Cliente (responsive, futuro React Native)
```

### 2.2 Request Lifecycle

```
1. Request → GET https://rapidbox.midominio.com/api/v1/packages
2. DNS resuelve a la IP del servidor
3. Express recibe la request
4. Tenant Resolver middleware:
   a. Extrae subdominio "rapidbox" del header Host
   b. Busca "rapidbox" en Master DB → obtiene tenant config + dbName
   c. Connection Manager devuelve conexión a "courier_rapidbox" (pool)
   d. Adjunta tenant info a req.tenant
5. Auth Middleware:
   a. Extrae JWT del header Authorization
   b. Verifica firma y expiración
   c. Verifica que el token pertenece a este tenant
   d. Adjunta usuario a req.user
6. Route → llama al Controller
7. Controller → extrae params, llama al Service
8. Service → orquesta lógica de negocio, llama al Repository
9. Repository → ejecuta query contra Tenant DB
10. Response → Response Wrapper formatea y devuelve
```

---

## 3. Folder Structure

### 3.1 Backend — `apps/api/`

```
apps/api/
├── src/
│   ├── server.js                    # Entry point: Express app bootstrap
│   ├── config/
│   │   ├── index.js                 # Centralized config (env vars)
│   │   ├── database.js              # MongoDB connection factories
│   │   ├── cloudinary.js            # Cloudinary SDK config
│   │   └── socket.js                # Socket.io initialization
│   │
│   ├── loaders/
│   │   ├── index.js                 # Loader orchestrator
│   │   ├── express.js               # Express middlewares setup
│   │   ├── mongoose.js              # MongoDB connections
│   │   ├── socket.io.js             # Socket.io attachment
│   │   └── winston.js               # Logger configuration
│   │
│   ├── middlewares/
│   │   ├── tenantResolver.js        # Subdomain → Tenant resolution
│   │   ├── auth.js                  # JWT verification
│   │   ├── rbac.js                  # Role-based access control
│   │   ├── validate.js              # Zod validation middleware
│   │   ├── upload.js                # Multer configuration
│   │   ├── rateLimiter.js           # Rate limiting
│   │   └── errorHandler.js          # Global error handler
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.repository.js
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.validation.js
│   │   │   └── auth.dto.js
│   │   │
│   │   ├── companies/               # SuperAdmin: manage tenants
│   │   │   ├── company.controller.js
│   │   │   ├── company.service.js
│   │   │   ├── company.repository.js
│   │   │   ├── company.routes.js
│   │   │   ├── company.validation.js
│   │   │   └── company.dto.js
│   │   │
│   │   ├── customers/
│   │   │   ├── customer.controller.js
│   │   │   ├── customer.service.js
│   │   │   ├── customer.repository.js
│   │   │   ├── customer.routes.js
│   │   │   ├── customer.validation.js
│   │   │   └── customer.dto.js
│   │   │
│   │   ├── packages/
│   │   │   ├── package.controller.js
│   │   │   ├── package.service.js
│   │   │   ├── package.repository.js
│   │   │   ├── package.routes.js
│   │   │   ├── package.validation.js
│   │   │   └── package.dto.js
│   │   │
│   │   ├── payments/
│   │   │   ├── payment.controller.js
│   │   │   ├── payment.service.js
│   │   │   ├── payment.repository.js
│   │   │   ├── payment.routes.js
│   │   │   ├── payment.validation.js
│   │   │   └── payment.dto.js
│   │   │
│   │   ├── deliveries/
│   │   │   ├── delivery.controller.js
│   │   │   ├── delivery.service.js
│   │   │   ├── delivery.repository.js
│   │   │   ├── delivery.routes.js
│   │   │   ├── delivery.validation.js
│   │   │   └── delivery.dto.js
│   │   │
│   │   ├── branches/
│   │   │   ├── branch.controller.js
│   │   │   ├── branch.service.js
│   │   │   ├── branch.repository.js
│   │   │   ├── branch.routes.js
│   │   │   ├── branch.validation.js
│   │   │   └── branch.dto.js
│   │   │
│   │   ├── users/
│   │   │   ├── user.controller.js
│   │   │   ├── user.service.js
│   │   │   ├── user.repository.js
│   │   │   ├── user.routes.js
│   │   │   ├── user.validation.js
│   │   │   └── user.dto.js
│   │   │
│   │   ├── roles/
│   │   │   ├── role.controller.js
│   │   │   ├── role.service.js
│   │   │   ├── role.repository.js
│   │   │   ├── role.routes.js
│   │   │   ├── role.validation.js
│   │   │   └── role.dto.js
│   │   │
│   │   ├── notifications/
│   │   │   ├── notification.controller.js
│   │   │   ├── notification.service.js
│   │   │   ├── notification.repository.js
│   │   │   ├── notification.routes.js
│   │   │   ├── notification.validation.js
│   │   │   └── notification.dto.js
│   │   │
│   │   ├── reports/
│   │   │   ├── report.controller.js
│   │   │   ├── report.service.js
│   │   │   ├── report.repository.js
│   │   │   ├── report.routes.js
│   │   │   └── report.dto.js
│   │   │
│   │   └── dashboard/
│   │       ├── dashboard.controller.js
│   │       ├── dashboard.service.js
│   │       ├── dashboard.repository.js
│   │       ├── dashboard.routes.js
│   │       └── dashboard.dto.js
│   │
│   ├── models/
│   │   ├── master/
│   │   │   ├── Company.js
│   │   │   ├── Plan.js
│   │   │   ├── License.js
│   │   │   └── SuperAdmin.js
│   │   └── tenant/
│   │       ├── User.js
│   │       ├── Role.js
│   │       ├── Permission.js
│   │       ├── Customer.js
│   │       ├── Package.js
│   │       ├── Branch.js
│   │       ├── Payment.js
│   │       ├── Receipt.js
│   │       ├── Notification.js
│   │       ├── Setting.js
│   │       ├── ActivityLog.js
│   │       ├── Report.js
│   │       ├── Rate.js
│   │       ├── Delivery.js
│   │       └── PackageHistory.js
│   │
│   ├── repositories/
│   │   ├── base.repository.js       # Generic CRUD operations
│   │   ├── master/
│   │   │   ├── company.repository.js
│   │   │   ├── plan.repository.js
│   │   │   └── superadmin.repository.js
│   │   └── tenant/
│   │       ├── user.repository.js
│   │       ├── customer.repository.js
│   │       ├── package.repository.js
│   │       └── ... (one per module)
│   │
│   ├── services/
│   │   ├── tenant/
│   │   │   ├── connectionManager.js # Singleton: pool de conexiones
│   │   │   └── tenantResolver.js     # Subdomain → DB resolution
│   │   ├── auth/
│   │   │   ├── jwt.service.js
│   │   │   └── token.service.js
│   │   ├── notifications/
│   │   │   ├── email.service.js
│   │   │   ├── whatsapp.service.js
│   │   │   ├── push.service.js
│   │   │   └── socket.service.js
│   │   ├── upload/
│   │   │   └── cloudinary.service.js
│   │   └── audit/
│   │       └── activityLog.service.js
│   │
│   ├── dto/
│   │   ├── response.dto.js          # Standard API response shape
│   │   ├── pagination.dto.js        # Paginated response shape
│   │   └── error.dto.js             # Error response shape
│   │
│   ├── validators/
│   │   ├── schemas/
│   │   │   ├── auth.schema.js
│   │   │   ├── customer.schema.js
│   │   │   ├── package.schema.js
│   │   │   └── ... (Zod schemas shared with frontend)
│   │   └── index.js                 # Validation middleware factory
│   │
│   ├── events/
│   │   ├── index.js                 # Event emitter setup
│   │   ├── handlers/
│   │   │   ├── packageStatusChanged.js
│   │   │   ├── paymentReceived.js
│   │   │   ├── deliveryCompleted.js
│   │   │   └── newCustomer.js
│   │   └── listeners/
│   │       ├── notification.listener.js
│   │       ├── activityLog.listener.js
│   │       └── socket.listener.js
│   │
│   ├── policies/
│   │   ├── package.policy.js        # Authorization rules for packages
│   │   ├── payment.policy.js
│   │   ├── customer.policy.js
│   │   └── user.policy.js
│   │
│   ├── exceptions/
│   │   ├── HttpException.js
│   │   ├── NotFoundException.js
│   │   ├── UnauthorizedException.js
│   │   ├── ForbiddenException.js
│   │   ├── ValidationException.js
│   │   ├── TenantNotFoundException.js
│   │   └── ConflictException.js
│   │
│   ├── utils/
│   │   ├── apiResponse.js           # Response builder helpers
│   │   ├── asyncHandler.js          # Wrap async route handlers
│   │   ├── generateTracking.js      # Unique tracking number generator
│   │   ├── generateCode.js          # Customer code generator
│   │   ├── pagination.js            # Pagination helper
│   │   ├── sanitizer.js             # Input sanitization
│   │   └── dateUtils.js             # Date manipulation helpers
│   │
│   ├── logs/
│   │   ├── logger.js                # Winston logger instance
│   │   └── morgan.js                # HTTP request logging
│   │
│   └── routes/
│       ├── index.js                 # Route aggregator
│       ├── auth.routes.js
│       ├── superadmin.routes.js     # Routes only for SuperAdmin
│       └── v1/
│           ├── index.js             # Versioned API routes
│           ├── customer.routes.js
│           ├── package.routes.js
│           ├── payment.routes.js
│           └── ... (versioned routes)
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── Dockerfile
├── package.json
└── jsconfig.json                    # JSDoc type checking
```

### 3.2 Frontend — `apps/web/`

```
apps/web/
├── src/
│   ├── main.tsx                     # Entry point
│   ├── App.tsx                      # Router + Providers
│   ├── vite-env.d.ts
│   │
│   ├── config/
│   │   ├── axios.ts                 # Axios instance with interceptors
│   │   ├── constants.ts             # App constants
│   │   └── theme.ts                 # Tailwind theme config overrides
│   │
│   ├── store/
│   │   ├── index.ts                 # Redux store configuration
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── tenantSlice.ts
│   │   │   ├── uiSlice.ts           # Theme, sidebar, modals
│   │   │   ├── packageSlice.ts
│   │   │   ├── customerSlice.ts
│   │   │   └── notificationSlice.ts
│   │   └── middlewares/
│   │       └── apiMiddleware.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTenant.ts
│   │   ├── usePagination.ts
│   │   ├── useDebounce.ts
│   │   └── useSocket.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── package.service.ts
│   │   ├── customer.service.ts
│   │   ├── payment.service.ts
│   │   └── dashboard.service.ts
│   │
│   ├── components/
│   │   ├── ui/                      # Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Breadcrumb.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── Toast.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx       # Sidebar + Navbar + Content
│   │   │   ├── ClientLayout.tsx      # Client panel layout
│   │   │   ├── AuthLayout.tsx        # Login/Register layout
│   │   │   └── Sidebar.tsx
│   │   │
│   │   ├── charts/
│   │   │   ├── AreaChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   └── StatCard.tsx
│   │   │
│   │   └── shared/
│   │       ├── ThemeToggle.tsx
│   │       ├── SearchInput.tsx
│   │       ├── StatusBadge.tsx
│   │       ├── FileUpload.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── DataTable.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── customers/
│   │   │   │   ├── CustomerListPage.tsx
│   │   │   │   ├── CustomerDetailPage.tsx
│   │   │   │   └── CustomerFormPage.tsx
│   │   │   ├── packages/
│   │   │   │   ├── PackageListPage.tsx
│   │   │   │   ├── PackageDetailPage.tsx
│   │   │   │   └── PackageFormPage.tsx
│   │   │   ├── payments/
│   │   │   │   ├── PaymentListPage.tsx
│   │   │   │   └── PaymentFormPage.tsx
│   │   │   ├── deliveries/
│   │   │   │   └── DeliveryListPage.tsx
│   │   │   ├── reports/
│   │   │   │   └── ReportsPage.tsx
│   │   │   ├── users/
│   │   │   │   ├── UserListPage.tsx
│   │   │   │   └── UserFormPage.tsx
│   │   │   ├── branches/
│   │   │   │   └── BranchListPage.tsx
│   │   │   └── settings/
│   │   │       └── SettingsPage.tsx
│   │   │
│   │   └── client/
│   │       ├── ClientDashboardPage.tsx
│   │       ├── MyPackagesPage.tsx
│   │       ├── PackageDetailPage.tsx
│   │       ├── ProfilePage.tsx
│   │       └── NotificationsPage.tsx
│   │
│   ├── router/
│   │   ├── index.tsx                # Route definitions
│   │   ├── AdminRoutes.tsx
│   │   ├── ClientRoutes.tsx
│   │   ├── AuthRoutes.tsx
│   │   └── ProtectedRoute.tsx
│   │
│   ├── types/
│   │   ├── api.ts                   # API response types
│   │   ├── auth.ts
│   │   ├── customer.ts
│   │   ├── package.ts
│   │   ├── payment.ts
│   │   └── delivery.ts
│   │
│   └── utils/
│       ├── formatCurrency.ts
│       ├── formatDate.ts
│       ├── getStatusColor.ts
│       ├── cn.ts                    # clsx + tailwind-merge
│       └── validators.ts            # Zod schemas from shared
│
├── public/
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
└── package.json
```

### 3.3 Shared Packages — `packages/`

```
packages/
├── validation/
│   ├── src/
│   │   ├── auth.schema.js
│   │   ├── customer.schema.js
│   │   ├── package.schema.js
│   │   ├── payment.schema.js
│   │   ├── user.schema.js
│   │   └── delivery.schema.js
│   ├── package.json
│   └── jsconfig.json
│
├── constants/
│   ├── src/
│   │   ├── packageStatus.js         # Enum-like: RECIBIDO_MIAMI, etc.
│   │   ├── roles.js                 # ADMIN, CAJA, RECEPCION, etc.
│   │   ├── paymentMethods.js
│   │   ├── eventTypes.js
│   │   └── errors.js                # Error codes
│   └── package.json
│
└── helpers/
    ├── src/
    │   ├── trackingNumber.js
    │   ├── customerCode.js
    │   ├── pagination.js
    │   └── sanitize.js
    └── package.json
```

---

## 4. Multi-Tenant Connection Manager

### 4.1 Singleton Pattern

```js
// services/tenant/connectionManager.js

class ConnectionManager {
  constructor() {
    this.connections = new Map();     // tenantId → mongoose connection
    this.pools = new Map();           // tenantId → { connection, lastUsed }
    this.MAX_POOLS = 100;             // LRU eviction limit
  }

  async getConnection(tenant) {
    // 1. Check cache
    if (this.connections.has(tenant.dbName)) {
      return this.connections.get(tenant.dbName);
    }

    // 2. Create new connection
    const conn = await mongoose.createConnection(
      `${MONGO_URI}/${tenant.dbName}`,
      {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      }
    );

    // 3. Cache it
    this.connections.set(tenant.dbName, conn);

    // 4. LRU eviction if over limit
    if (this.connections.size > this.MAX_POOLS) {
      // Evict least recently used
    }

    return conn;
  }

  async closeAll() {
    for (const [name, conn] of this.connections) {
      await conn.close();
    }
    this.connections.clear();
  }
}

// Singleton
module.exports = new ConnectionManager();
```

### 4.2 Tenant Resolution Middleware

```js
// middlewares/tenantResolver.js

async function tenantResolver(req, res, next) {
  try {
    // 1. Extract tenant slug from subdomain
    const host = req.headers.host;  // "rapidbox.midominio.com"
    const slug = host.split('.')[0];

    // 2. Allow header override for API clients / dev
    const tenantSlug = req.headers['x-tenant-slug'] || slug;

    // 3. Query Master DB for company
    const Company = masterConnection.model('Company');
    const company = await Company.findOne({ slug: tenantSlug, isActive: true });

    if (!company) {
      throw new TenantNotFoundException(tenantSlug);
    }

    // 4. Attach tenant context to request
    req.tenant = {
      id: company._id,
      slug: company.slug,
      dbName: company.databaseName,
      name: company.name,
      config: company.settings,
    };

    // 5. Get or create tenant DB connection
    const connectionManager = require('../services/tenant/connectionManager');
    req.tenantConnection = await connectionManager.getConnection(req.tenant);

    // 6. Load tenant models on the connection
    req.tenantModels = loadTenantModels(req.tenantConnection);

    next();
  } catch (error) {
    next(error);
  }
}
```

---

## 5. Master Database Schema

### 5.1 Collection: `companies`

```js
{
  _id: ObjectId,
  name: String,                    // "RapidBox Courier"
  slug: String,                    // "rapidbox" — unique, used in subdomain
  email: String,
  phone: String,
  address: String,
  logo: String,                    // Cloudinary URL
  databaseName: String,            // "courier_rapidbox"
  isActive: Boolean,
  isSuspended: Boolean,
  settings: {
    defaultCurrency: String,       // "DOP"
    locale: String,                // "es-DO"
    timezone: String,              // "America/Santo_Domingo"
  },
  planId: { type: ObjectId, ref: 'Plan' },
  licenseId: { type: ObjectId, ref: 'License' },
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { slug: 1 } unique, { databaseName: 1 } unique
```

### 5.2 Collection: `plans`

```js
{
  _id: ObjectId,
  name: String,                    // "Basic", "Professional", "Enterprise"
  code: String,                    // "basic", "pro", "enterprise"
  description: String,
  price: Number,                   // Monthly price
  features: {
    maxUsers: Number,
    maxBranches: Number,
    maxPackagesPerMonth: Number,
    storageGB: Number,
    apiAccess: Boolean,
    reports: Boolean,
    multipleBranches: Boolean,
    clientPanel: Boolean,
    whatsappNotifications: Boolean,
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { code: 1 } unique
```

### 5.3 Collection: `licenses`

```js
{
  _id: ObjectId,
  companyId: { type: ObjectId, ref: 'Company' },
  planId: { type: ObjectId, ref: 'Plan' },
  startDate: Date,
  endDate: Date,
  status: String,                  // "active", "expired", "cancelled", "trial"
  autoRenew: Boolean,
  paymentMethod: String,
  lastPaymentDate: Date,
  nextBillingDate: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { companyId: 1, status: 1 }
```

### 5.4 Collection: `superadmins`

```js
{
  _id: ObjectId,
  name: String,
  email: String,                   // Unique
  password: String,                // bcrypt hash
  role: String,                    // "superadmin"
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { email: 1 } unique
```

---

## 6. Tenant Database Schema (per company)

### 6.1 Collection: `users`

```js
{
  _id: ObjectId,
  name: String,
  email: String,                   // Unique within tenant
  password: String,                // bcrypt hash
  phone: String,
  roleId: { type: ObjectId, ref: 'Role' },
  branchId: { type: ObjectId, ref: 'Branch' },
  isActive: Boolean,
  isClient: Boolean,               // true = client panel user
  clientId: { type: ObjectId, ref: 'Customer' },  // link to customer if client
  lastLogin: Date,
  refreshToken: String,           // Hashed refresh token
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { email: 1 } unique, { roleId: 1 }, { branchId: 1 }
```

### 6.2 Collection: `roles`

```js
{
  _id: ObjectId,
  name: String,                    // "Administrador", "Caja", "Recepción", "Almacén", "Repartidor"
  code: String,                    // "admin", "cashier", "reception", "warehouse", "delivery"
  description: String,
  permissions: [String],           // ["packages.create", "packages.read", "payments.create", ...]
  isSystem: Boolean,               // System roles cannot be deleted
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { code: 1 } unique
```

Permission format: `{resource}.{action}`
Resources: packages, customers, payments, deliveries, users, roles, branches, reports, settings, dashboard
Actions: create, read, update, delete, manage

### 6.3 Collection: `customers`

```js
{
  _id: ObjectId,
  code: String,                    // "CUS-0001" — auto-generated
  name: String,
  lastName: String,
  document: String,                // Cédula / Pasaporte
  phone: String,
  email: String,
  address: String,
  miamiAddress: String,            // Dirección en Miami asignada
  branchId: { type: ObjectId, ref: 'Branch' },
  isActive: Boolean,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { code: 1 } unique, { document: 1 }, { email: 1 }, { branchId: 1 }
// Text index: { name: "text", lastName: "text", document: "text" }
```

### 6.4 Collection: `packages`

```js
{
  _id: ObjectId,
  tracking: String,                // "RPD-20260724-0001" — unique
  customerId: { type: ObjectId, ref: 'Customer' },
  description: String,
  weight: Number,                  // lbs
  length: Number,                  // cm
  width: Number,
  height: Number,
  declaredValue: Number,           // USD
  cost: Number,                    // Calculated
  shippingCost: Number,
  tax: Number,
  total: Number,
  status: String,                  // Package status enum
  branchId: { type: ObjectId, ref: 'Branch' },
  photos: [String],                // Cloudinary URLs
  notes: String,
  isPaid: Boolean,
  paymentId: { type: ObjectId, ref: 'Payment' },
  receivedAt: Date,
  deliveredAt: Date,
  deliveredById: { type: ObjectId, ref: 'User' },
  createdById: { type: ObjectId, ref: 'User' },
  createdAt: Date,
  updatedAt: Date
}
// Indexes:
// { tracking: 1 } unique
// { customerId: 1, status: 1 }
// { status: 1, branchId: 1 }
// { createdAt: -1 }
// Text index: { tracking: "text", description: "text" }
```

### 6.5 Collection: `packagehistories`

```js
{
  _id: ObjectId,
  packageId: { type: ObjectId, ref: 'Package' },
  fromStatus: String,
  toStatus: String,
  changedBy: { type: ObjectId, ref: 'User' },
  branchId: { type: ObjectId, ref: 'Branch' },
  notes: String,
  createdAt: Date
}
// Indexes: { packageId: 1, createdAt: -1 }
```

### 6.6 Collection: `branches`

```js
{
  _id: ObjectId,
  name: String,                    // "Sucursal Principal", "Sucursal Este"
  code: String,                    // "SP", "SE"
  address: String,
  phone: String,
  email: String,
  isActive: Boolean,
  isMainBranch: Boolean,
  managerId: { type: ObjectId, ref: 'User' },
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { code: 1 } unique
```

### 6.7 Collection: `payments`

```js
{
  _id: ObjectId,
  packageId: { type: ObjectId, ref: 'Package' },
  customerId: { type: ObjectId, ref: 'Customer' },
  amount: Number,
  method: String,                  // "cash", "card", "transfer"
  status: String,                  // "pending", "paid", "refunded"
  receiptNumber: String,           // "RCP-0001"
  processedById: { type: ObjectId, ref: 'User' },
  branchId: { type: ObjectId, ref: 'Branch' },
  notes: String,
  paidAt: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { receiptNumber: 1 } unique, { packageId: 1 }, { customerId: 1 }, { status: 1 }
```

### 6.8 Collection: `deliveries`

```js
{
  _id: ObjectId,
  packageId: { type: ObjectId, ref: 'Package' },
  type: String,                    // "branch", "home"
  receiverName: String,
  receiverDocument: String,
  receiverPhone: String,
  address: String,                 // For home delivery
  deliveredById: { type: ObjectId, ref: 'User' },
  branchId: { type: ObjectId, ref: 'Branch' },
  notes: String,
  photos: [String],
  deliveredAt: Date,
  createdAt: Date
}
// Indexes: { packageId: 1 }, { deliveredById: 1 }
```

### 6.9 Collection: `rates`

```js
{
  _id: ObjectId,
  name: String,                    // "Tarifa General", "Tarifa Corporativa"
  pricePerLb: Number,              // Precio por libra en DOP
  minimumPrice: Number,            // Precio mínimo
  tax: Number,                     // Porcentaje de impuesto (ITBIS 18%)
  weightLimit: Number,             // Límite de peso
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { isActive: 1 }
```

### 6.10 Collection: `notifications`

```js
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User' },
  customerId: { type: ObjectId, ref: 'Customer' },
  type: String,                    // "package_status", "payment", "system"
  title: String,
  message: String,
  data: Object,                    // Flexible payload
  isRead: Boolean,
  channel: String,                 // "in_app", "email", "whatsapp", "push"
  sentAt: Date,
  readAt: Date,
  createdAt: Date
}
// Indexes: { userId: 1, isRead: 1, createdAt: -1 }
// Indexes: { customerId: 1, isRead: 1 }
```

### 6.11 Collection: `activitylogs`

```js
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User' },
  action: String,                  // "package.created", "payment.received", "user.login"
  resource: String,                // "Package", "Payment", "User"
  resourceId: ObjectId,
  details: Object,                 // Flexible: { from: "recibido", to: "transito", ... }
  ipAddress: String,
  userAgent: String,
  branchId: { type: ObjectId, ref: 'Branch' },
  createdAt: Date
}
// Indexes: { userId: 1, createdAt: -1 }
// Indexes: { resource: 1, resourceId: 1 }
// Indexes: { createdAt: -1 }
```

### 6.12 Collection: `settings`

```js
{
  _id: ObjectId,
  key: String,                     // "price_per_lb", "company_name", "logo", etc.
  value: Mixed,                    // Flexible value type
  description: String,
  updatedById: { type: ObjectId, ref: 'User' },
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { key: 1 } unique
```

### 6.13 Collection: `receipts`

```js
{
  _id: ObjectId,
  receiptNumber: String,           // "RCP-20260724-0001"
  paymentId: { type: ObjectId, ref: 'Payment' },
  customerId: { type: ObjectId, ref: 'Customer' },
  packageId: { type: ObjectId, ref: 'Package' },
  items: [{
    description: String,
    amount: Number,
    tax: Number,
    total: Number,
  }],
  subtotal: Number,
  tax: Number,
  total: Number,
  method: String,
  generatedById: { type: ObjectId, ref: 'User' },
  pdfUrl: String,                  // Cloudinary PDF
  createdAt: Date
}
// Indexes: { receiptNumber: 1 } unique
```

### 6.14 Package Status Enum

```js
const PACKAGE_STATUS = {
  RECIBIDO_MIAMI: 'recibido_miami',
  ALMACEN_MIAMI: 'almacen_miami',
  EN_TRANSITO: 'en_transito',
  LLEGO_RD: 'llego_rd',
  ALMACEN_RD: 'almacen_rd',
  DISPONIBLE: 'disponible',
  EN_REPARTO: 'en_reparto',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
  EXTRAVIADO: 'extraviado',
};
```

---

## 7. Authentication & Authorization Flow

### 7.1 JWT Strategy

Two tokens:

| Token | Location | TTL | Purpose |
|-------|----------|-----|---------|
| Access Token | `Authorization: Bearer <token>` | 15 min | Authenticate API requests |
| Refresh Token | HTTP-only cookie | 7 days | Issue new access tokens |

**Access Token payload:**
```js
{
  sub: userId,
  tenant: "courier_rapidbox",
  role: "admin",
  branchId: "...",
  iat: timestamp,
  exp: timestamp
}
```

**Flow:**
1. Login: POST `/api/v1/auth/login` → email + password → validate → return access token + set refresh cookie
2. Every request: auth middleware verifies access token → if valid, proceed
3. Token expired: client calls POST `/api/v1/auth/refresh` → cookie sent → verify refresh token → issue new access token
4. Token refresh also rotates refresh token (rotation prevents replay attacks)
5. Logout: clear refresh token from DB + cookie

### 7.2 SuperAdmin Authentication

Separate login endpoint: POST `/api/v1/superadmin/login`
- Authenticates against Master DB
- Can access `/api/v1/superadmin/*` routes only
- Cannot access tenant data directly

### 7.3 Client Authentication

Client users authenticate via separate login: POST `/api/v1/auth/client/login`
- Links to Customer record via `clientId`
- Limited to client panel routes and their own packages

### 7.4 Role-Based Access Control (RBAC)

```js
// middlewares/rbac.js

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedException());
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenException());
    }
    next();
  };
}

// Granular permission check
function can(permission) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return next(new ForbiddenException());
    }
    next();
  };
}

// Usage:
// router.get('/packages', authorize('admin', 'reception', 'warehouse'), can('packages.read'), handler);
```

---

## 8. API Response Standard

### 8.1 Success Response

```js
// dto/response.dto.js
{
  success: true,
  data: { ... },           // Payload
  message: "Operation completed",
  meta: {                   // Only for paginated responses
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8,
  }
}
```

### 8.2 Error Response

```js
// dto/error.dto.js
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: [
      { field: "email", message: "Invalid email format" }
    ]
  }
}
```

### 8.3 API Route Structure

```
Base URL: /api/v1

# Authentication
POST   /auth/login                          # Tenant user login
POST   /auth/client/login                   # Client login
POST   /auth/refresh                        # Refresh token
POST   /auth/logout                         # Logout
GET    /auth/me                             # Current user profile

# SuperAdmin
POST   /superadmin/login                    # SuperAdmin login
GET    /superadmin/companies                # List all tenants
POST   /superadmin/companies                # Create tenant
GET    /superadmin/companies/:id            # Tenant detail
PATCH  /superadmin/companies/:id            # Update tenant
DELETE /superadmin/companies/:id            # Deactivate tenant
GET    /superadmin/plans                    # List plans
POST   /superadmin/plans                    # Create plan
...

# Customers
GET    /customers                           # List (paginated, searchable)
POST   /customers                           # Create
GET    /customers/:id                       # Detail
PATCH  /customers/:id                       # Update
DELETE /customers/:id                       # Soft delete
GET    /customers/:id/packages              # Customer's packages
GET    /customers/:id/payments              # Customer's payments

# Packages
GET    /packages                            # List (filterable by status, date, branch)
POST   /packages                            # Create (with photos)
GET    /packages/:tracking                  # Detail by tracking
GET    /packages/:id                        # Detail by ID
PATCH  /packages/:id                        # Update
PATCH  /packages/:id/status                 # Change status (triggers events)
DELETE /packages/:id                        # Soft delete
GET    /packages/:id/history                # Status history
POST   /packages/:id/photos                 # Upload photos

# Payments
GET    /payments                            # List
POST   /payments                            # Register payment
GET    /payments/:id                        # Detail
PATCH  /payments/:id                        # Update
GET    /payments/:id/receipt                # Get receipt
POST   /payments/:id/receipt                # Generate receipt

# Deliveries
GET    /deliveries                          # List
POST   /deliveries                          # Register delivery
GET    /deliveries/:id                      # Detail
PATCH  /deliveries/:id                      # Update

# Branches
GET    /branches                            # List
POST   /branches                            # Create
PATCH  /branches/:id                        # Update
DELETE /branches/:id                        # Deactivate

# Users
GET    /users                               # List (tenant users)
POST   /users                               # Create
PATCH  /users/:id                           # Update
DELETE /users/:id                           # Deactivate

# Roles
GET    /roles                               # List
POST   /roles                               # Create
PATCH  /roles/:id                           # Update permissions
DELETE /roles/:id                           # Delete

# Notifications
GET    /notifications                       # List (user's notifications)
PATCH  /notifications/:id/read              # Mark as read
PATCH  /notifications/read-all              # Mark all as read

# Reports
GET    /reports/customers                   # Customer report
GET    /reports/packages                    # Packages report
GET    /reports/income                      # Income report
GET    /reports/payments                    # Payments report
GET    /reports/deliveries                  # Deliveries report

# Dashboard
GET    /dashboard/summary                   # Dashboard metrics
GET    /dashboard/charts                    # Chart data
GET    /dashboard/recent                    # Recent movements

# Settings
GET    /settings                            # Get all settings
PATCH  /settings                            # Update setting(s)
POST   /settings/logo                       # Upload company logo

# Client Panel
GET    /client/packages                     # My packages
GET    /client/packages/:tracking           # Package detail
GET    /client/profile                      # My profile
PATCH  /client/profile                      # Update profile
GET    /client/notifications                # My notifications
```

---

## 9. Error Handling Strategy

### 9.1 Custom Exception Classes

```js
// exceptions/HttpException.js
class HttpException extends Error {
  constructor(statusCode, message, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class NotFoundException extends HttpException {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

class ValidationException extends HttpException {
  constructor(details) {
    super(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedException extends HttpException {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

class ForbiddenException extends HttpException {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'FORBIDDEN');
  }
}
```

### 9.2 Global Error Handler

```js
// middlewares/errorHandler.js
function errorHandler(err, req, res, next) {
  const logger = require('../logs/logger');

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenant: req.tenant?.slug,
    user: req.user?._id,
  });

  // Known HTTP exception
  if (err instanceof HttpException) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
        details: Object.values(err.errors).map(e => ({
          field: e.path,
          message: e.message,
        })),
      },
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: 'Resource already exists',
        details: err.keyValue,
      },
    });
  }

  // Unknown error
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

---

## 10. Event-Driven Architecture

Los eventos desacoplan los efectos secundarios de las acciones principales.

```js
// events/index.js
const EventEmitter = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// Event types
const EVENTS = {
  PACKAGE_STATUS_CHANGED: 'package:status_changed',
  PAYMENT_RECEIVED: 'payment:received',
  DELIVERY_COMPLETED: 'delivery:completed',
  CUSTOMER_CREATED: 'customer:created',
  CUSTOMER_UPDATED: 'customer:updated',
  USER_LOGIN: 'user:login',
  PACKAGE_CREATED: 'package:created',
};

module.exports = { eventBus, EVENTS };
```

**Flujo típico — cambio de estado de paquete:**
1. Controller recibe `PATCH /packages/:id/status`
2. Service cambia el status, guarda en DB
3. Service emite evento `EVENTS.PACKAGE_STATUS_CHANGED`
4. Listeners reaccionan:
   - `activityLog.listener.js` → registra en ActivityLog
   - `notification.listener.js` → crea notificación in-app + dispara email/WhatsApp
   - `socket.listener.js` → emite evento Socket.io al panel admin + cliente

---

## 11. File Upload Strategy

1. Multer recibe archivo en memoria (buffer)
2. Upload middleware valida: tipo, tamaño máx 5MB
3. Cloudinary service sube el buffer
4. Cloudinary devuelve URL segura
5. URL se guarda en el documento (Package.photos[], Setting.logo, etc.)

```
POST /packages/:id/photos → Multer → Cloudinary → URL → MongoDB
```

---

## 12. Frontend Architecture

### 12.1 Design System

- **No Bootstrap.** Solo TailwindCSS v3.
- **Tema claro/oscuro** con `next-themes` o `use-dark-mode` vía clase en `<html>` y `localStorage`.
- **Sidebar colapsable** con animación suave.
- **Breadcrumbs** generados automáticamente según ruta.
- **Componentes reutilizables** con variantes (Button, Input, Select, Modal, Table, Badge, Card).
- **Inspiración visual:** Stripe Dashboard, Linear, Notion, Vercel.

### 12.2 State Management

| State | Tool | Reason |
|-------|------|--------|
| Server data (packages, customers) | Redux Toolkit | Cache, deduplication, optimistic updates |
| Auth state | Redux Toolkit slice + localStorage | Token management, user info |
| UI state (sidebar, theme, modals) | Redux Toolkit `uiSlice` | Global toggles |
| Form state | React Hook Form | Performance (no re-renders on keystroke) |
| Validation | Zod schemas (shared) | Single source of truth |

### 12.3 Axios Interceptors

```ts
// config/axios.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,           // Refresh token cookie
});

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → refresh → retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await api.post('/auth/refresh');
        store.dispatch(setAccessToken(data.data.accessToken));
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        store.dispatch(logout());
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 13. Logging Strategy

```js
// logs/logger.js
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'courier-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});
```

---

## 14. Docker Setup

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```yaml
# docker/docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    container_name: courier-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"

  api:
    build:
      context: ../apps/api
      dockerfile: Dockerfile
    container_name: courier-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://admin:${MONGO_ROOT_PASSWORD}@mongodb:27017
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}
      CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY}
      CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET}
    depends_on:
      - mongodb
    ports:
      - "3000:3000"

  web:
    build:
      context: ../apps/web
      dockerfile: Dockerfile
    container_name: courier-web
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "80:80"

volumes:
  mongo-data:
```

---

## 15. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Connection pool exhaustion** with many tenants | New requests hang/timeout | LRU eviction at 100 connections, pool size per connection (10), connection health checks |
| **Subdomain collision** | Wrong tenant data exposed | Validate slug ownership via Master DB, unique index on slug |
| **DNS misconfiguration** | Tenant resolution fails | Header override `x-tenant-slug` for API clients, fallback to default tenant |
| **Master DB down** | All tenants affected | Replica set, read preference secondary for tenant resolution cache |
| **Slow tenant DB** affects others | Cross-tenant latency | Each tenant has its own connection pool, isolated resources |
| **Refresh token theft** | Session hijack | Rotation on every refresh, old token blacklist, HTTP-only cookie |
| **Large file uploads** | Memory exhaustion | Multer limits (5MB), stream to Cloudinary instead of buffer |
| **MongoDB query without tenant filter** | Cross-tenant data leak | Repository pattern enforces tenant scoping at the model level |

---

## 16. Implementation Order

### Phase 1: Foundation (Days 1-3)
1. Project scaffolding: folder structure, package.json files, configs
2. Master DB connection + Connection Manager
3. Tenant Resolver middleware
4. Error handling: HttpException classes, global error handler
5. Response wrapper + async handler
6. Winston logger + Morgan HTTP logging
7. Docker setup + docker-compose

### Phase 2: Auth & Multi-Tenant (Days 4-6)
1. Company CRUD (SuperAdmin)
2. SuperAdmin auth (login, JWT)
3. Tenant user auth (login, refresh, logout)
4. Client auth (separate login endpoint)
5. RBAC middleware + Role CRUD
6. User CRUD

### Phase 3: Core Domain (Days 7-12)
1. Branch CRUD
2. Customer CRUD
3. Package CRUD + status management
4. Package history / Activity Log
5. Rate management
6. Settings module
7. File upload (Multer → Cloudinary)
8. Event system + listeners

### Phase 4: Financial (Days 13-15)
1. Payment CRUD
2. Receipt generation
3. Cash register dashboard
4. Dashboard metrics API

### Phase 5: Delivery & Notifications (Days 16-18)
1. Delivery CRUD
2. Socket.io setup
3. In-app notifications
4. Email service (Nodemailer)
5. Activity Log dashboard

### Phase 6: Reports & Client Panel (Days 19-22)
1. Reports module
2. Client panel API endpoints
3. Client panel frontend
4. Admin dashboard frontend

### Phase 7: Frontend Complete (Days 23-30)
1. Design system components
2. Admin pages (all modules)
3. Client pages
4. Charts and metrics
5. Dark/light theme
6. Responsive design

---

## 17. Key Decisions & Tradeoffs

| Decision | Why | Tradeoff |
|----------|-----|----------|
| **DB per tenant** vs shared DB with tenant_id | Isolation, backup independence, scalability | More connections, more complex connection management |
| **Subdomain resolution** vs header-based | Clean URLs, transparent to users | DNS config required, dev env needs host file |
| **Repository Pattern** vs direct Mongoose calls | Testability, centralized query logic, easy DB switch | More boilerplate |
| **Events** vs direct function calls | Decoupling side effects from core logic | Debugging async chains is harder |
| **Zod** over Joi/Yup | Type inference (frontend), single source of truth | Less mature ecosystem than Joi |
| **Redux Toolkit** over Context API | Performance (selectors avoid re-renders), devtools | More boilerplate than Context for simple state |
| **Refresh token rotation** | Security: stolen refresh token becomes useless | More complex logout logic |
| **JavaScript backend** vs TypeScript | Faster iteration, lower barrier for JS team | No compile-time type safety |
| **TypeScript frontend** | Catches UI bugs at compile time, better DX | Build step required |
| **Socket.io** over WebSocket directly | Auto-reconnect, fallback to polling, rooms | ~20KB extra bundle size |

---

## 18. Next Steps

This proposal is the foundation. Once approved, the next phases are:

1. **Specs** — Detailed requirements and acceptance criteria per module
2. **Design** — Technical design with sequence diagrams, data flow, component trees
3. **Tasks** — Granular implementation tasks
4. **Apply** — Module-by-module implementation (starting with Phase 1: Foundation)