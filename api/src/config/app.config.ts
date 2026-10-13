import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.API_PORT) || 3001,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  enableLegacyImport: process.env.ENABLE_LEGACY_IMPORT === 'true',
}))
