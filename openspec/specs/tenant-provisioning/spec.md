# Tenant Provisioning Specification

## Purpose

Automated provisioning of tenant database, Admin role, and first admin user when a new company is created.

## Requirements

### Requirement: Tenant Database Provisioning

Upon company creation, the system MUST create a dedicated MongoDB database for the new tenant.

#### Scenario: Successful database provisioning
- GIVEN a new company creation is in progress
- WHEN the company record and trial license are created
- THEN the system MUST create a new tenant database
- AND the database MUST be identifiable by the company tenant ID

#### Scenario: Database creation failure rolls back company
- GIVEN a new company creation is in progress
- WHEN the tenant database creation fails
- THEN the company record MUST be removed (rollback)
- AND the system MUST return a provisioning error

### Requirement: Admin Role Seeding

The system MUST ensure an Admin role exists in the new tenant database with full system permissions.

#### Scenario: Admin role upserted on provisioning
- GIVEN a tenant database exists
- WHEN the provisioning process seeds the database
- THEN a role with code `admin` and permissions `*.*` MUST exist
- AND the role MUST be upserted (created or found if already existing)

### Requirement: Admin User Creation

The system MUST create the first admin user in the tenant using the admin email from the company creation form, with a default password and `mustChangePassword: true`.

#### Scenario: Admin user created with defaults
- GIVEN the tenant database and Admin role exist
- WHEN the admin user is created with the provided admin email
- THEN the user MUST have the provided admin email
- AND the password MUST default to `123456`
- AND `mustChangePassword` MUST be `true`
- AND the role MUST be set to `admin`

#### Scenario: User creation failure logged and surfaced
- GIVEN provisioning is in progress
- WHEN admin user creation fails
- THEN the error MUST be logged
- AND the tenant database MUST remain in a partial provisioning state
- AND the caller MUST receive a failure response

### Requirement: Default Password Feedback

The system MUST return the generated default password to the creator in the company creation response.

#### Scenario: Password shown on success
- GIVEN the company and admin user were created successfully
- WHEN the creation response is returned
- THEN the response MUST include `defaultPassword` with the generated password
