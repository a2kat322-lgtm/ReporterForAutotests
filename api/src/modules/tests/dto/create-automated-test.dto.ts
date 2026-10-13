import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateAutomatedTestDto {
  @IsString()
  @MaxLength(300)
  resultPath: string

  @IsString()
  @MaxLength(300)
  display: string

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
}
