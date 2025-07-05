import express from 'express';
import crypto from 'crypto';
import { prisma } from '@colloquium/database';
import { authenticate } from '../middleware/auth';

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    orcidState?: string;
    userId?: string;
  }
}

const router = express.Router();

// ORCID OAuth configuration
const ORCID_CLIENT_ID = process.env.ORCID_CLIENT_ID;
const ORCID_CLIENT_SECRET = process.env.ORCID_CLIENT_SECRET;
const ORCID_REDIRECT_URI = process.env.ORCID_REDIRECT_URI || 'http://localhost:4000/api/orcid/callback';
const ORCID_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://orcid.org' 
  : 'https://sandbox.orcid.org';

// Encryption key for storing access tokens
const ENCRYPTION_KEY = process.env.ORCID_ENCRYPTION_KEY || crypto.randomBytes(32);

// Utility functions for token encryption
function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.toString().slice(0, 32)), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.toString().slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Start ORCID OAuth flow
router.get('/auth', authenticate, async (req, res) => {
  try {
    if (!ORCID_CLIENT_ID) {
      return res.status(500).json({
        error: {
          message: 'ORCID integration not configured',
          type: 'configuration_error'
        }
      });
    }

    // Generate state parameter for security
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session or temporary store (using memory for now)
    req.session = req.session || {};
    req.session.orcidState = state;
    req.session.userId = req.user!.id;

    const authUrl = new URL(`${ORCID_BASE_URL}/oauth/authorize`);
    authUrl.searchParams.set('client_id', ORCID_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', '/authenticate');
    authUrl.searchParams.set('redirect_uri', ORCID_REDIRECT_URI);
    authUrl.searchParams.set('state', state);

    res.json({
      data: {
        authUrl: authUrl.toString()
      }
    });
  } catch (error) {
    console.error('Error starting ORCID auth:', error);
    res.status(500).json({
      error: {
        message: 'Failed to start ORCID authentication',
        type: 'server_error'
      }
    });
  }
});

// Handle ORCID OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=missing_parameters`);
    }

    // Verify state parameter
    if (!req.session?.orcidState || req.session.orcidState !== state) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=invalid_state`);
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`${ORCID_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: ORCID_CLIENT_ID!,
        client_secret: ORCID_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: ORCID_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('ORCID token exchange failed:', errorData);
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, orcid } = tokenData;

    if (!access_token || !orcid) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=invalid_token_response`);
    }

    // Update user with verified ORCID
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=session_expired`);
    }

    // Check if this ORCID is already associated with another user
    const existingUser = await prisma.users.findFirst({
      where: {
        orcidId: orcid,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=orcid_already_linked`);
    }

    // Encrypt the access token before storing
    const encryptedToken = encryptToken(access_token);

    // Update user with verified ORCID data
    await prisma.users.update({
      where: { id: userId },
      data: {
        orcidId: orcid,
        orcidVerified: true,
        orcidAccessToken: encryptedToken
      }
    });

    // Clear session data
    delete req.session.orcidState;
    delete req.session.userId;

    // Redirect back to profile with success
    res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_success=verified`);
  } catch (error) {
    console.error('Error in ORCID callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/profile/edit?orcid_error=server_error`);
  }
});

// Unlink ORCID account
router.delete('/unlink', authenticate, async (req, res) => {
  try {
    await prisma.users.update({
      where: { id: req.user!.id },
      data: {
        orcidId: null,
        orcidVerified: false,
        orcidAccessToken: null
      }
    });

    res.json({
      data: {
        message: 'ORCID account unlinked successfully'
      }
    });
  } catch (error) {
    console.error('Error unlinking ORCID:', error);
    res.status(500).json({
      error: {
        message: 'Failed to unlink ORCID account',
        type: 'server_error'
      }
    });
  }
});

// Get ORCID verification status
router.get('/status', authenticate, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user!.id },
      select: {
        orcidId: true,
        orcidVerified: true
      }
    });

    res.json({
      data: {
        orcidId: user?.orcidId || null,
        verified: user?.orcidVerified || false,
        hasToken: !!user?.orcidVerified
      }
    });
  } catch (error) {
    console.error('Error getting ORCID status:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get ORCID status',
        type: 'server_error'
      }
    });
  }
});

export default router;