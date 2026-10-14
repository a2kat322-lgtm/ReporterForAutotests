import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateResultFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  failureReason?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  failureComment?: string | null
}
