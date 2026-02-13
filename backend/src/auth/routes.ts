import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getRequestToken, getAccessToken, getUser, isFromFaculty } from './usos.js';
import { signToken, verifyToken } from './jwt.js';
import { config } from '../config.js';

export const authRouter = Router();

const SESSION_COOKIE = 'notes_session';
const STATE_COOKIE = 'oauth_state';

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
  domain: config.cookieDomain,
};

// --- 1. Inicjuje OAuth flow ---
authRouter.get('/auth/login', async (_req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(32).toString('hex');

    const { authorizeUrl } = await getRequestToken(state);

    res.cookie(STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: 5 * 60 * 1000,
    });

    res.redirect(authorizeUrl);
  } catch (err) {
    console.error('Failed to get request token:', err);
    res.redirect(`${config.frontendUrl}?auth_error=usos_unavailable`);
  }
});

// --- 2. Callback z USOS ---
authRouter.get('/auth/callback', async (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier } = req.query;
  const state = req.cookies[STATE_COOKIE];

  res.clearCookie(STATE_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax' as const,
    domain: config.cookieDomain,
  });

  if (typeof oauth_token !== 'string' || typeof oauth_verifier !== 'string' || !state) {
    res.redirect(`${config.frontendUrl}?auth_error=invalid_callback`);
    return;
  }

  try {
    const { accessToken, accessSecret } = await getAccessToken(oauth_token, oauth_verifier, state);
    const user = await getUser(accessToken, accessSecret);

    if (!user.id || !user.first_name || !user.last_name) {
      throw new Error('Incomplete user data from USOS');
    }

    if (!isFromFaculty(user, config.allowedFacultyId)) {
      console.log(`Access denied for user ${user.id}: not from allowed faculty`);
      res.redirect(`${config.frontendUrl}?auth_error=wrong_faculty`);
      return;
    }

    const token = signToken({
      usosId: String(user.id),
      name: `${user.first_name} ${user.last_name}`.slice(0, 200),
      email: (user.email || '').slice(0, 320),
    });

    console.log(`User logged in: ${user.id}`);

    res.cookie(SESSION_COOKIE, token, cookieOptions);
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error('OAuth callback failed:', err);
    res.redirect(`${config.frontendUrl}?auth_error=callback_failed`);
  }
});

// --- 3. Dane zalogowanego usera (dla React) ---
authRouter.get('/api/auth/me', (req: Request, res: Response) => {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  res.json({ name: payload.name, email: payload.email });
});

// --- 4. Wylogowanie ---
authRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax' as const,
    domain: config.cookieDomain,
  });
  res.json({ ok: true });
});

// --- 5. Weryfikacja dla nginx auth_request ---
authRouter.get('/auth/verify', (req: Request, res: Response) => {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) {
    res.sendStatus(401);
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.sendStatus(401);
    return;
  }

  res.set('X-User-Id', payload.usosId);
  res.sendStatus(200);
});
