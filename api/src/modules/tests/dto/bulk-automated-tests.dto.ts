import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator'
import { CreateAutomatedTestDto } from './create-automated-test.dto'

export class BulkAutomatedTestsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CreateAutomatedTestDto)
  tests: CreateAutomatedTestDto[]
}
