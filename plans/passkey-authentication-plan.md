# Passkey Authentication Plan

**Status: Planning**

## Overview

Add opt-in passkey (WebAuthn/FIDO2) authentication as an alternative to magic links. This is primarily intended for editors and other frequent users who want faster, more convenient login without waiting for emails. Magic links remain the default and primary authentication method.

## Motivation

- **Speed**: Passkey login is instant vs. waiting for email delivery
- **Convenience**: No need to switch to email client, find the message, click link
- **Security**: Phishing-resistant, cryptographic authentication
- **Offline-capable**: Works without email access (important for conferences, travel)
- **Target users**: Editors, reviewers, and other power users with frequent access needs

## Design Principles

1. **Opt-in only**: Users must explicitly set up passkeys; magic links remain the default
2. **Additive, not replacement**: Passkeys supplement magic links rather than replace them
3. **Discoverable credentials**: Support usernameless authentication via passkey autofill
4. **Multi-device**: Users can register multiple passkeys (laptop, phone, security key)
5. **Graceful fallback**: Always allow magic link login even if passkeys are configured

## WebAuthn Flow Overview

### Registration (Creating a Passkey)

```
User clicks "Add Passkey" in account settings
        │
        ▼
POST /api/auth/passkey/register/options
  → Generate challenge, user info
  → Store challenge in session/short-lived record
  → Return PublicKeyCredentialCreationOptions
        │
        ▼
Browser calls navigator.credentials.create()
  → User authenticates with device (Touch ID, Face ID, PIN, security key)
  → Creates public/private key pair
  → Returns attestation response
        │
        ▼
POST /api/auth/passkey/register/verify
  → Validate challenge
  → Verify attestation
  → Store credential public key in database
  → Return success
```

### Authentication (Using a Passkey)

```
User visits login page
        │
        ▼
Passkey autofill OR user clicks "Sign in with Passkey"
        │
        ▼
POST /api/auth/passkey/authenticate/options
  → Generate challenge
  → If email provided, include allowCredentials for that user
  → Otherwise, allow discoverable credentials (usernameless)
  → Return PublicKeyCredentialRequestOptions
        │
        ▼
Browser calls navigator.credentials.get()
  → User authenticates with device
  → Signs challenge with private key
  → Returns assertion response
        │
        ▼
POST /api/auth/passkey/authenticate/verify
  → Identify user from credential ID
  → Verify signature against stored public key
  → Verify challenge
  → Update sign count (replay protection)
  → Generate JWT, set cookie
  → Return user data + redirect
```

## Implementation Steps

### 1. Dependencies

Add the SimpleWebAuthn libraries:

```bash
# Backend
npm install @simplewebauthn/server --workspace=@colloquium/api

# Frontend
npm install @simplewebauthn/browser --workspace=@colloquium/web
```

SimpleWebAuthn provides high-level abstractions over the WebAuthn spec with TypeScript support.

### 2. Database Schema

Add to `packages/database/prisma/schema.prisma`:

```prisma
model passkey_credentials {
  id              String   @id @default(cuid())
  userId          String

  // WebAuthn credential data
  credentialId    Bytes    @unique  // Raw credential ID from authenticator
  publicKey       Bytes             // COSE-encoded public key
  counter         BigInt   @default(0)  // Sign count for replay protection

  // Metadata
  deviceType      String?           // "singleDevice" or "multiDevice"
  backedUp        Boolean  @default(false)  // Whether credential is backed up (iCloud, etc.)
  transports      String[] // ["internal", "usb", "ble", "nfc", "hybrid"]

  // User-friendly identification
  name            String?           // User-provided name ("MacBook Pro", "YubiKey")

  // Audit
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?

  // Relations
  user            users    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model passkey_challenges {
  id          String   @id @default(cuid())
  challenge   String   @unique  // Base64URL encoded challenge
  userId      String?           // null for authentication, set for registration
  type        String            // "registration" or "authentication"
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([expiresAt])
}

// Add relation to users model
model users {
  // ... existing fields ...
  passkeyCredentials  passkey_credentials[]
}
```

### 3. Environment Variables

Add to `.env.example`:

```bash
# WebAuthn / Passkeys
# RP = Relying Party (your site)
WEBAUTHN_RP_ID=localhost                    # Domain name (no protocol/port)
WEBAUTHN_RP_NAME=Colloquium                 # Human-readable site name
WEBAUTHN_RP_ORIGIN=http://localhost:3000    # Full origin for verification
```

For production, these would be:
```bash
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_RP_NAME=Your Journal Name
WEBAUTHN_RP_ORIGIN=https://yourdomain.com
```

### 4. API Routes

Create `apps/api/src/routes/passkey.ts`:

#### Registration Endpoints

**`POST /api/auth/passkey/register/options`**
- Requires authentication (user must already be logged in)
- Generates registration options using SimpleWebAuthn
- Stores challenge in `passkey_challenges` table (5-minute expiry)
- Returns `PublicKeyCredentialCreationOptions`

```typescript
import { generateRegistrationOptions } from '@simplewebauthn/server';

// Key options:
const options = await generateRegistrationOptions({
  rpName: process.env.WEBAUTHN_RP_NAME,
  rpID: process.env.WEBAUTHN_RP_ID,
  userID: user.id,
  userName: user.email,
  userDisplayName: user.name || user.email,
  attestationType: 'none',  // Don't require attestation
  excludeCredentials: existingCredentials.map(c => ({
    id: c.credentialId,
    type: 'public-key',
    transports: c.transports,
  })),
  authenticatorSelection: {
    residentKey: 'preferred',      // Prefer discoverable credentials
    userVerification: 'preferred', // Prefer biometric/PIN but don't require
    authenticatorAttachment: undefined, // Allow any authenticator type
  },
});
```

**`POST /api/auth/passkey/register/verify`**
- Requires authentication
- Validates the attestation response
- Stores credential in `passkey_credentials` table
- Allows user to optionally provide a name for the credential

```typescript
import { verifyRegistrationResponse } from '@simplewebauthn/server';

const verification = await verifyRegistrationResponse({
  response: body.credential,
  expectedChallenge: storedChallenge,
  expectedOrigin: process.env.WEBAUTHN_RP_ORIGIN,
  expectedRPID: process.env.WEBAUTHN_RP_ID,
});

if (verification.verified && verification.registrationInfo) {
  await prisma.passkey_credentials.create({
    data: {
      userId: user.id,
      credentialId: Buffer.from(verification.registrationInfo.credentialID),
      publicKey: Buffer.from(verification.registrationInfo.credentialPublicKey),
      counter: verification.registrationInfo.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transports: body.credential.response.transports || [],
      name: body.credentialName || null,
    },
  });
}
```

#### Authentication Endpoints

**`POST /api/auth/passkey/authenticate/options`**
- Public endpoint (no authentication required)
- Optionally accepts email to filter to that user's credentials
- Generates authentication options
- Stores challenge (5-minute expiry)

```typescript
import { generateAuthenticationOptions } from '@simplewebauthn/server';

const options = await generateAuthenticationOptions({
  rpID: process.env.WEBAUTHN_RP_ID,
  userVerification: 'preferred',
  // If email provided, limit to that user's credentials
  // Otherwise, allow any discoverable credential
  allowCredentials: email ? userCredentials.map(c => ({
    id: c.credentialId,
    type: 'public-key',
    transports: c.transports,
  })) : undefined,
});
```

**`POST /api/auth/passkey/authenticate/verify`**
- Public endpoint
- Identifies user from credential ID
- Verifies the assertion signature
- Updates sign count
- Generates JWT and sets cookie
- Returns user data

```typescript
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

// Find credential by ID
const credential = await prisma.passkey_credentials.findUnique({
  where: { credentialId: Buffer.from(body.credential.id, 'base64url') },
  include: { user: true },
});

const verification = await verifyAuthenticationResponse({
  response: body.credential,
  expectedChallenge: storedChallenge,
  expectedOrigin: process.env.WEBAUTHN_RP_ORIGIN,
  expectedRPID: process.env.WEBAUTHN_RP_ID,
  authenticator: {
    credentialID: credential.credentialId,
    credentialPublicKey: credential.publicKey,
    counter: Number(credential.counter),
  },
});

if (verification.verified) {
  // Update counter and last used timestamp
  await prisma.passkey_credentials.update({
    where: { id: credential.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  // Generate JWT and set cookie (same as magic link verification)
  const token = generateJWT({ ... });
  // ...
}
```

#### Management Endpoints

**`GET /api/auth/passkey/credentials`**
- Requires authentication
- Lists user's registered passkeys
- Returns id, name, createdAt, lastUsedAt, deviceType, backedUp

**`PATCH /api/auth/passkey/credentials/:id`**
- Requires authentication
- Allows renaming a credential
- Validates credential belongs to user

**`DELETE /api/auth/passkey/credentials/:id`**
- Requires authentication
- Removes a passkey credential
- Validates credential belongs to user

### 5. Frontend Components

#### PasskeyLoginButton Component

```typescript
// apps/web/src/components/auth/PasskeyLoginButton.tsx

import { startAuthentication } from '@simplewebauthn/browser';

export function PasskeyLoginButton({ onSuccess, onError }) {
  const handlePasskeyLogin = async () => {
    // Get authentication options from server
    const optionsRes = await fetch('/api/auth/passkey/authenticate/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // No email = discoverable credentials
    });
    const options = await optionsRes.json();

    // Trigger browser passkey UI
    const credential = await startAuthentication(options);

    // Verify with server
    const verifyRes = await fetch('/api/auth/passkey/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    });

    if (verifyRes.ok) {
      onSuccess(await verifyRes.json());
    } else {
      onError(await verifyRes.json());
    }
  };

  return (
    <Button onClick={handlePasskeyLogin} variant="outline">
      Sign in with Passkey
    </Button>
  );
}
```

#### Passkey Autofill Integration

Add conditional mediation to the login page for automatic passkey prompts:

```typescript
// In LoginForm.tsx or a parent component

useEffect(() => {
  // Check if WebAuthn and conditional mediation are supported
  if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
    PublicKeyCredential.isConditionalMediationAvailable().then(async (available) => {
      if (available) {
        // Get options for conditional UI
        const res = await fetch('/api/auth/passkey/authenticate/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const options = await res.json();

        try {
          // Start conditional authentication (shows in autofill)
          const credential = await startAuthentication(options, true); // true = conditional
          // Verify and complete login...
        } catch (e) {
          // User didn't select a passkey, that's fine
        }
      }
    });
  }
}, []);
```

The email input should include `autocomplete="username webauthn"` to enable passkey autofill.

#### PasskeySettings Component

```typescript
// apps/web/src/components/auth/PasskeySettings.tsx

export function PasskeySettings() {
  const [credentials, setCredentials] = useState([]);
  const [registering, setRegistering] = useState(false);

  // Fetch existing credentials on mount
  // ...

  const registerPasskey = async () => {
    setRegistering(true);

    // Get registration options
    const optionsRes = await fetch('/api/auth/passkey/register/options', {
      method: 'POST',
      credentials: 'include',
    });
    const options = await optionsRes.json();

    // Create credential via browser API
    const credential = await startRegistration(options);

    // Verify and store
    const verifyRes = await fetch('/api/auth/passkey/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        credential,
        credentialName: await promptForName(), // Optional
      }),
    });

    // Refresh list
    // ...
  };

  return (
    <div>
      <h3>Passkeys</h3>
      <p>Passkeys let you sign in instantly without waiting for an email.</p>

      {credentials.length > 0 ? (
        <ul>
          {credentials.map(cred => (
            <li key={cred.id}>
              {cred.name || 'Unnamed Passkey'}
              <span>Created {formatDate(cred.createdAt)}</span>
              <span>Last used {cred.lastUsedAt ? formatDate(cred.lastUsedAt) : 'Never'}</span>
              <Button onClick={() => deleteCredential(cred.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No passkeys registered yet.</p>
      )}

      <Button onClick={registerPasskey} loading={registering}>
        Add Passkey
      </Button>
    </div>
  );
}
```

### 6. Login Page Changes

Update `apps/web/src/components/auth/LoginForm.tsx`:

```tsx
export function LoginForm() {
  // ... existing state ...
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    // Check for WebAuthn support
    setPasskeySupported(
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }, []);

  return (
    <div>
      {/* Passkey option first for returning users */}
      {passkeySupported && (
        <>
          <PasskeyLoginButton
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
          />
          <Divider label="or" />
        </>
      )}

      {/* Existing magic link form */}
      <form onSubmit={handleMagicLinkSubmit}>
        <TextInput
          label="Email"
          type="email"
          autoComplete="username webauthn"  // Enable passkey autofill
          // ...
        />
        <Button type="submit">Send Magic Link</Button>
      </form>
    </div>
  );
}
```

### 7. Account Settings Page

Add passkey management to the profile/account settings:

```tsx
// apps/web/src/app/profile/settings/page.tsx or similar

export default function AccountSettings() {
  return (
    <div>
      <h2>Account Settings</h2>

      {/* Existing settings... */}

      <Section title="Authentication">
        <p>
          You can always sign in using a magic link sent to your email.
          Add a passkey for faster access on this device.
        </p>
        <PasskeySettings />
      </Section>
    </div>
  );
}
```

## Security Considerations

1. **Challenge storage**: Challenges stored server-side with short expiry (5 minutes) to prevent replay attacks
2. **Sign count verification**: Track and verify authenticator sign count to detect cloned credentials
3. **Origin verification**: Verify the origin matches the expected RP origin
4. **No attestation requirement**: Using `attestationType: 'none'` for maximum compatibility; we don't need to verify the authenticator's identity
5. **Credential ID uniqueness**: Database-level unique constraint prevents duplicate registration
6. **User verification preference**: Using 'preferred' rather than 'required' to support security keys without biometrics
7. **Rate limiting**: Apply rate limiting to authentication endpoints to prevent brute force
8. **Cleanup job**: Periodic cleanup of expired challenges from the database

## Browser Support

WebAuthn is widely supported:
- Chrome 67+ (2018)
- Firefox 60+ (2018)
- Safari 13+ (2019)
- Edge 79+ (2020)
- All major mobile browsers

Passkey autofill (conditional mediation) has more limited support:
- Chrome 108+ (Dec 2022)
- Safari 16+ (Sep 2022)
- Firefox: Not yet supported

The implementation should gracefully degrade when features aren't available.

## User Experience Flow

### First-time user
1. Enters email, receives magic link, logs in
2. Sees banner/prompt: "Add a passkey for faster login next time"
3. Optionally sets up passkey in account settings

### Returning user with passkey
1. Visits login page
2. Browser shows passkey autofill prompt OR clicks "Sign in with Passkey"
3. Authenticates with device (Touch ID, Face ID, PIN)
4. Instantly logged in

### User without passkey / on new device
1. Visits login page
2. Passkey prompt shows "No passkeys available" or user dismisses
3. Falls back to magic link flow

### Edge cases
- **Lost device**: Use magic link, then remove old passkey from settings
- **Multiple passkeys**: All show in browser picker; user selects one
- **Synced passkeys**: iCloud Keychain / Google Password Manager passkeys work across devices automatically

## Files to Modify/Create

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add `passkey_credentials` and `passkey_challenges` models |
| `apps/api/package.json` | Add `@simplewebauthn/server` dependency |
| `apps/api/src/routes/passkey.ts` | New file: all passkey endpoints |
| `apps/api/src/index.ts` | Register passkey router |
| `.env.example` | Add WEBAUTHN env vars |
| `apps/web/package.json` | Add `@simplewebauthn/browser` dependency |
| `apps/web/src/components/auth/PasskeyLoginButton.tsx` | New component |
| `apps/web/src/components/auth/PasskeySettings.tsx` | New component |
| `apps/web/src/components/auth/LoginForm.tsx` | Add passkey option and autofill support |
| `apps/web/src/app/profile/settings/page.tsx` | Add passkey settings section (or create page) |

## Testing

### Unit Tests
- Challenge generation and storage
- Credential storage and retrieval
- Sign count verification logic

### Integration Tests
- Registration flow (mock authenticator)
- Authentication flow (mock authenticator)
- Error cases (invalid challenge, wrong user, expired challenge)
- Credential management (list, rename, delete)

### Manual Testing
- Test with macOS Touch ID
- Test with Windows Hello
- Test with security key (YubiKey)
- Test with mobile (Face ID / fingerprint)
- Test passkey autofill in Chrome/Safari
- Test cross-device sync (iCloud Keychain)
- Test fallback to magic link

## Cleanup Job

Add a scheduled job to clean up expired challenges:

```typescript
// Run daily or more frequently
await prisma.passkey_challenges.deleteMany({
  where: {
    expiresAt: { lt: new Date() },
  },
});
```

This can be added to the existing graphile-worker setup.

## Future Considerations

1. **Passkey-only accounts**: Option for users to disable magic links entirely
2. **Admin visibility**: Show passkey registration status in admin user management
3. **Passkey requirement for roles**: Optionally require passkeys for editor/admin roles
4. **Cross-device authentication**: Using hybrid transports for phone-as-authenticator
5. **Recovery codes**: Backup codes for users who lose all passkeys and email access
6. **Audit logging**: Log passkey registrations and authentications for security review

## References

- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [SimpleWebAuthn Documentation](https://simplewebauthn.dev/)
- [Passkeys.dev](https://passkeys.dev/) - Comprehensive passkey resources
- [FIDO Alliance](https://fidoalliance.org/fido2/)
