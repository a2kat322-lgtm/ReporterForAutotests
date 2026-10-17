import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)
  // JSON has no BigInt primitive. Use Number as requested for the public API.
  ;(BigInt.prototype as typeof BigInt.prototype & { toJSON?: () => number }).toJSON = function () { return Number(this) }

  // Only enable this when the API is reachable exclusively through a proxy.
  if (config.get<boolean>('app.trustProxy')) app.set('trust proxy', 1)

  app.setGlobalPrefix('api')
  // The automation system posts runs as application/x-www-form-urlencoded.
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  app.enableCors({ origin: config.get<string>('app.corsOrigin'), credentials: false })
  app.enableShutdownHooks()

  const port = config.get<number>('app.port') ?? 3001
  const host = config.get<string>('app.host')
  await (host ? app.listen(port, host) : app.listen(port))
}
bootstrap()
