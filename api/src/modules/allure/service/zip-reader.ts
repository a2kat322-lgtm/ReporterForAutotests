import { inflateRawSync } from 'node:zlib'

/**
 * Minimal ZIP reader for `allure-results` archives.
 *
 * Allure writes a flat directory of small JSON files and attachments, so a full
 * ZIP64 implementation is unnecessary. Keeping the reader in-tree avoids adding
 * an archive dependency to the API and keeps the import path auditable:
 *   - supports stored (0) and deflate (8) entries, the only ones `zip`,
 *     `Compress-Archive` and `jar` produce for these files;
 *   - refuses ZIP64 and oversized entries instead of silently truncating.
 */

export interface ZipEntry {
  name: string
  data: Buffer
}

export class ZipFormatError extends Error {}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const LOCAL_FILE_SIGNATURE = 0x04034b50

const MAX_ENTRIES = 200_000
const MAX_ENTRY_BYTES = 100 * 1024 * 1024
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The EOCD record is 22 bytes plus an archive comment of at most 64 KiB.
  const minimum = 22
  const searchStart = Math.max(0, buffer.length - minimum - 0xffff)
  for (let offset = buffer.length - minimum; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset
  }
  return -1
}

/** Reads every file entry of a ZIP archive into memory. */
export function readZip(buffer: Buffer): ZipEntry[] {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new ZipFormatError('Not a ZIP archive: the body is too small')
  }

  const eocd = findEndOfCentralDirectory(buffer)
  if (eocd < 0) {
    throw new ZipFormatError('Not a ZIP archive: end of central directory not found')
  }

  const entryCount = buffer.readUInt16LE(eocd + 10)
  const directorySize = buffer.readUInt32LE(eocd + 12)
  const directoryOffset = buffer.readUInt32LE(eocd + 16)

  if (entryCount === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw new ZipFormatError('ZIP64 archives are not supported; re-create the archive without ZIP64')
  }
  if (entryCount > MAX_ENTRIES) {
    throw new ZipFormatError(`Archive has too many entries (${entryCount} > ${MAX_ENTRIES})`)
  }
  if (directoryOffset + directorySize > buffer.length) {
    throw new ZipFormatError('Corrupted ZIP archive: central directory is out of bounds')
  }

  const entries: ZipEntry[] = []
  let totalBytes = 0
  let offset = directoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new ZipFormatError('Corrupted ZIP archive: bad central directory entry')
    }

    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength

    if (!name || name.endsWith('/')) continue
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new ZipFormatError('ZIP64 entries are not supported')
    }
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new ZipFormatError(`ZIP entry is too large: ${name}`)
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new ZipFormatError(`Corrupted ZIP archive: bad local header for ${name}`)
    }

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) {
      throw new ZipFormatError(`Corrupted ZIP archive: truncated data for ${name}`)
    }

    const raw = buffer.subarray(dataStart, dataEnd)
    let data: Buffer
    if (compressedSize === 0) {
      data = Buffer.alloc(0)
    } else if (method === 0) {
      data = Buffer.from(raw)
    } else if (method === 8) {
      try {
        data = inflateRawSync(raw)
      } catch {
        throw new ZipFormatError(`Cannot inflate ZIP entry: ${name}`)
      }
    } else {
      throw new ZipFormatError(`Unsupported ZIP compression method ${method} for ${name}`)
    }

    if (data.length > MAX_ENTRY_BYTES) {
      throw new ZipFormatError(`ZIP entry expands beyond the limit: ${name}`)
    }
    totalBytes += data.length
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new ZipFormatError('Archive expands to more than 1 GiB')
    }

    entries.push({ name, data })
  }

  return entries
}
