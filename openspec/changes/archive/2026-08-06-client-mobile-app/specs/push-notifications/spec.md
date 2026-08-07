# Push Notifications Specification

## Purpose

Delivers mobile push notifications to clients: per-user device-token registration, dispatch on the existing `push` notification channel alongside `in_app`, driven by the existing notificationHandler event flow, and sent through the Expo Push Service. Clients can read their own notifications through the client panel.

## Requirements

### Requirement: Push Provider Selection

(Decision: Expo Push Service.) The system MUST dispatch push notifications through the Expo Push Service (`expo-server-sdk`). Device tokens MUST be Expo push tokens in the format `ExponentPushToken[...]`.

#### Scenario: Non-Expo token rejected
- GIVEN a device token not matching the Expo format
- WHEN it is submitted for registration
- THEN the system MUST reject it with 422

### Requirement: Device Token Registration

The system MUST expose `POST /api/v1/client/device-token` (authenticated client) accepting `token` and `platform` (`android` | `ios`). Tokens MUST be stored per client user, deduplicated, and capped at 5 distinct devices per user; additional distinct tokens MUST be rejected with 400.

#### Scenario: Token registered
- GIVEN an authenticated client
- WHEN a valid Expo push token is submitted
- THEN the token MUST be stored for that client user

#### Scenario: Duplicate token is idempotent
- GIVEN the same token was already registered
- WHEN it is submitted again
- THEN the system MUST accept it without creating a duplicate record

#### Scenario: Device cap enforced
- GIVEN a client already registered 5 devices
- WHEN a 6th distinct token is submitted
- THEN the system MUST reject it with 400

### Requirement: Push Dispatch on Package Status Change

When a package status change occurs, the existing notificationHandler MUST, in addition to the `in_app` notification, dispatch a push notification through the Expo Push Service to all registered device tokens of the package's customer. The push payload MUST be `{ to: <token>, title, body, data: { type: "package_status", packageId, trackingNumber, status, companySlug }, sound: "default" }` and MUST stay under the Expo 4 KB data limit. Title/body MUST follow the existing 3-language (es/en/fr) template convention.

#### Scenario: Status change sends push and in-app
- GIVEN a customer with registered device tokens and a package that changes status
- WHEN the status change is processed
- THEN an `in_app` notification MUST be written
- AND a push notification MUST be sent to every registered token
- AND the payload MUST carry the package data

#### Scenario: No tokens skips push only
- GIVEN a customer with no registered device tokens
- WHEN a package status change occurs
- THEN the `in_app` notification MUST still be written
- AND no push call MUST be attempted

### Requirement: Push Failure Isolation

Push delivery failures MUST NOT fail or roll back the status-change flow. Failures MUST be logged and MUST NOT prevent the `in_app` notification or the package update.

#### Scenario: Push service error tolerated
- GIVEN the Expo Push Service returns an error
- WHEN a status change triggers a push
- THEN the package update and `in_app` notification MUST still succeed
- AND the push error MUST be logged

### Requirement: Client Notification List

The system MUST expose the authenticated client's notifications through the client panel (`GET /api/v1/client/notifications`), returning only that client's `in_app` and push records, so the mobile app can render the notification list.

#### Scenario: Client reads own notifications
- GIVEN a client with notifications
- WHEN the client requests their notifications
- THEN only their own notifications MUST be returned
