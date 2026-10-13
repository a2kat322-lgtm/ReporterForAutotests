import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common'
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
  findById(@Param('phaseId', ParseIntPipe) phaseId: number) { return this.phasesService.findById(phaseId) }

  @Delete(':phaseId')
  @HttpCode(200)
  delete(@Param('phaseId', ParseIntPipe) phaseId: number) { return this.phasesService.delete(phaseId) }
}
