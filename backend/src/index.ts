import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './auth/routes.js';
import { adminRouter } from './admin/routes.js';
import { config } from './config.js';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());

app.set('trust proxy', 1);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(authRouter);
app.use(adminRouter);

app.get('/health', (_req, res) => res.sendStatus(200));

app.listen(config.port, () => {
  console.log(`Auth server running on port ${config.port}`);
});
