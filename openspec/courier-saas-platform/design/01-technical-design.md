# SDD Design: Courier SaaS Platform

**Change:** `courier-saas-platform`
**Phase:** Design
**Status:** Draft

---

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  Admin Web App       │  │  Client Web App              │ │
│  │  (React + Vite + TS) │  │  (React + Vite + TS)        │ │
│  └──────────┬───────────┘  └──────────────┬───────────────┘ │
└─────────────┼──────────────────────────────┼─────────────────┘
              │ HTTP/HTTPS                   │ HTTP/HTTPS
┌─────────────┼──────────────────────────────┼─────────────────┐
│             ▼                              ▼                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 Nginx / Load Balancer                   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│              ┌────────────▼────────────┐                     │
│              │    Express App          │                     │
│              │    (Node.js + JS)       │                     │
│              └────────────┬────────────┘                     │
│                           │                                   │
│         ┌─────────────────┼────────────────────┐            │
│         ▼                 ▼                    ▼            │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ Master DB│   │  Connection  │   │  Tenant DB Pool   │    │
│  │ (Mongo)  │   │  Manager     │   │  (Map<dbName,    │    │
│  │          │   │  (Singleton) │   │   conn>)          │    │
│  └──────────┘   └──────────────┘   └──────────────────┘    │
│                                           │                   │
│                              ┌────────────┼────────────┐     │
│                              ▼            ▼            ▼     │
│                    ┌────────────┐ ┌────────────┐ ┌────────┐ │
│                    │ courier_   │ │ courier_   │ │ ...    │ │
│                    │ rapidbox   │ │ fastcargo  │ │        │ │
│                    └────────────┘ └────────────┘ └────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Common Services                                       │  │
│  │  Cloudinary | Socket.io | Winston | EventBus          │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Connection Manager Implementation

### 2.1 Singleton Pattern

```javascript
// services/tenant/connectionManager.js
const mongoose = require('mongoose');

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.MAX_CONNECTIONS = 100;
    this.CONNECTION_TTL_MS = 30 * 60 * 1000; // 30 min idle
    this.cleanupInterval = null;
  }

  async getConnection(tenant) {
    if (this.connections.has(tenant.dbName)) {
      const entry = this.connections.get(tenant.dbName);
      entry.lastUsed = Date.now();
      return entry.connection;
    }

    const connection = await mongoose.createConnection(
      `${process.env.MONGO_URI}/${tenant.dbName}`,
      {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      }
    );

    // Load all tenant models
    this._loadTenantModels(connection);

    this.connections.set(tenant.dbName, {
      connection,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    });

    // Evict LRU if over limit
    if (this.connections.size > this.MAX_CONNECTIONS) {
      this._evictLRU();
    }

    return connection;
  }

  _loadTenantModels(connection) {
    // All models loaded once per connection
    require('../models/tenant/User')(connection);
    require('../models/tenant/Role')(connection);
    require('../models/tenant/Customer')(connection);
    require('../models/tenant/Package')(connection);
    require('../models/tenant/PackageHistory')(connection);
    require('../models/tenant/Branch')(connection);
    require('../models/tenant/Payment')(connection);
    require('../models/tenant/Receipt')(connection);
    require('../models/tenant/Delivery')(connection);
    require('../models/tenant/Rate')(connection);
    require('../models/tenant/Notification')(connection);
    require('../models/tenant/ActivityLog')(connection);
    require('../models/tenant/Setting')(connection);
  }

  _evictLRU() {
    let oldest = null;
    let oldestKey = null;

    for (const [key, entry] of this.connections) {
      if (!oldest || entry.lastUsed < oldest.lastUsed) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      oldest.connection.close();
      this.connections.delete(oldestKey);
    }
  }

  async closeConnection(dbName) {
    if (this.connections.has(dbName)) {
      await this.connections.get(dbName).connection.close();
      this.connections.delete(dbName);
    }
  }

  async closeAll() {
    for (const [name, entry] of this.connections) {
      await entry.connection.close();
    }
    this.connections.clear();
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.MAX_CONNECTIONS,
      connections: Array.from(this.connections.entries()).map(([key, entry]) => ({
        dbName: key,
        lastUsed: entry.lastUsed,
        uptime: Date.now() - entry.createdAt,
      })),
    };
  }
}

const instance = new ConnectionManager();
Object.freeze(instance);
module.exports = instance;
```

---

## 3. Router Structure

```javascript
// routes/v1/index.js
const router = require('express').Router();

// Auth routes
router.use('/auth', require('../../modules/auth/auth.routes'));

// Protected routes (tenant resolver + auth applied)
router.use('/customers', require('../../modules/customers/customer.routes'));
router.use('/packages', require('../../modules/packages/package.routes'));
router.use('/payments', require('../../modules/payments/payment.routes'));
router.use('/deliveries', require('../../modules/deliveries/delivery.routes'));
router.use('/branches', require('../../modules/branches/branch.routes'));
router.use('/users', require('../../modules/users/user.routes'));
router.use('/roles', require('../../modules/roles/role.routes'));
router.use('/notifications', require('../../modules/notifications/notification.routes'));
router.use('/reports', require('../../modules/reports/report.routes'));
router.use('/dashboard', require('../../modules/dashboard/dashboard.routes'));
router.use('/settings', require('../../modules/settings/setting.routes'));
router.use('/client', require('../../modules/client/client.routes'));

// SuperAdmin routes (separate connection)
router.use('/superadmin', require('../../modules/companies/company.routes'));

module.exports = router;
```

---

## 4. Express App Bootstrap

```javascript
// src/server.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const loaders = require('./loaders');
const logger = require('./logs/logger');

async function start() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
  });

  // Initialize all loaders
  await loaders.init({ app, io });

  // Global error handler (must be last)
  app.use(require('./middlewares/errorHandler'));

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully...');
    const connectionManager = require('./services/tenant/connectionManager');
    await connectionManager.closeAll();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

---

## 5. Loaders

```javascript
// loaders/index.js
const expressLoader = require('./express');
const mongooseLoader = require('./mongoose');
const socketLoader = require('./socket');
const winstonLoader = require('./winston');
const { registerListeners } = require('../events');

module.exports.init = async ({ app, io }) => {
  // 1. Winston logger
  winstonLoader();

  // 2. MongoDB Master connection
  const masterConnection = await mongooseLoader.initMaster();
  app.locals.masterConnection = masterConnection;

  // 3. Express middlewares
  expressLoader.init({ app });

  // 4. Socket.io
  socketLoader.init({ io, app });

  // 5. Routes
  app.use('/api/v1', require('../routes/v1'));

  // 6. Event listeners
  registerListeners();
};
```

---

## 6. Frontend Component Design

### 6.1 UI Components (Design System)

```
components/ui/
├── Button.tsx          # Variants: primary, secondary, ghost, danger. Sizes: sm, md, lg
├── Input.tsx           # With label, error, icon, helper text
├── Select.tsx          # With search option
├── Modal.tsx           # With confirm/cancel, sizes: sm, md, lg, fullscreen
├── Table.tsx           # Sortable, selectable, with loading skeleton
├── Badge.tsx           # Color variants by status
├── Card.tsx            # With header, body, footer slots
├── Breadcrumb.tsx      # Auto from routes
├── Sidebar.tsx         # Collapsible, with nested items, active state
├── Pagination.tsx      # Page numbers, prev/next, per page selector
├── FormField.tsx       # Wraps RHF + Zod error display
├── DataTable.tsx       # Table + search + pagination + filters combined
├── StatusBadge.tsx     # Color-coded by package status
├── StatCard.tsx        # Metric with icon, trend indicator
├── EmptyState.tsx      # Illustration + message + CTA
├── LoadingSpinner.tsx  # Full page or inline
├── Toast.tsx           # Success, error, warning, info
└── ConfirmDialog.tsx   # Destructive action confirmation
```

---

## 7. Data Flow — Package Creation

```
User submits form
       │
       ▼
PackageFormPage.tsx
  - React Hook Form + Zod validation
  - handleSubmit(onSubmit)
       │
       ▼
packageService.create(data, files)
  - Axios POST /packages (multipart if photos)
  - Redux dispatch(createPackage.pending)
       │
       ▼
API: tenantResolver → auth → validate → controller
       │
       ▼
packageController.create(req, res)
  - asyncHandler wraps
  - new PackageService(req.tenantConnection)
  - service.create(req.body, req.user._id)
       │
       ▼
PackageService.create()
  - Validate customer exists
  - Calculate cost from settings
  - Generate tracking number
  - Upload photos to Cloudinary
  - PackageRepository.createWithHistory()
  - Emit events
       │
       ▼
Response → Client
  - Redux dispatch(createPackage.fulfilled)
  - Toast: "Package created successfully"
  - Navigate to package detail / list
```

---

## 8. Validation Architecture

### 8.1 Shared Zod Schemas (packages/validation)

```javascript
// packages/validation/src/package.schema.js
const { z } = require('zod');

const createPackageSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  description: z.string().min(1).max(500),
  weight: z.number().positive().max(500),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  declaredValue: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  branchId: z.string().optional(),
});

const updatePackageSchema = createPackageSchema.partial();

const changeStatusSchema = z.object({
  status: z.enum([
    'recibido_miami', 'almacen_miami', 'en_transito', 'llego_rd',
    'almacen_rd', 'disponible', 'en_reparto', 'entregado',
    'cancelado', 'extraviado',
  ]),
  notes: z.string().max(500).optional(),
});

module.exports = { createPackageSchema, updatePackageSchema, changeStatusSchema };
```

### 8.2 Validation Middleware

```javascript
// middlewares/validate.js
const ValidationException = require('../exceptions/ValidationException');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new ValidationException(details);
    }
    req[source] = result.data; // Use parsed/coerced data
    next();
  };
};

module.exports = validate;
```

---

## 9. Socket.io Architecture

```javascript
// config/socket.js
const jwt = require('jsonwebtoken');

function setupSocket(io) {
  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.sub;
      socket.tenant = decoded.tenant;
      socket.role = decoded.role;
      socket.branchId = decoded.branchId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join user room
    socket.join(`user:${socket.userId}`);

    // Join branch room
    if (socket.branchId) {
      socket.join(`branch:${socket.branchId}`);
    }

    // Join tenant room
    socket.join(`tenant:${socket.tenant}`);

    socket.on('disconnect', () => {
      // Cleanup handled automatically
    });
  });
}

// Emit helper
function emitToUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

function emitToBranch(io, branchId, event, data) {
  io.to(`branch:${branchId}`).emit(event, data);
}

function emitToTenant(io, tenant, event, data) {
  io.to(`tenant:${tenant}`).emit(event, data);
}
```

---

## 10. Receipt PDF Generation

```javascript
// services/payment/pdf.service.js
const PDFDocument = require('pdfkit');
const cloudinary = require('../../config/cloudinary');

async function generateReceipt(payment, customer, pkg, company) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'receipts',
            public_id: `receipt-${payment.receiptNumber}`,
            format: 'pdf',
          },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(pdfBuffer);
      });

      resolve(result.secure_url);
    });

    doc.on('error', reject);

    // Content
    doc.fontSize(20).text(company.name || 'Courier Company', { align: 'center' });
    doc.fontSize(10).text(`RNC: ${company.rnc || 'N/A'}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('RECIBO DE PAGO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`No. ${payment.receiptNumber}`);
    doc.text(`Fecha: ${payment.createdAt.toLocaleDateString()}`);
    doc.moveDown();
    doc.text(`Cliente: ${customer.name} ${customer.lastName}`);
    doc.text(`Documento: ${customer.document || 'N/A'}`);
    doc.text(`Código: ${customer.code}`);
    doc.moveDown();
    doc.text(`Tracking: ${pkg.tracking}`);
    doc.text(`Descripción: ${pkg.description}`);
    doc.text(`Peso: ${pkg.weight} lbs`);
    doc.moveDown();
    doc.text(`Costo base: $${pkg.cost.toFixed(2)}`);
    doc.text(`Impuesto (${pkg.taxRate || 18}%): $${pkg.tax.toFixed(2)}`);
    doc.text(`Total: $${pkg.total.toFixed(2)}`);
    doc.moveDown();
    doc.text(`Método de pago: ${payment.method}`);
    doc.text(`Monto pagado: $${payment.amount.toFixed(2)}`);
    doc.moveDown();
    doc.text('PAGADO', { align: 'center', underline: true });

    doc.end();
  });
}
```

---

## 11. Tenant Provisioning Script

When a new company is created, the provisionTenant function runs:

```javascript
// services/company/provisionTenant.js
async function provisionTenant(company) {
  const mongoose = require('mongoose');

  // 1. Create database by connecting to it
  const conn = await mongoose.createConnection(
    `${process.env.MONGO_URI}/${company.databaseName}`,
    { maxPoolSize: 5 }
  );

  // 2. Create collections via model registration
  const models = {};
  const schemas = {
    User: require('../../models/tenant/User'),
    Role: require('../../models/tenant/Role'),
    Customer: require('../../models/tenant/Customer'),
    Package: require('../../models/tenant/Package'),
    PackageHistory: require('../../models/tenant/PackageHistory'),
    Branch: require('../../models/tenant/Branch'),
    Payment: require('../../models/tenant/Payment'),
    Receipt: require('../../models/tenant/Receipt'),
    Delivery: require('../../models/tenant/Delivery'),
    Rate: require('../../models/tenant/Rate'),
    Notification: require('../../models/tenant/Notification'),
    ActivityLog: require('../../models/tenant/ActivityLog'),
    Setting: require('../../models/tenant/Setting'),
  };

  for (const [name, schema] of Object.entries(schemas)) {
    models[name] = conn.model(name, schema);
  }

  // 3. Seed default roles
  const roles = await models.Role.insertMany([
    {
      name: 'Administrador',
      code: 'admin',
      permissions: ['*.*'],
      isSystem: true,
    },
    {
      name: 'Caja',
      code: 'cashier',
      permissions: [
        'payments.create', 'payments.read', 'payments.update',
        'customers.read',
        'packages.read',
        'dashboard.read',
      ],
      isSystem: true,
    },
    {
      name: 'Recepción',
      code: 'reception',
      permissions: [
        'packages.*',
        'customers.*',
        'branches.read',
        'dashboard.read',
      ],
      isSystem: true,
    },
    {
      name: 'Almacén',
      code: 'warehouse',
      permissions: [
        'packages.read', 'packages.update',
        'branches.read',
        'dashboard.read',
      ],
      isSystem: true,
    },
    {
      name: 'Repartidor',
      code: 'delivery',
      permissions: [
        'deliveries.*',
        'packages.read',
        'dashboard.read',
      ],
      isSystem: true,
    },
  ]);

  // 4. Seed default settings
  await models.Setting.insertMany([
    { key: 'price_per_lb', value: 0, description: 'Precio por libra en DOP' },
    { key: 'minimum_price', value: 0, description: 'Precio mínimo por paquete' },
    { key: 'tax_rate', value: 18, description: 'ITBIS %' },
    { key: 'currency', value: 'DOP', description: 'Moneda' },
    { key: 'company_name', value: company.name, description: 'Nombre de la empresa' },
    { key: 'company_address', value: '', description: 'Dirección' },
    { key: 'company_phone', value: '', description: 'Teléfono' },
    { key: 'company_email', value: company.email, description: 'Email' },
  ]);

  // 5. Seed default branch
  const branch = await models.Branch.create({
    name: 'Sucursal Principal',
    code: 'SP',
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
    isMainBranch: true,
    isActive: true,
  });

  // 6. Close provisioning connection
  await conn.close();

  return { roles, branch };
}
```

---

## 12. Environment & Config

```javascript
// config/index.js
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    masterDbName: process.env.MASTER_DB_NAME || 'master_db',
    options: {
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 10,
      serverSelectionTimeoutMS: 5000,
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  tenant: {
    maxConnections: 100,
    connectionTTL: 30 * 60 * 1000,
    defaultPoolSize: 10,
  },
};

module.exports = config;
```

---

## 13. Key Implementation Notes

### 13.1 Model Registration Pattern (per tenant connection)

```javascript
// models/tenant/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    phone: { type: String, trim: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    isActive: { type: Boolean, default: true },
    isClient: { type: Boolean, default: false },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    lastLogin: { type: Date },
    refreshToken: { type: String, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Export as a function that takes a connection and registers the model
module.exports = (connection) => {
  return connection.model('User', userSchema);
};
```

### 13.2 Why this pattern?
- Each tenant connection needs its own model registration
- `mongoose.model()` is singleton per connection
- This factory pattern ensures models are registered on the correct connection
- Prevents "Cannot overwrite model" errors

### 13.3 Tenant Resolver for Socket.io

Socket.io needs tenant resolution too. The handshake includes auth token which contains the tenant claim. No need to re-query Master DB on every socket event — the tenant is embedded in the JWT.

```javascript
// JWT payload includes tenant
{
  sub: "user_id",
  tenant: "courier_rapidbox",  // dbName
  role: "admin",
  branchId: "..."
}
```

---

## 14. State Machine: Package Status

```
                    ┌──────────────┐
                    │recibido_miami│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │almacen_miami │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ en_transito  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  llego_rd    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼───┐  ┌────▼─────┐
       │ almacen_rd  │ │      │  │          │
       └──────┬──────┘ │      │  │          │
              │         │      │  │          │
       ┌──────▼──────┐  │      │  │          │
       │ disponible  │  │      │  │          │
       └──┬───────┬──┘  │      │  │          │
          │       │     │      │  │          │
   ┌──────▼───┐ ┌─▼─────┐ ┌───▼────┐  ┌────▼─────┐
   │en_reparto│ │       │ │        │  │          │
   └──┬───────┘ │       │ │        │  │          │
      │         │       │ │        │  │          │
   ┌──▼──────┐  │       │ │        │  │          │
   │entregado│  │       │ │        │  │          │
   └─────────┘  │       │ │        │  │          │
                │       │ │        │  │          │
           ┌────▼───┐ ┌─▼──────┐ ┌─▼────────┐
           │cancel. │ │extrav. │ │          │
           └────────┘ └────────┘ └──────────┘
```

---

## 15. Security Implementation Notes

### 15.1 Helmet Configuration
```javascript
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for API
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

### 15.2 CORS Configuration
```javascript
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
}));
```

### 15.3 Rate Limiter
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});
app.use('/api/', limiter);
```

### 15.4 Auth Routes — stricter rate limit
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many login attempts' } },
});
app.use('/api/v1/auth/login', authLimiter);
```

---

## 16. Testing Strategy

### Unit Tests
- Services: mock repositories, test business logic
- Validators: test each schema with valid/invalid data
- Utils: test helpers in isolation

### Integration Tests
- API endpoints: supertest + in-memory MongoDB (mongodb-memory-server)
- Auth flow: login → access protected route → refresh → access again
- Package flow: create → change status → verify history

### Test Structure
```
tests/
├── unit/
│   ├── services/
│   │   └── package.service.test.js
│   ├── validators/
│   │   └── package.schema.test.js
│   └── utils/
│       └── apiResponse.test.js
├── integration/
│   ├── auth.test.js
│   ├── packages.test.js
│   ├── customers.test.js
│   └── helpers/
│       └── setup.js
└── fixtures/
    ├── customers.js
    └── packages.js
```