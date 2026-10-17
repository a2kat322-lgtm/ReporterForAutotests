import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe'
import { CreateWorkspaceDto } from '../dto/create-workspace.dto'
import { WorkspacesService } from '../service/workspaces.service'

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll() { return this.workspacesService.findAll() }

  @Post()
  create(@Body() dto: CreateWorkspaceDto) { return this.workspacesService.create(dto) }

  @Get(':workspaceId')
  findById(@Param('workspaceId', ParseBigIntPipe) workspaceId: bigint) { return this.workspacesService.findById(workspaceId) }

  @Delete(':workspaceId')
  @HttpCode(200)
  delete(@Param('workspaceId', ParseBigIntPipe) workspaceId: bigint) { return this.workspacesService.delete(workspaceId) }
}
