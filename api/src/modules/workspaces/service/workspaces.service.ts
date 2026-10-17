import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { CreateWorkspaceDto } from '../dto/create-workspace.dto'
import { WorkspacesRepository } from '../repository/workspaces.repository'

@Injectable()
export class WorkspacesService {
  constructor(private readonly workspacesRepository: WorkspacesRepository) {}

  findAll() {
    return this.workspacesRepository.findAll()
  }

  async findById(id: bigint) {
    const workspace = await this.workspacesRepository.findById(id)
    if (!workspace) throw new NotFoundException('Workspace not found')
    return workspace
  }

  create(dto: CreateWorkspaceDto) {
    return this.workspacesRepository.create(this.canonicalName(dto.name))
  }

  /** Canonical form used across the app: lowercase + trimmed. */
  canonicalName(name: string) {
    return name.trim().toLowerCase()
  }

  /**
   * Resolve a workspace by canonical name, creating it on first use (the
   * automation system may post runs for a project that has no workspace yet).
   */
  async findOrCreateByName(name: string) {
    const canonical = this.canonicalName(name)
    const existing = await this.workspacesRepository.findByName(canonical)
    if (existing) return existing
    try {
      return await this.workspacesRepository.create(canonical)
    } catch (error) {
      // P2002: unique violation — a concurrent ingest created it first.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.workspacesRepository.findByName(canonical)
        if (winner) return winner
      }
      throw error
    }
  }

  async delete(id: bigint) {
    try {
      await this.workspacesRepository.delete(id)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Workspace not found')
      }
      throw error
    }
    return { deleted: true, id }
  }
}
