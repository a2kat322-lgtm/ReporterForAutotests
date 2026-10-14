import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  // JSON has no BigInt primitive. Use Number as requested for the public API.
  ;(BigInt.prototype as typeof BigInt.prototype & { toJSON?: () => number }).toJSON = function () { return Number(this) }

  app.setGlobalPrefix('api')
  // The automation system posts runs as application/x-www-form-urlencoded.
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  app.enableCors({ origin: config.get<string>('app.corsOrigin'), credentials: false })
  app.enableShutdownHooks()

  await app.listen(config.get<number>('app.port') ?? 3001)
}
bootstrap()
