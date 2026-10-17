import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string | undefined, bigint | undefined> {
  transform(value: string | undefined): bigint | undefined {
    if (value == null || value === '') return undefined
    if (!/^\d+$/.test(value)) throw new BadRequestException('Validation failed (numeric string is expected)')
    try {
      return BigInt(value)
    } catch {
      throw new BadRequestException('Validation failed (numeric string is expected)')
    }
  }
}
