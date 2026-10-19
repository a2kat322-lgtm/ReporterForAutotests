const URL_PATTERN = /https?:\/\/\S+/g
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
const HEX_PATTERN = /\b0x[0-9a-f]+\b/g
const LOCATION_PATTERN = /[a-z0-9_./\\-]+\.(?:java|kt|ts|js|py|rb|cs|go):\d+/g
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?/g
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g

/**
 * Stable fingerprint for an error message: strips ids, line numbers, URLs and
 * timings so repeated failures with different values collapse into one group.
 */
export function normalizeErrorMessage(message) {
  const value = message?.trim()
  if (!value) return '(без сообщения)'
  return value
    .toLowerCase()
    .replace(URL_PATTERN, '<url>')
    .replace(UUID_PATTERN, '<uuid>')
    .replace(HEX_PATTERN, '<hex>')
    .replace(LOCATION_PATTERN, '<location>')
    .replace(TIMESTAMP_PATTERN, '<timestamp>')
    .replace(NUMBER_PATTERN, '<n>')
    .replace(/<<n>>/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || '(без сообщения)'
}
