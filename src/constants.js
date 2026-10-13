export const envColors = { test: 'blue', stage: 'purple', production: 'green' }

export const environmentOptions = ['test', 'stage', 'production'].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}))
