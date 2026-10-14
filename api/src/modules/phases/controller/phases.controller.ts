import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { CreatePhaseDto } from '../dto/create-phase.dto'
import { PhasesService } from '../service/phases.service'

@Controller('phases')
export class PhasesController {
  constructor(private readonly phasesService: PhasesService) {}

  @Get()
  findAll() { return this.phasesService.findAll() }

  @Post()
  create(@Body() dto: CreatePhaseDto) { return this.phasesService.create(dto) }

  @Get(':phaseId')
  findById(@Param('phaseId', ParseBigIntPipe) phaseId: bigint) { return this.phasesService.findById(phaseId) }

  @Delete(':phaseId')
  @HttpCode(200)
  delete(@Param('phaseId', ParseBigIntPipe) phaseId: bigint) { return this.phasesService.delete(phaseId) }
}
