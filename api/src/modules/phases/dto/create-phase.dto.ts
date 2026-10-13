import { IsDateString, IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { Environment } from '@prisma/client'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export class CreatePhaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string

  @IsEnum(Environment)
  environment: Environment

  @IsDateString()
  @Matches(DATE_ONLY, { message: 'startedAt must be a YYYY-MM-DD date' })
  startedAt: string

  @IsDateString()
  @Matches(DATE_ONLY, { message: 'endedAt must be a YYYY-MM-DD date' })
  endedAt: string
}
