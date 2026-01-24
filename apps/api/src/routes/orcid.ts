import { Router, Request, Response } from 'express';
import { prisma } from '@colloquium/database';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

function getOrcidConfig() {
  return {
    clientId: process.env.ORCID_CLIENT_ID,
    clientSecret: process.env.ORCID_CLIENT_SECRET,
    redirectUri: process.env.ORCID_REDIRECT_URI,
    baseUrl: process.env.ORCID_BASE_URL || 'https://sandbox.orcid.org',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  };
}

function getStateSecret() {
  return process.env.JWT_SECRET || process.env.MAGIC_LINK_SECRET || 'orcid-state-secret';
}

function createSignedState(userId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${userId}:${nonce}`;
  const signature = crypto.createHmac('sha256', getStateSecret()).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

function verifySignedState(state: string): { userId: string } | null {
  const parts = state.split(':');
  if (parts.length !== 3) return null;
  const [userId, nonce, signature] = parts;
  const payload = `${userId}:${nonce}`;
  const expected = crypto.createHmac('sha256', getStateSecret()).update(payload).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }
  return { userId };
}

// GET /api/auth/orcid - Initiate ORCID OAuth flow
router.get('/', authenticate, (req: any, res: Response) => {
  const { clientId, redirectUri, baseUrl, frontendUrl } = getOrcidConfig();

  if (!clientId || !redirectUri) {
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=not_configured`);
  }

  const state = createSignedState(req.user!.id);

  const authUrl = new URL(`${baseUrl}/oauth/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', '/authenticate');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// GET /api/auth/orcid/callback - Handle ORCID OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { clientId, clientSecret, redirectUri, baseUrl, frontendUrl } = getOrcidConfig();
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=denied`);
  }

  if (!state || typeof state !== 'string') {
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=invalid_state`);
  }

  const verified = verifySignedState(state);
  if (!verified) {
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=invalid_state`);
  }

  const { userId } = verified;

  if (!code) {
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=no_code`);
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=not_configured`);
  }

  try {
    const tokenResponse = await axios.post(
      `${baseUrl}/oauth/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri
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
      return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=no_orcid`);
    }

    const existingUser = await prisma.users.findFirst({
      where: {
        orcidId: orcid,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=already_claimed`);
    }

    await prisma.users.update({
      where: { id: userId },
      data: {
        orcidId: orcid,
        orcidVerified: true,
        updatedAt: new Date()
      }
    });

    return res.redirect(`${frontendUrl}/profile/edit?orcid=verified`);
  } catch (err: any) {
    console.error('ORCID OAuth error:', err.response?.data || err.message);
    return res.redirect(`${frontendUrl}/profile/edit?orcid=error&reason=exchange_failed`);
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
