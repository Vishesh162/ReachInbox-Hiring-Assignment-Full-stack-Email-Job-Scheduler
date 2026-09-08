import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
}

export function generateSessionToken(payload: TokenPayload | string): string {
  const tokenPayload =
    typeof payload === 'string'
      ? { userId: payload, email: '', name: '' }
      : payload;
  return jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verifies Google ID token from frontend and returns or creates User
 */
export async function verifyGoogleTokenAndGetUser(idToken: string) {
  let googleId: string;
  let email: string;
  let name: string;
  let avatarUrl: string | undefined;

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim()) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid Google ID Token payload');
    }
    googleId = payload.sub;
    email = payload.email;
    name = payload.name || payload.email.split('@')[0];
    avatarUrl = payload.picture;
  } else {
    // Development / Mock fallback when GOOGLE_CLIENT_ID is not yet configured in local demo
    email = idToken.includes('@') ? idToken : 'user@reachinbox.ai';
    googleId = `mock-google-${email}`;
    name = email.split('@')[0];
    avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces';
  }

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      avatarUrl: avatarUrl || undefined,
      googleId,
    },
    create: {
      email,
      name,
      avatarUrl,
      googleId,
    },
  });

  const token = generateSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return { user, token };
}

/**
 * Email login for demonstration and testing
 */
export async function loginWithEmail(email: string, name?: string) {
  const cleanEmail = email.trim().toLowerCase();
  const userName = name || cleanEmail.split('@')[0] || 'User';

  const user = await prisma.user.upsert({
    where: { email: cleanEmail },
    update: { name: userName },
    create: {
      email: cleanEmail,
      name: userName,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    },
  });

  const token = generateSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return { user, token };
}
