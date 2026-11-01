import { registerAs } from '@nestjs/config'
import { resolve } from 'node:path'

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
  // Where attachments extracted from allure-results archives are stored.
  // Files are content-addressed (sha256), so re-imports reuse existing bytes.
  // Keep this directory outside the repository in production and back it up.
  attachmentsDir: resolve(process.env.ATTACHMENTS_DIR || 'storage/attachments'),
  // Upper bound for one uploaded archive; the express raw parser allows the
  // same value, the service re-checks it before parsing.
  allureImportMaxBytes: Number(process.env.ALLURE_IMPORT_MAX_BYTES) || 512 * 1024 * 1024,
}))
