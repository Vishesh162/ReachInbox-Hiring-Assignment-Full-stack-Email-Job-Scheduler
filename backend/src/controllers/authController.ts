import { Request, Response } from 'express';
import {
  verifyGoogleTokenAndGetUser,
  loginWithEmail,
} from '../services/authService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { prisma } from '../db/client.js';

export async function handleGoogleLogin(req: Request, res: Response) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const { user, token } = await verifyGoogleTokenAndGetUser(idToken);

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        hasSlack: Boolean(user.slackAccessToken),
      },
      token,
    });
  } catch (err: any) {
    console.error('[Google Login Error]', err.message);
    return res.status(401).json({ error: err.message || 'Authentication failed' });
  }
}

export async function handleEmailLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { user, token } = await loginWithEmail(email);

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        hasSlack: Boolean(user.slackAccessToken),
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      slackAccessToken: true,
      slackTeamId: true,
      slackChannelId: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    user: {
      ...user,
      hasSlack: Boolean(user.slackAccessToken),
    },
  });
}

export async function logout(req: Request, res: Response) {
  res.clearCookie('session_token');
  return res.json({ success: true, message: 'Logged out successfully' });
}
