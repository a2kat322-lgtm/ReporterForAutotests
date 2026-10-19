import { Card, Typography } from 'antd'

const { Text } = Typography

export default function MetricCard({ label, value, note, color }) {
  return (
    <Card className="analytics-metric">
      <Text type="secondary">{label}</Text>
      <div className="analytics-metric-value" style={color ? { color } : undefined}>{value}</div>
      <Text type="secondary">{note}</Text>
    </Card>
  )
}
