# SDD Tasks: Phase 1 — Foundation

**Change:** `courier-saas-platform`
**Phase:** Tasks
**Status:** Ready
**Estimated Lines:** ~1,200
**Delivery Strategy:** single-pr (Phase 1 is foundation, under 800 lines budget)
**Dependencies:** None

---

## Task Breakdown

### T1.1: Project Scaffolding
**Files:** `apps/api/package.json`, `apps/api/src/server.js`, `apps/api/src/config/index.js`, `.env.example`, `.gitignore`
**Description:** Initialize the backend project with all dependencies, environment config, and entry point.

**Acceptance Criteria:**
- [ ] `package.json` created with all dependencies (express, mongoose, bcryptjs, jsonwebtoken, socket.io, multer, cloudinary, winston, zod, helmet, cors, express-rate-limit, cookie-parser, dotenv)
- [ ] `config/index.js` reads all env vars with sensible defaults
- [ ] `.env.example` documents all required variables
- [ ] `server.js` starts Express on config port
- [ ] `.gitignore` ignores node_modules, .env, logs/

### T1.2: Logger Setup (Winston + Morgan)
**Files:** `apps/api/src/logs/logger.js`, `apps/api/src/logs/morgan.js`
**Description:** Configure Winston logger with console + file transports and Morgan HTTP request logging.

**Acceptance Criteria:**
- [ ] Winston logger writes to console (colorized) and files (error.log + combined.log)
- [ ] Log rotation: 5MB max per file, 5 for errors, 10 for combined
- [ ] Morgan writes HTTP request logs via Winston stream
- [ ] Log level configurable via LOG_LEVEL env var
- [ ] Structured JSON format for file logs

### T1.3: Exception Classes
**Files:** `apps/api/src/exceptions/*.js`
**Files count:** 7 (HttpException, NotFoundException, UnauthorizedException, ForbiddenException, ValidationException, TenantNotFoundException, ConflictException)

**Description:** Custom HTTP exception classes extending Error with statusCode and error code.

**Acceptance Criteria:**
- [ ] HttpException base class with statusCode, code, details fields
- [ ] NotFoundException (404)
- [ ] UnauthorizedException (401)
- [ ] ForbiddenException (403)
- [ ] ValidationException (400, with details array)
- [ ] TenantNotFoundException (404)
- [ ] ConflictException (409)

### T1.4: Response Utilities
**Files:** `apps/api/src/utils/apiResponse.js`, `apps/api/src/utils/asyncHandler.js`
**Description:** Standard API response wrapper and async error handler.

**Acceptance Criteria:**
- [ ] `apiResponse.success(res, data, message, meta)` → 200 JSON
- [ ] `apiResponse.created(res, data, message)` → 201 JSON
- [ ] `apiResponse.noContent(res)` → 204
- [ ] `apiResponse.paginated(res, data, meta)` → 200 with meta
- [ ] `asyncHandler` wraps async route handlers, catches errors to next()

### T1.5: Global Error Handler Middleware
**Files:** `apps/api/src/middlewares/errorHandler.js`
**Description:** Global Express error handler that catches all errors and returns standardized response.

**Acceptance Criteria:**
- [ ] Handles HttpException subclasses → structured error response
- [ ] Handles Mongoose ValidationError → 400 with field details
- [ ] Handles MongoDB duplicate key (code 11000) → 409
- [ ] Handles unknown errors → 500 with generic message
- [ ] Logs all errors with Winston (stack trace, path, method, tenant)

### T1.6: Security Middlewares
**Files:** `apps/api/src/middlewares/rateLimiter.js`
**Description:** Configure Helmet, CORS, and rate limiting.

**Acceptance Criteria:**
- [ ] Helmet configured (CSP disabled for API)
- [ ] CORS configured from env with credentials
- [ ] Global rate limiter: 100 req/15min
- [ ] Auth rate limiter: 10 req/15min on /auth/login

### T1.7: Express Loader
**Files:** `apps/api/src/loaders/index.js`, `apps/api/src/loaders/express.js`
**Description:** Express app bootstrap with all middlewares.

**Acceptance Criteria:**
- [ ] Loads helmet, cors, rateLimiter, cookieParser, json parser
- [ ] Mounts API routes at /api/v1
- [ ] Applies global error handler last
- [ ] Graceful shutdown on SIGTERM/SIGINT

### T1.8: Master DB Connection
**Files:** `apps/api/src/config/database.js`, `apps/api/src/loaders/mongoose.js`
**Files count:** 2

**Description:** Initialize master MongoDB connection with models.

**Acceptance Criteria:**
- [ ] Connect to MongoDB using MONGO_URI env var
- [ ] Database name: `master_db`
- [ ] Connection pool: 10
- [ ] Master DB models registered: Company, Plan, License, SuperAdmin
- [ ] Connection retry logic with exponential backoff

### T1.9: Master DB Models
**Files:** `apps/api/src/models/master/*.js`
**Files count:** 4 (Company.js, Plan.js, License.js, SuperAdmin.js)

**Description:** Mongoose schemas for Master Database.

**Acceptance Criteria:**
- [ ] Company schema with slug (unique), databaseName, isActive, settings
- [ ] Plan schema with name, code (unique), price, features
- [ ] License schema with companyId, planId, startDate, endDate, status
- [ ] SuperAdmin schema with email (unique), password (hashed, select:false)
- [ ] All schemas have timestamps: true
- [ ] Company indexes: { slug: 1 } unique, { databaseName: 1 } unique
- [ ] Plan indexes: { code: 1 } unique
- [ ] License indexes: { companyId: 1, status: 1 }
- [ ] SuperAdmin indexes: { email: 1 } unique

### T1.10: Tenant DB Models
**Files:** `apps/api/src/models/tenant/*.js`
**Files count:** 14 (User, Role, Customer, Package, PackageHistory, Branch, Payment, Receipt, Delivery, Rate, Notification, ActivityLog, Setting)

**Description:** Mongoose schemas for Tenant databases — each model is exported as a factory function that takes a connection and registers the model.

**Acceptance Criteria:**
- [ ] Each model is a function: `module.exports = (connection) => connection.model('Name', schema)`
- [ ] User schema with email unique, password hash pre-save hook, comparePassword method, refreshToken (select:false), failedLoginAttempts, lockedUntil
- [ ] Role schema with name, code (unique), permissions array, isSystem
- [ ] Customer schema with code (unique), name, lastName, document, phone, email, address, miamiAddress, branchId, isActive
- [ ] Package schema with tracking (unique), customerId, description, weight, dimensions, declaredValue, cost, tax, total, status (enum), branchId, photos array, isPaid, timestamps
- [ ] PackageHistory schema with packageId, fromStatus, toStatus, changedBy, notes
- [ ] Branch schema with name, code (unique), address, phone, isMainBranch, isActive
- [ ] Payment schema with packageId, customerId, amount, method (enum: cash/card/transfer), status (pending/paid/refunded), receiptNumber
- [ ] Delivery schema with packageId, type (branch/home), receiverName, receiverDocument, receiverPhone, address, deliveredById, photos, deliveredAt
- [ ] Rate schema with name, pricePerLb, minimumPrice, tax, weightLimit, isActive
- [ ] Notification schema with userId, customerId, type, title, message, data (Mixed), isRead, channel, timestamps
- [ ] ActivityLog schema with userId, action, resource, resourceId, details (Mixed), ipAddress, userAgent, branchId
- [ ] Setting schema with key (unique), value (Mixed), description

### T1.11: Connection Manager (Singleton)
**Files:** `apps/api/src/services/tenant/connectionManager.js`
**Description:** Singleton class that manages MongoDB connections per tenant with LRU eviction.

**Acceptance Criteria:**
- [ ] Singleton instance (Object.freeze)
- [ ] getConnection(tenant): returns cached or creates new connection
- [ ] Each connection: maxPoolSize=10, minPoolSize=2
- [ ] Loads all 14 tenant models on new connection
- [ ] LRU eviction when > 100 connections
- [ ] closeConnection(dbName), closeAll()
- [ ] getStats() for health check

### T1.12: Tenant Resolver Middleware
**Files:** `apps/api/src/middlewares/tenantResolver.js`
**Description:** Extracts tenant from subdomain or x-tenant-slug header, queries Master DB, attaches connection to req.

**Acceptance Criteria:**
- [ ] Extracts slug from subdomain (host.split('.')[0])
- [ ] Allows x-tenant-slug header override
- [ ] Skips resolution for /api/v1/superadmin routes
- [ ] Queries Company in Master DB by slug + isActive
- [ ] Validates license is active/not expired
- [ ] Attaches req.tenant (id, slug, dbName, name, plan, settings)
- [ ] Gets tenant connection via ConnectionManager
- [ ] Loads all models on req.tenantModels
- [ ] Throws TenantNotFoundException if company not found

### T1.13: Event System
**Files:** `apps/api/src/events/index.js`
**Description:** Event emitter with typed events and listener registration.

**Acceptance Criteria:**
- [ ] AppEventBus extends EventEmitter with maxListeners=50
- [ ] EVENTS object with all event types: PACKAGE_CREATED, PACKAGE_STATUS_CHANGED, PAYMENT_RECEIVED, DELIVERY_COMPLETED, CUSTOMER_CREATED, USER_LOGIN
- [ ] registerListeners() function that registers all listener callbacks
- [ ] Listener stubs for activityLog, notification, socket (emit event data)

### T1.14: Route Structure
**Files:** `apps/api/src/routes/index.js`, `apps/api/src/routes/v1/index.js`
**Description:** Route aggregation with module-based routing.

**Acceptance Criteria:**
- [ ] `routes/v1/index.js` mounts all module routes
- [ ] SuperAdmin routes separate at `/api/v1/superadmin`
- [ ] Module route stubs created for all 12 modules
- [ ] Each module route file returns Express.Router()

### T1.15: Docker Setup
**Files:** `apps/api/Dockerfile`, `apps/api/Dockerfile.dev`, `docker/docker-compose.yml`, `apps/web/Dockerfile`, `apps/web/Dockerfile.dev`, `apps/web/nginx.conf`
**Files count:** 6

**Description:** Docker configuration for development and production.

**Acceptance Criteria:**
- [ ] API Dockerfile (multi-stage: deps → runner, node:20-alpine)
- [ ] API Dockerfile.dev (with volume mounts for hot reload)
- [ ] Web Dockerfile (build with vite, serve with nginx)
- [ ] docker-compose.yml: mongodb (mongo:7), api, web services
- [ ] Nginx config: SPA fallback, API proxy, Socket.io proxy
- [ ] .dockerignore files

---

## Execution Order

```
T1.1  → Project scaffolding (package.json, config, env)
  │
  ├── T1.2  → Logger
  ├── T1.3  → Exceptions
  ├── T1.4  → Response utils
  │
  ├── T1.8  → Master DB connection
  ├── T1.9  → Master DB models
  │
  ├── T1.10 → Tenant DB models
  ├── T1.11 → Connection Manager
  │
  ├── T1.5  → Error handler middleware
  ├── T1.6  → Security middlewares
  ├── T1.12 → Tenant resolver middleware
  │
  ├── T1.7  → Express loader
  ├── T1.14 → Routes
  │
  ├── T1.13 → Event system
  │
  └── T1.15 → Docker
```

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated files | 45+ |
| Estimated lines | ~1,200 |
| 400-line risk | Medium (crosses into chained territory) |
| Decision needed | Single PR (Phase 1 is all foundation, cohesive) |