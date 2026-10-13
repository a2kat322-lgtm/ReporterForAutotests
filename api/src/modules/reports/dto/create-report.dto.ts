import { IsDateString, IsString, Matches, MinLength } from 'class-validator'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  name: string

  @IsDateString()
  @Matches(DATE_ONLY, { message: 'startDate must be a YYYY-MM-DD date' })
  startDate: string

  @IsDateString()
  @Matches(DATE_ONLY, { message: 'endDate must be a YYYY-MM-DD date' })
  endDate: string
}
