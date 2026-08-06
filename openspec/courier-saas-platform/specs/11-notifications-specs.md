# SDD Specs: Notifications

**Change:** `courier-saas-platform`
**Phase:** Specs
**Module:** Notifications & Push
**Dependencies:** Auth (client tokens), Packages (status changes), Notification Handler

---

## 1. Push Notifications

Delivers mobile push notifications to clients: per-user device-token registration, dispatch on the existing `push` notification channel alongside `in_app`, driven by the existing notificationHandler event flow, and sent through the Expo Push Service. Clients can read their own notifications through the client panel.

### 1.1 Push Provider Selection

(Decision: Expo Push Service.) The system MUST dispatch push notifications through the Expo Push Service (`expo-server-sdk`). Device tokens MUST be Expo push tokens in the format `ExponentPushToken[...]`.

- **Scenarios:**
  - Non-Expo token rejected → device token not matching the Expo format submitted for registration → MUST be rejected with 422

### 1.2 Device Token Registration

- **Endpoint:** `POST /api/v1/client/device-token` (authenticated client)
- **Input:** `token` (Expo push token), `platform` (`android` | `ios`)
- **Rules:**
  - Tokens stored per client user, deduplicated (idempotent re-submission)
  - Capped at 5 distinct devices per user; additional distinct tokens rejected with 400
- **Scenarios:**
  - Token registered → valid Expo push token submitted → MUST be stored for that client user
  - Duplicate token is idempotent → same token submitted again → MUST be accepted without creating a duplicate record
  - Device cap enforced → client already registered 5 devices, 6th distinct token submitted → MUST be rejected with 400

### 1.3 Push Dispatch on Package Status Change

When a package status change occurs, the existing notificationHandler MUST, in addition to the `in_app` notification, dispatch a push notification through the Expo Push Service to all registered device tokens of the package's customer. The push payload MUST be `{ to: <token>, title, body, data: { type: "package_status", packageId, trackingNumber, status, companySlug }, sound: "default" }` and MUST stay under the Expo 4 KB data limit. Title/body MUST follow the existing 3-language (es/en/fr) template convention.

- **Scenarios:**
  - Status change sends push and in-app → customer with registered device tokens and a package that changes status → `in_app` notification MUST be written AND a push MUST be sent to every registered token with the package data payload
  - No tokens skips push only → customer with no registered device tokens → `in_app` notification MUST still be written and no push call MUST be attempted

### 1.4 Push Failure Isolation

Push delivery failures MUST NOT fail or roll back the status-change flow. Failures MUST be logged and MUST NOT prevent the `in_app` notification or the package update.

- **Scenarios:**
  - Push service error tolerated → Expo Push Service returns an error → package update and `in_app` notification MUST still succeed and the push error MUST be logged

### 1.5 Client Notification List

- **Endpoint:** `GET /api/v1/client/notifications` (authenticated client)
- Returns ONLY the authenticated client's `in_app` and push records, so the mobile app can render the notification list.
- **Scenarios:**
  - Client reads own notifications → client with notifications requests them → only their own notifications MUST be returned
