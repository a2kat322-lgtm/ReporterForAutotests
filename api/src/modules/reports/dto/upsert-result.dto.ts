import { Type } from 'class-transformer'
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator'
import { TestStatus } from '@prisma/client'

export class StepDto {
  @IsString() @MaxLength(300) name: string
  @IsString() status: string
  @IsInt() @Min(0) duration: number
  @IsOptional() @IsString() output?: string
  @IsOptional() @IsString() error?: string
}

export class UpsertResultDto {
  @IsInt() @Min(1) phaseId: number
  @IsString() @MinLength(1) @MaxLength(200) automatedTestId: string
  @IsString() @MinLength(1) @MaxLength(300) name: string
  @IsEnum(TestStatus) status: TestStatus
  @IsInt() @Min(0) duration: number
  @IsOptional() @IsDateString() lastRunAt?: string
  @IsOptional() @IsString() errorMessage?: string
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => StepDto) steps?: StepDto[]
}
