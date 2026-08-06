# Client Mobile App Specification

## Purpose

A new `apps/mobile` Expo (React Native) workspace in the monorepo giving clients mobile access: self-service registration, code+password login, dashboard, package tracking with pay-at-pickup amount, and push notifications. It consumes the client panel API (spec 13) and the auth/identity contracts of this change.

## Requirements

### Requirement: Expo Workspace

The system MUST add `apps/mobile` as an Expo SDK managed-workflow workspace under the existing `workspaces: ["apps/*", "packages/*"]` monorepo, runnable via npm workspace scripts on Node >= 20.

#### Scenario: Workspace boots
- GIVEN the monorepo is installed
- WHEN the mobile workspace starts
- THEN the Expo dev server MUST boot the app

### Requirement: Registration Flow

The app MUST implement the self-service registration flow: company selector (from `GET /api/v1/public/companies`), active branch selector (from `GET /api/v1/public/companies/:id/branches`), registration form, OTP entry screen, and auto-login on success. It MUST NOT proceed to account creation before OTP verification.

#### Scenario: Full registration path
- GIVEN a new client
- WHEN they select company, branch, fill the form, and verify the OTP
- THEN the app MUST call the register endpoint
- AND MUST store the returned tokens and proceed logged in

### Requirement: Code and Password Login

The app MUST provide a login screen accepting ONLY the global client code and password (`POST /api/v1/auth/client/login`), with no email or company selector. After login the app MUST recover tenant context from the code.

#### Scenario: Login with code only
- GIVEN a client with code `CS-000001` and password
- WHEN they submit only code and password
- THEN the app MUST authenticate and open the dashboard

### Requirement: Token Storage and Axios Interceptor

The app MUST keep the access token in memory and the refresh token in secure storage (expo-secure-store). An axios instance MUST inject `Authorization: Bearer` and the tenant slug header on every request, and on 401 MUST call `POST /api/v1/auth/client/refresh` with the refresh token in the body, retry the original request, and log out on refresh failure.

#### Scenario: Refresh without cookies
- GIVEN an expired access token and a stored refresh token
- WHEN an API call returns 401
- THEN the app MUST refresh via the body-based endpoint and retry
- AND MUST NOT depend on HTTP-only cookies

#### Scenario: Refresh failure logs out
- GIVEN a revoked refresh token
- WHEN a 401 refresh attempt fails
- THEN the app MUST clear local state and return to login

### Requirement: Local Tenant Memory

After registration or first login, the app MUST persist `companyId`, `companySlug`, `companyPrefix`, and `clientId` locally (AsyncStorage) and use them for the tenant header and code display. The app MUST restore tenant context on restart WITHOUT a new login, and MUST clear it on logout.

#### Scenario: Tenant survives restart
- GIVEN a logged-in client
- WHEN the app restarts
- THEN the tenant context MUST be restored from local storage
- AND the app MUST NOT require re-login while tokens are valid

#### Scenario: Logout clears tenant
- GIVEN a logged-in client
- WHEN they log out
- THEN local tenant data and tokens MUST be cleared

### Requirement: Dashboard and Tracking Screens

The app MUST render a dashboard with the four stats from `GET /api/v1/client/dashboard` (`totalPackages`, `inTransit`, `readyForPickup`, `delivered`), a package list from `GET /api/v1/client/packages` with status filter, and a package detail screen showing the tracking timeline (`PackageHistory`) and pickup branch. When the package status is `disponible`, the detail screen MUST show an amount-to-pay card with `package.total` (cost + tax, already stored) and the pickup branch info; the card MUST be hidden for other statuses.

#### Scenario: Dashboard shows four stats
- GIVEN a client with packages
- WHEN the dashboard loads
- THEN all four stats MUST be displayed

#### Scenario: Amount-to-pay shown when disponible
- GIVEN a package in `disponible` status
- WHEN its detail screen opens
- THEN the amount-to-pay card MUST show the total and pickup branch

#### Scenario: Amount-to-pay hidden otherwise
- GIVEN a package in `en_reparto` status
- WHEN its detail screen opens
- THEN no amount-to-pay card MUST be shown

### Requirement: Push Notifications in App

After login, the app MUST request an Expo push token and register it via `POST /api/v1/client/device-token`, and MUST render the client's notifications from `GET /api/v1/client/notifications`.

#### Scenario: Token registered after login
- GIVEN a client logs in
- WHEN the app obtains an Expo push token
- THEN it MUST register the token with the API

### Requirement: App Localization

The app MUST ship locale files under `apps/mobile/src/i18n` (`es` default, `en`, `fr`) reusing the `status.*` / `common.*` key conventions from `apps/web`; all UI copy and status labels MUST resolve through translation keys, not hardcoded strings.

#### Scenario: Status labels via keys
- GIVEN a package with status `recibido_miami`
- WHEN the label renders
- THEN it MUST resolve through a translation key
