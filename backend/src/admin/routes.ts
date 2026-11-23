import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../auth/jwt.js';
import { config } from '../config.js';
import { eventLogger, EventType } from './logger.js';
import { serveAdminPanel, serveAdminScript } from './panel.js';

export const adminRouter = Router();

const VALID_TYPES: EventType[] = [
  'login_success', 'login_denied_faculty', 'logout',
  'resource_access', 'error',
];

const adminLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.notes_session;
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const payload = verifyToken(token);
  // Check the live allowlist, not the JWT claim, so removing an admin takes effect immediately.
  if (!payload || !config.adminIds.includes(payload.usosId)) { res.status(403).json({ error: 'Forbidden' }); return; }

  next();
}

adminRouter.get('/admin', adminLimit, requireAdmin, (_req: Request, res: Response) => {
  serveAdminPanel(res);
});

adminRouter.get('/admin/app.js', adminLimit, requireAdmin, (_req: Request, res: Response) => {
  serveAdminScript(res);
});

adminRouter.get('/api/admin/events', adminLimit, requireAdmin, (req: Request, res: Response) => {
  const type = req.query.type as EventType | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  if (type && !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid event type' });
    return;
  }

  const events = eventLogger.getEvents({ type, limit, offset });
  res.json({ events, count: events.length, offset, limit });
});

adminRouter.get('/api/admin/stats', adminLimit, requireAdmin, (_req: Request, res: Response) => {
  res.json(eventLogger.getStats());
});

adminRouter.get('/api/admin/activity', adminLimit, requireAdmin, (req: Request, res: Response) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 6, 24);
  res.json(eventLogger.getActivity(hours));
});
