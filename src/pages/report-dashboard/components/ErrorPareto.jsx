import { ParetoChart } from '../../../components/charts'

export default function ErrorPareto({ data }) {
  const chartData = data.map((row, index) => ({ ...row, index: index + 1 }))
  return <ParetoChart rows={chartData} height={220} />
}
