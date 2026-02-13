function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config = {
  usosBaseUrl: process.env.USOS_BASE_URL || 'https://apps.usos.pw.edu.pl',
  consumerKey: requireEnv('USOS_CONSUMER_KEY'),
  consumerSecret: requireEnv('USOS_CONSUMER_SECRET'),

  jwtSecret: (() => {
    const secret = requireEnv('JWT_SECRET');
    if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
    return secret;
  })(),
  jwtExpiresIn: '24h',

  callbackUrl: requireEnv('CALLBACK_URL'),
  frontendUrl: requireEnv('FRONTEND_URL'),
  port: parseInt(process.env.PORT || '3000'),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  isProduction: process.env.NODE_ENV === 'production',
  allowedFacultyId: process.env.ALLOWED_FACULTY_ID || '103000',
};
