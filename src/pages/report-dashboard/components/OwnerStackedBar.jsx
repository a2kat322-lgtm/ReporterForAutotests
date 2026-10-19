import { StackedBarChart } from '../../../components/charts'
import { STATUS_SERIES } from '../constants'

export default function OwnerStackedBar({ data }) {
  return (
    <StackedBarChart
      rows={data}
      labelKey="owner"
      seriesKey="status"
      valueKey="count"
      series={STATUS_SERIES}
      height={260}
      horizontal
      normalize
    />
  )
}
