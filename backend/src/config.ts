function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config = {
  usosBaseUrl: process.env.USOS_BASE_URL || 'https://apps.usos.pw.edu.pl',
  consumerKey: requireEnv('USOS_CONSUMER_KEY'),
  consumerSecret: requireEnv('USOS_CONSUMER_SECRET'),

  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: '24h',

  callbackUrl: requireEnv('CALLBACK_URL'),
  frontendUrl: requireEnv('FRONTEND_URL'),
  port: parseInt(process.env.PORT || '3000'),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  isProduction: process.env.NODE_ENV === 'production',
};
