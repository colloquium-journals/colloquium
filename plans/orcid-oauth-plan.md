# ORCID OAuth Verification Plan

**Status: ✅ Implemented** (January 2026)

## Overview

Replace the current "manual entry + public API existence check" with a proper OAuth 2.0 flow that cryptographically proves a user owns the ORCID they claim. The current system (`apps/api/src/routes/users.ts:26-52`) only confirms an ORCID exists via the public API, but anyone could enter anyone else's ORCID.

## Current State

- `orcidId` field exists on the `users` table (unique, optional string)
- Users manually type their ORCID in the profile edit page
- Server calls `https://pub.orcid.org/v3.0/{id}/person` to check it exists
- Previous `orcidVerified` and `orcidAccessToken` fields were added then removed (migrations `20250616` / `20250716`)
- Journal settings schema already has `requireOrcid: boolean` (defaults to false)

## OAuth Flow Design

### Scope

Only `/authenticate` is needed. This is the minimal scope that confirms identity and grants read access to public data. No need for `/read-limited` or write scopes.

### Endpoints

| Environment | Authorization URL | Token URL |
|---|---|---|
| Sandbox | `https://sandbox.orcid.org/oauth/authorize` | `https://sandbox.orcid.org/oauth/token` |
| Production | `https://orcid.org/oauth/authorize` | `https://orcid.org/oauth/token` |

### Flow

```
User clicks "Verify ORCID" button
        │
        ▼
GET /api/auth/orcid
  → generates state token, stores in session/cookie
  → redirects to orcid.org/oauth/authorize?
      client_id=APP-XXXX&
      response_type=code&
      scope=/authenticate&
      redirect_uri=.../api/auth/orcid/callback&
      state=<random>
        │
        ▼
User signs in at orcid.org and authorizes
        │
        ▼
GET /api/auth/orcid/callback?code=XXXXXX&state=<random>
  → validates state token
  → POST to orcid.org/oauth/token with:
      client_id, client_secret, grant_type=authorization_code, code, redirect_uri
  → receives: { access_token, orcid, name, ... }
  → updates user record: orcidId = orcid, orcidVerified = true
  → redirects to frontend profile page with success indicator
```

## Implementation Steps

### 1. Environment Variables

Add to `.env.example` and document:

```bash
# ORCID OAuth (get credentials at https://orcid.org/developer-tools)
ORCID_CLIENT_ID=APP-XXXXXXXXXXXXXXXX
ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ORCID_REDIRECT_URI=http://localhost:4000/api/auth/orcid/callback
ORCID_BASE_URL=https://sandbox.orcid.org   # Use https://orcid.org in production
```

### 2. Database Migration

Re-add the verification field to the users model:

```prisma
model users {
  // existing fields...
  orcidId        String?  @unique
  orcidVerified  Boolean  @default(false)
}
```

Single migration: add `orcidVerified` column with default `false`.

Do NOT store the access token — we only need it transiently during the callback to confirm identity. Storing tokens creates a security liability with no benefit for the `/authenticate` scope.

### 3. API Routes

Create `apps/api/src/routes/orcid.ts`:

#### `GET /api/auth/orcid`
- Requires authentication (user must be logged in)
- Generates a cryptographically random `state` parameter
- Stores `state` in a short-lived cookie (e.g., 10 minutes, httpOnly, secure, sameSite=lax)
- Redirects to ORCID authorization URL

#### `GET /api/auth/orcid/callback`
- Validates `state` parameter against cookie
- Exchanges authorization `code` for token via POST to ORCID token endpoint
- Token response includes the authenticated ORCID iD directly
- Checks for ORCID uniqueness (not already claimed by another user)
- Updates user record: sets `orcidId` and `orcidVerified = true`
- Clears state cookie
- Redirects to `${FRONTEND_URL}/profile/edit?orcid=verified`
- Error cases redirect to `${FRONTEND_URL}/profile/edit?orcid=error&reason=<code>`

#### `DELETE /api/auth/orcid`
- Requires authentication
- Clears `orcidId` and sets `orcidVerified = false`
- Allows users to unlink their ORCID

### 4. Modify Existing Profile Update

In `apps/api/src/routes/users.ts`, the `PUT /api/users/me` endpoint should:
- Remove the manual ORCID entry path (lines 396-435)
- Only allow ORCID changes through the OAuth flow
- Keep the ability to set `orcidId = null` (unlinking) through the existing endpoint or the new DELETE route

### 5. Frontend Changes

#### Profile Edit Page (`apps/web/src/app/profile/edit/page.tsx`)

Replace the manual ORCID text input with:
- **If no ORCID linked**: Show a "Link ORCID" button that navigates to `/api/auth/orcid`
- **If ORCID linked and verified**: Show the ORCID as a read-only badge with a green verified indicator and an "Unlink" button
- **Handle query params**: On mount, check for `?orcid=verified` or `?orcid=error` and show appropriate toast notifications

#### Profile Display Pages

Where ORCID is displayed (profile page, article author list, hover cards):
- Show a verified checkmark/badge next to the ORCID when `orcidVerified === true`
- Use the standard ORCID icon (green circle with "iD") for the link

### 6. Type Updates

In `packages/types/src/index.ts`:
- Add `orcidVerified: z.boolean().optional()` to relevant schemas
- Remove the manual `orcidId` field from `UserUpdateSchema` (no longer user-editable via form)

### 7. Seed Data

Update `packages/database/prisma/seed.ts` to include sample users with verified ORCIDs for development/testing.

## Security Considerations

- **State parameter**: Prevents CSRF attacks on the OAuth callback
- **No token storage**: Access tokens are used transiently and discarded
- **HTTPS required**: ORCID requires HTTPS redirect URIs in production
- **Uniqueness enforcement**: Database-level unique constraint on `orcidId` prevents duplicate claims
- **Cookie security**: State cookie should be httpOnly, secure (in production), sameSite=lax
- **Rate limiting**: Apply rate limiting to `/api/auth/orcid` to prevent abuse

## Registration Requirements

To get production credentials:
1. Register as an ORCID member or use the Public API client registration
2. For `/authenticate` scope only, Public API credentials suffice
3. Register redirect URI(s) with ORCID
4. ORCID may review the integration before granting production access

For development, use the sandbox:
- Create a sandbox account at https://sandbox.orcid.org
- Register an application in sandbox developer tools
- Sandbox credentials work immediately without review

## Files to Modify

| File | Change |
|---|---|
| `.env.example` | Add ORCID env vars |
| `packages/database/prisma/schema.prisma` | Add `orcidVerified` field |
| `apps/api/src/routes/orcid.ts` | New file: OAuth routes |
| `apps/api/src/index.ts` | Register orcid router |
| `apps/api/src/routes/users.ts` | Remove manual ORCID entry logic |
| `packages/types/src/index.ts` | Add `orcidVerified`, remove manual orcidId from update schema |
| `apps/web/src/app/profile/edit/page.tsx` | Replace text input with OAuth button |
| `apps/web/src/app/profile/page.tsx` | Show verified badge |
| `apps/web/src/components/shared/UserProfileHover.tsx` | Show verified indicator |
| `apps/web/src/app/articles/[id]/page.tsx` | Show verified indicator on author ORCID |
| `packages/database/prisma/seed.ts` | Add sample verified ORCIDs |

## Testing

- Unit tests for state generation and validation
- Integration test for the full OAuth callback flow (mock ORCID token endpoint)
- Test duplicate ORCID prevention
- Test unlinking flow
- Test error handling (invalid code, expired state, network errors)
- E2E test with ORCID sandbox (manual/CI)

## Development Setup

The implementation is complete. To activate it:

1. Create a sandbox account at https://sandbox.orcid.org
2. Go to https://sandbox.orcid.org/developer-tools
3. Register an application:
   - **Application URL**: `http://localhost:3000`
   - **Redirect URI**: `http://localhost:4000/api/auth/orcid/callback`
4. Add to your `.env`:
   ```bash
   ORCID_CLIENT_ID=APP-XXXXXXXXXXXXXXXX
   ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ORCID_REDIRECT_URI=http://localhost:4000/api/auth/orcid/callback
   ORCID_BASE_URL=https://sandbox.orcid.org
   ```
5. Restart the API server

For production: register at https://orcid.org/developer-tools (requires HTTPS redirect URI) and set `ORCID_BASE_URL=https://orcid.org`.

## Future Considerations

- **requireOrcid enforcement**: When journal setting `requireOrcid` is true, require verified ORCID before manuscript submission
- **Co-author ORCID**: Allow submitting authors to invite co-authors to verify their ORCIDs
- **ORCID profile sync**: Periodically refresh name/affiliation from ORCID public profile
- **Member API upgrade**: If the journal becomes an ORCID member, could write publications back to authors' ORCID records
