import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.API_PORT) || 3001,
  // Optional explicit bind address. Set API_HOST=127.0.0.1 in production so the
  // API is reachable only through the reverse proxy.
  host: process.env.API_HOST || undefined,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  enableLegacyImport: process.env.ENABLE_LEGACY_IMPORT === 'true',
  // Behind a reverse proxy (Nginx, load balancer) Express must trust exactly one
  // hop so `req.ip` / the throttler see the client address from X-Forwarded-For.
  trustProxy: process.env.TRUST_PROXY === 'true',
}))
