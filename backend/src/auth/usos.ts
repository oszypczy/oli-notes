import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { config } from '../config.js';

const oauth = new OAuth({
  consumer: {
    key: config.consumerKey,
    secret: config.consumerSecret,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
});

// --- Pending tokens z limitem rozmiaru ---
const MAX_PENDING = 1000;
const pendingTokens = new Map<string, { secret: string; state: string; expires: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [key, val] of pendingTokens) {
    if (val.expires < now) pendingTokens.delete(key);
  }
}

// --- Request Token ---
export async function getRequestToken(state: string): Promise<{ token: string; authorizeUrl: string }> {
  cleanExpired();
  if (pendingTokens.size >= MAX_PENDING) {
    throw new Error('Too many pending auth requests');
  }

  const requestTokenUrl = `${config.usosBaseUrl}/services/oauth/request_token`;

  const requestData = {
    url: requestTokenUrl,
    method: 'POST',
    data: { oauth_callback: config.callbackUrl, scopes: 'studies|email' },
  };

  const response = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ oauth_callback: config.callbackUrl, scopes: 'studies|email' }),
  });

  if (!response.ok) throw new Error(`USOS request_token failed: ${response.status}`);

  const text = await response.text();
  const params = new URLSearchParams(text);
  const token = params.get('oauth_token')!;
  const tokenSecret = params.get('oauth_token_secret')!;

  pendingTokens.set(token, {
    secret: tokenSecret,
    state,
    expires: Date.now() + 5 * 60 * 1000, // 5 min
  });

  return {
    token,
    authorizeUrl: `${config.usosBaseUrl}/services/oauth/authorize?oauth_token=${token}`,
  };
}

// --- Access Token ---
export async function getAccessToken(
  oauthToken: string,
  oauthVerifier: string,
  expectedState: string
): Promise<{ accessToken: string; accessSecret: string }> {
  const pending = pendingTokens.get(oauthToken);
  if (!pending) throw new Error('Invalid or expired request token');
  if (pending.state !== expectedState) throw new Error('State mismatch (CSRF)');
  if (pending.expires < Date.now()) {
    pendingTokens.delete(oauthToken);
    throw new Error('Request token expired');
  }
  pendingTokens.delete(oauthToken);

  const accessTokenUrl = `${config.usosBaseUrl}/services/oauth/access_token`;
  const tokenData = { key: oauthToken, secret: pending.secret };

  const requestData = {
    url: accessTokenUrl,
    method: 'POST',
    data: { oauth_verifier: oauthVerifier },
  };

  const response = await fetch(accessTokenUrl, {
    method: 'POST',
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData, tokenData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ oauth_verifier: oauthVerifier }),
  });

  if (!response.ok) throw new Error(`USOS access_token failed: ${response.status}`);

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    accessToken: params.get('oauth_token')!,
    accessSecret: params.get('oauth_token_secret')!,
  };
}

// --- User info ---
export async function getUser(
  accessToken: string,
  accessSecret: string
): Promise<{ id: string; first_name: string; last_name: string; email: string }> {
  const userUrl = `${config.usosBaseUrl}/services/users/user?fields=id|first_name|last_name|email`;
  const tokenData = { key: accessToken, secret: accessSecret };

  const requestData = { url: userUrl, method: 'GET' };

  const response = await fetch(userUrl, {
    headers: { ...oauth.toHeader(oauth.authorize(requestData, tokenData)) },
  });

  if (!response.ok) throw new Error(`USOS user fetch failed: ${response.status}`);
  return response.json();
}
