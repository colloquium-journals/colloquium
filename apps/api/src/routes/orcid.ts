import { Router, Request, Response } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

const ORCID_CLIENT_ID = process.env.ORCID_CLIENT_ID;
const ORCID_CLIENT_SECRET = process.env.ORCID_CLIENT_SECRET;
const ORCID_REDIRECT_URI = process.env.ORCID_REDIRECT_URI;
const ORCID_BASE_URL = process.env.ORCID_BASE_URL || 'https://sandbox.orcid.org';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// GET /api/auth/orcid - Initiate ORCID OAuth flow
router.get('/', authenticate, (req: any, res: Response) => {
  if (!ORCID_CLIENT_ID || !ORCID_REDIRECT_URI) {
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=not_configured`);
  }

  const state = crypto.randomBytes(32).toString('hex');

  // Store state in a short-lived cookie
  res.cookie('orcid_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });

  // Store user ID in a cookie so the callback can identify the user
  res.cookie('orcid_oauth_user', req.user!.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000
  });

  const authUrl = new URL(`${ORCID_BASE_URL}/oauth/authorize`);
  authUrl.searchParams.set('client_id', ORCID_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', '/authenticate');
  authUrl.searchParams.set('redirect_uri', ORCID_REDIRECT_URI);
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// GET /api/auth/orcid/callback - Handle ORCID OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query;

  const storedState = req.cookies['orcid_oauth_state'];
  const userId = req.cookies['orcid_oauth_user'];

  // Clear OAuth cookies
  res.clearCookie('orcid_oauth_state');
  res.clearCookie('orcid_oauth_user');

  if (oauthError) {
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=denied`);
  }

  if (!state || !storedState || state !== storedState) {
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=invalid_state`);
  }

  if (!userId) {
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=session_expired`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=no_code`);
  }

  if (!ORCID_CLIENT_ID || !ORCID_CLIENT_SECRET || !ORCID_REDIRECT_URI) {
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=not_configured`);
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      `${ORCID_BASE_URL}/oauth/token`,
      new URLSearchParams({
        client_id: ORCID_CLIENT_ID,
        client_secret: ORCID_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: ORCID_REDIRECT_URI
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    const { orcid } = tokenResponse.data as { orcid: string };

    if (!orcid) {
      return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=no_orcid`);
    }

    // Check if this ORCID is already claimed by another user
    const existingUser = await prisma.users.findFirst({
      where: {
        orcidId: orcid,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=already_claimed`);
    }

    // Update user record with verified ORCID
    await prisma.users.update({
      where: { id: userId },
      data: {
        orcidId: orcid,
        orcidVerified: true,
        updatedAt: new Date()
      }
    });

    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=verified`);
  } catch (err: any) {
    console.error('ORCID OAuth error:', err.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL}/profile/edit?orcid=error&reason=exchange_failed`);
  }
});

// DELETE /api/auth/orcid - Unlink ORCID from account
router.delete('/', authenticate, async (req: any, res: Response) => {
  try {
    await prisma.users.update({
      where: { id: req.user!.id },
      data: {
        orcidId: null,
        orcidVerified: false,
        updatedAt: new Date()
      }
    });

    res.json({ message: 'ORCID unlinked successfully' });
  } catch (err) {
    console.error('ORCID unlink error:', err);
    res.status(500).json({
      error: 'Unlink Failed',
      message: 'Failed to unlink ORCID from your account'
    });
  }
});

export default router;
