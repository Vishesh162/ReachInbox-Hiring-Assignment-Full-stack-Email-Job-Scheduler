import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../services/authService.js';
import { prisma } from '../db/client.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    slackAccessToken?: string | null;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token =
    req.cookies?.session_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, slackAccessToken: true },
      });
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  return res.status(401).json({
    error: 'Unauthorized: Authentication session token required',
  });
}
