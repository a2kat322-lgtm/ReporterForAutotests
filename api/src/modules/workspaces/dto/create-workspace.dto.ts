import { IsString, Matches, MaxLength, MinLength } from 'class-validator'

const NAME = /^[a-z0-9][a-z0-9 ._\-]*$/

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(NAME, { message: 'name must contain only letters, digits, spaces and . _ -' })
  name: string
}
