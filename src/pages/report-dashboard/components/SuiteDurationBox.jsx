import { useMemo } from 'react'
import { Card, Typography } from 'antd'
import { DurationProfile } from '../../../components/charts'

const { Text } = Typography

export default function SuiteDurationBox({ data }) {
  const groups = useMemo(() => {
    const map = new Map()
    for (const item of data) {
      const values = map.get(item.suite) || []
      values.push(item.duration)
      map.set(item.suite, values)
    }
    return [...map.entries()].map(([label, values]) => ({ label, values }))
  }, [data])

  return (
    <Card title="Разброс длительности по наборам" className="analytics-card" extra={<Text type="secondary">p90 и медиана, секунды</Text>}>
      <DurationProfile groups={groups} height={300} />
    </Card>
  )
}
