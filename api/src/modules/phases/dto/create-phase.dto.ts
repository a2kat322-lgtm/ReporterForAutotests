import { IsDateString, IsString, Matches, MaxLength, MinLength } from 'class-validator'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export class CreatePhaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  environment: string

  @IsDateString()
  @Matches(DATE_ONLY, { message: 'startedAt must be a YYYY-MM-DD date' })
  startedAt: string

  @IsDateString()
  @Matches(DATE_ONLY, { message: 'endedAt must be a YYYY-MM-DD date' })
  endedAt: string
}
