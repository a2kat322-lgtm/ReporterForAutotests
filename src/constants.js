export const envColors = { test: 'blue', stage: 'purple', production: 'green' }

export const environmentOptions = ['test', 'stage', 'production'].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}))

// Where an allure-results launch was executed (`AllureLaunch.origin`).
export const runOriginMeta = {
  ci: { label: 'CI/CD', color: 'green' },
  local: { label: 'Локальный', color: 'purple' },
  unknown: { label: 'Неизвестно', color: 'default' },
}

export const runOriginOptions = Object.entries(runOriginMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}))
