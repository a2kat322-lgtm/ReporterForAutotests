import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateAutomatedTestDto {
  @IsString()
  @MaxLength(300)
  resultPath: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullResponsibility?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultSuiteName?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultCaseName?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultOwner?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  tags?: string[]

  /** Display flag: when false the test is hidden from report views. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() !== 'false' && value !== '0' && value.toLowerCase() !== 'n' : value))
  @IsBoolean()
  visible?: boolean
}
