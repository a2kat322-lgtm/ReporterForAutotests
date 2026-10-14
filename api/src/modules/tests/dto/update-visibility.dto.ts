import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsString, MaxLength } from 'class-validator'
import { Transform } from 'class-transformer'

export class UpdateVisibilityDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  resultPaths: string[]

  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() !== 'false' && value !== '0' && value.toLowerCase() !== 'n' : value))
  @IsBoolean()
  visible: boolean
}
