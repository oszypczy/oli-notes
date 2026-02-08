import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface TokenPayload {
  usosId: string;
  name: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as TokenPayload;
  } catch {
    return null;
  }
}
