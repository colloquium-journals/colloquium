import { Router } from 'express';
import { prisma, GlobalRole } from '@colloquium/database';
import { generateJWT, generateSecureToken } from '@colloquium/auth';
import * as nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false, // Use STARTTLS
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined,
  tls: {
    rejectUnauthorized: false // For development
  }
});

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  redirectUrl: z.string().url('Invalid url').optional()
});

const verifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  email: z.string().email('Please enter a valid email address')
});

// POST /api/auth/login - Send magic link
router.post('/login', validateRequest({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, redirectUrl } = req.body;

    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Find or create user
    let user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Generate username from email prefix
      let baseUsername = email.toLowerCase().split('@')[0]
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^[^a-z]/, 'u')
        .slice(0, 27);

      // Ensure auto-generated usernames don't start with 'bot-' (reserved for system bots)
      if (baseUsername.startsWith('bot-')) {
        baseUsername = 'u' + baseUsername.slice(4);
      }

      const paddedUsername = baseUsername.length < 3 ? baseUsername + 'x'.repeat(3 - baseUsername.length) : baseUsername;

      let username = paddedUsername;
      let suffix = 2;
      while (await prisma.users.findUnique({ where: { username }, select: { id: true } })) {
        username = `${paddedUsername}-${suffix}`;
        suffix++;
      }

      user = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: email.toLowerCase(),
          username,
          role: GlobalRole.USER,
          updatedAt: new Date()
        }
      });
    }

    // Create magic link record
    await prisma.magic_links.create({
      data: {
        id: randomUUID(),
        email: email.toLowerCase(),
        token,
        expiresAt,
        redirectUrl: redirectUrl || (user.name ? `${process.env.FRONTEND_URL}/profile` : `${process.env.FRONTEND_URL}/profile/complete`),
        userId: user.id
      }
    });

    // Send magic link email
    const magicLinkUrl = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
    
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
        to: email,
        subject: 'Sign in to Colloquium',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <h1 style="color: #2563eb; margin-bottom: 24px;">Sign in to Colloquium</h1>
            <p style="margin-bottom: 24px; color: #374151; line-height: 1.6;">
              Click the link below to sign in to your Colloquium account:
            </p>
            <a href="${magicLinkUrl}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Sign in to Colloquium
            </a>
            <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
              This link will expire in 15 minutes. If you didn't request this email, you can safely ignore it.
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              Or copy and paste this URL into your browser: ${magicLinkUrl}
            </p>
          </div>
        `,
        text: `
Sign in to Colloquium

Click this link to sign in: ${magicLinkUrl}

This link will expire in 15 minutes. If you didn't request this email, you can safely ignore it.
        `
      });
    } catch (emailError) {
      console.error('Failed to send magic link email:', emailError);
      // Don't expose email errors to client in production
      if (process.env.NODE_ENV !== 'production') {
        console.log('Magic link URL for development:', magicLinkUrl);
      }
    }

    res.json({
      message: 'Magic link sent! Check your email to sign in.',
      ...(process.env.NODE_ENV === 'development' && {
        magicLinkUrl // Include link in development for testing
      })
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/verify - Verify magic link
router.get('/verify', validateRequest({ query: verifySchema }), async (req, res, next) => {
  try {
    const { token, email } = req.query as { token: string; email: string };

    // Find the magic link
    const magicLink = await prisma.magic_links.findUnique({
      where: { token },
      include: { users: true }
    });

    if (!magicLink || !magicLink.users) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'This magic link is invalid or has already been used'
      });
    }

    // Check if token has expired
    if (magicLink.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Token Expired',
        message: 'This magic link has expired. Please request a new one.'
      });
    }

    // Check if token has already been used
    if (magicLink.usedAt) {
      return res.status(400).json({
        error: 'Token Already Used',
        message: 'This magic link has already been used. Please request a new one.'
      });
    }

    // Verify email matches
    if (magicLink.email !== email.toLowerCase()) {
      return res.status(400).json({
        error: 'Email Mismatch',
        message: 'The email does not match this magic link'
      });
    }

    // Mark magic link as used
    await prisma.magic_links.update({
      where: { token },
      data: { usedAt: new Date() }
    });

    // Generate JWT
    const jwtToken = generateJWT({
      userId: magicLink.users.id,
      email: magicLink.users.email,
      role: magicLink.users.role
    });

    // Set HTTP-only cookie for security
    res.cookie('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Check if user needs to complete profile (new user without name)
    const needsProfileCompletion = !magicLink.users.name;
    const finalRedirectUrl = needsProfileCompletion 
      ? `${process.env.FRONTEND_URL}/profile/complete?returnUrl=${encodeURIComponent(magicLink.redirectUrl || `${process.env.FRONTEND_URL}/profile`)}`
      : magicLink.redirectUrl;

    res.json({
      message: 'Successfully authenticated',
      user: {
        id: magicLink.users.id,
        email: magicLink.users.email,
        name: magicLink.users.name,
        role: magicLink.users.role
      },
      token: jwtToken,
      redirectUrl: finalRedirectUrl,
      needsProfileCompletion
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies['auth-token'] || 
                  (req.headers.authorization?.startsWith('Bearer ') ? 
                   req.headers.authorization.slice(7) : null);

    if (!token) {
      return res.status(401).json({
        error: 'Not Authenticated',
        message: 'No authentication token provided'
      });
    }

    try {
      const { verifyJWT } = await import('@colloquium/auth');
      const payload = verifyJWT(token);
      
      // Get fresh user data from database
      const user = await prisma.users.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          orcidId: true,
          createdAt: true
        }
      });

      if (!user) {
        return res.status(401).json({
          error: 'User Not Found',
          message: 'User account no longer exists'
        });
      }

      res.json({
        user,
        token, // Include token for SSE authentication
        permissions: [] // TODO: Add role-based permissions
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'Authentication token is invalid or expired'
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    // Clear the auth cookie
    res.clearCookie('auth-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({ 
      message: 'Successfully logged out' 
    });
  } catch (error) {
    next(error);
  }
});

export default router;