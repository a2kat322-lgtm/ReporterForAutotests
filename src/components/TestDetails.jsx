import { Alert, Collapse, Typography } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { formatDuration } from '../utils/format'

const { Text } = Typography

function StepNumber({ step, index }) {
  const className = `step-number ${step.status}`
  if (step.status === 'passed') return <span className={className}><CheckOutlined /></span>
  if (step.status === 'failed') return <span className={className}>!</span>
  return <span className={className}>{index + 1}</span>
}

export default function TestDetails({ test }) {
  const items = test.steps.map((step, index) => ({
    key: String(index),
    label: (
      <div className="step-label">
        <StepNumber step={step} index={index} />
        <Text>{step.name}</Text>
        <Text type="secondary" className="step-duration">{formatDuration(step.duration)}</Text>
      </div>
    ),
    children: (
      <div className="step-detail">
        {step.error ? <Alert type="error" showIcon message={step.error} /> : null}
        {step.output ? <pre>{step.output}</pre> : null}
        {!step.error && !step.output ? <Text type="secondary">No additional output</Text> : null}
      </div>
    ),
  }))
  return <Collapse ghost items={items} />
}
