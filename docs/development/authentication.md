# Authentication & Access Control

This document covers the authentication system, user roles, and access control in Colloquium.

## Authentication System

Colloquium uses a **magic link authentication** system - no passwords required! Users simply enter their email address and receive a secure link to sign in.

### How Magic Links Work

1. User enters their email on the login page
2. System generates a secure, time-limited token
3. Magic link is sent to the user's email (or printed to console in development)
4. User clicks the link to authenticate and receive a JWT session token
5. JWT token is stored as an HTTP-only cookie for subsequent requests

## User Roles & Permissions

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| **Author** | 1 | Can submit manuscripts and participate in discussions |
| **Reviewer** | 2 | Can review manuscripts and provide feedback |
| **Editor** | 3 | Can manage submissions, assign reviewers, make editorial decisions |
| **Admin** | 4 | Full system access including user management and configuration |

### Access Control Matrix

| Feature/Page | Public | Author | Reviewer | Editor | Admin |
|-------------|--------|--------|----------|--------|-------|
| **Dashboard** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Manuscripts (Browse)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manuscript Submission** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **About Pages** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Conversations** | ✅* | ✅* | ✅* | ✅ | ✅ |
| **Bot Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **User Management** | ❌ | ❌ | ❌ | ❌ | ✅ |

*Access filtered by conversation privacy levels

### Conversation Privacy Filtering

- **Unauthenticated**: Only see PUBLIC conversations
- **Authors/Reviewers**: See PUBLIC, SEMI_PUBLIC, and PRIVATE conversations they participate in
- **Editors/Admins**: See all conversations regardless of privacy level

## Test Users for Development

The database seed creates test users for each role. Use these for development and testing:

### 🔑 **Admin User**
- **Email**: `admin@colloquium.example.com`
- **Name**: Admin User
- **Access**: Full system access, can see dashboard, manage bots and users

### 📝 **Editor User**
- **Email**: `editor@colloquium.example.com`
- **Name**: Editor User
- **Access**: Editorial dashboard, manuscript management, reviewer assignment

### ✍️ **Author User**
- **Email**: `author@colloquium.example.com`
- **Name**: Sample Author
- **Access**: Can submit manuscripts, participate in conversations

### 👀 **Reviewer User**
- **Email**: `reviewer@colloquium.example.com`
- **Name**: Sample Reviewer
- **Access**: Can review manuscripts, provide feedback

## How to Sign In (Development)

1. **Navigate to Login**: Go to `/auth/login` in your browser
2. **Enter Email**: Use one of the test emails above
3. **Send Magic Link**: Click "Send Magic Link" button
4. **Check Console**: In development, magic links are printed to the server console since email isn't configured
5. **Copy Link**: Find the magic link in the console output that looks like:
   ```
   🔗 Magic link for admin@colloquium.example.com:
   http://localhost:3001/auth/verify?token=abc123...&email=admin@colloquium.example.com
   ```
6. **Complete Login**: Paste the link into your browser to authenticate

## Route Protection

### Protected Route Component

The system uses a `ProtectedRoute` component to control access:

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Require authentication
<ProtectedRoute>
  <SomeComponent />
</ProtectedRoute>

// Require specific roles
<ProtectedRoute allowedRoles={['ADMIN', 'EDITOR']}>
  <DashboardComponent />
</ProtectedRoute>
```

### Convenience Components

```tsx
import { AdminRoute, EditorRoute, AuthenticatedRoute } from '@/components/auth/ProtectedRoute';

// Admin only
<AdminRoute>
  <AdminPanel />
</AdminRoute>

// Admin or Editor
<EditorRoute>
  <Dashboard />
</EditorRoute>

// Any authenticated user
<AuthenticatedRoute>
  <UserProfile />
</AuthenticatedRoute>
```

## API Authentication

### Middleware

- **`authenticate`**: Requires valid JWT token
- **`optionalAuth`**: Adds user info if authenticated, but doesn't require it
- **`requirePermission`**: Checks specific permissions

### Usage Examples

```typescript
// Require authentication
router.get('/protected', authenticate, async (req, res) => {
  // req.user is available and guaranteed to exist
});

// Optional authentication
router.get('/public', optionalAuth, async (req, res) => {
  // req.user may or may not exist
});

// Require specific permission
router.post('/admin', authenticate, requirePermission(Permission.MANAGE_USERS), async (req, res) => {
  // User is authenticated and has MANAGE_USERS permission
});
```

## Environment Variables

Set these environment variables for authentication:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Magic Link Configuration  
MAGIC_LINK_SECRET=your-magic-link-secret-here

# Frontend URL for CORS and redirects
FRONTEND_URL=http://localhost:3001
```

## Session Management

- **JWT Tokens**: Stored as HTTP-only cookies for security
- **Expiration**: Default 7 days (configurable via JWT_EXPIRES_IN)
- **Refresh**: Automatic token refresh on API requests when user is active
- **Logout**: Clears authentication cookie and redirects to home page

## Security Features

- **HTTP-Only Cookies**: Prevents XSS attacks on tokens
- **Time-Limited Magic Links**: Expire after 15 minutes
- **CSRF Protection**: Coming soon
- **Rate Limiting**: Coming soon for auth endpoints
- **Secure Headers**: Helmet.js configured for security headers

## Development Tips

### Testing Different Roles

1. **Sign out**: Use the user menu to sign out
2. **Sign in as different role**: Use a different test email
3. **Test access**: Try accessing different pages to verify protection
4. **Check navigation**: Notice how navigation items change based on role

### Debugging Authentication

- Check browser console for authentication errors
- Look at server logs for magic link generation
- Verify JWT tokens in browser dev tools (Application > Cookies)
- Use network tab to see authentication headers in API requests

### Creating New Users

You can create users directly in the database or via the API:

```typescript
// Via Prisma (in seed or migration)
await prisma.user.create({
  data: {
    email: 'newuser@example.com',
    name: 'New User',
    role: 'AUTHOR'
  }
});
```

## Troubleshooting

### Common Issues

1. **"Not Authenticated" errors**: Check if JWT cookie exists and is valid
2. **CORS errors**: Verify FRONTEND_URL matches your development server
3. **Magic links not working**: Check server console for the actual link
4. **Access denied**: Verify user has correct role for the protected resource

### Token Issues

- Tokens expire after 7 days by default
- Invalid tokens are automatically cleared
- Check browser dev tools > Application > Cookies for auth-token

### Role Issues

- User roles are set at the database level
- Changing roles requires updating the database directly
- Role changes take effect on next login/token refresh