# First Login Password Change Specification

## Purpose

Enforce password change on first login when the `mustChangePassword` flag is true, ensuring temporary default passwords are replaced by the user.

## Requirements

### Requirement: MustChangePassword Field on User

The User model MUST include a `mustChangePassword` boolean field defaulting to `false`.

#### Scenario: Field exists in schema
- GIVEN the User model schema definition
- WHEN inspecting the schema
- THEN `mustChangePassword` MUST be present as a Boolean field
- AND the default value MUST be `false`

### Requirement: Login Flag Detection

The login endpoint MUST check the `mustChangePassword` flag and include it in the response payload.

#### Scenario: First login with flag set redirects to change password
- GIVEN a user has `mustChangePassword: true`
- WHEN the user logs in with valid credentials
- THEN the response MUST include `mustChangePassword: true`
- AND a valid access token MUST be issued
- AND the frontend MUST redirect to the change password page

#### Scenario: Subsequent login proceeds to dashboard
- GIVEN a user has `mustChangePassword: false`
- WHEN the user logs in with valid credentials
- THEN the response MUST include `mustChangePassword: false`
- AND the user MUST reach the dashboard normally

### Requirement: Password Change API Endpoint

The system MUST provide `PATCH /api/v1/auth/password` for authenticated users to change their password and clear the `mustChangePassword` flag.

#### Scenario: Successful password change clears flag
- GIVEN the user is authenticated with a valid token
- WHEN submitting a correct current password and a valid new password
- THEN the current password MUST be verified against the stored hash
- AND the new password MUST be hashed and saved
- AND `mustChangePassword` MUST be set to `false`
- AND a success response MUST be returned

#### Scenario: Incorrect current password rejected
- GIVEN the user is authenticated
- WHEN submitting an incorrect current password
- THEN the system MUST return 401
- AND `mustChangePassword` MUST remain `true`
- AND the password MUST NOT be changed

#### Scenario: Weak new password rejected
- GIVEN the user is authenticated
- WHEN submitting a new password that fails password rules
- THEN the system MUST return a validation error
- AND `mustChangePassword` MUST remain `true`

### Requirement: Change Password Frontend Route

The frontend MUST provide a `/auth/change-password` route with a dedicated form for password change.

#### Scenario: Redirect from login on flag detection
- GIVEN the login response includes `mustChangePassword: true`
- WHEN the frontend processes the login response
- THEN it MUST navigate to `/auth/change-password`
- AND the user MUST NOT have access to the dashboard

#### Scenario: Successful form submission redirects to dashboard
- GIVEN the user is on the change password page
- WHEN submitting a matching new password and confirmation
- THEN the frontend MUST call `PATCH /api/v1/auth/password`
- AND on success, redirect to the dashboard
- AND on failure, display the error message
