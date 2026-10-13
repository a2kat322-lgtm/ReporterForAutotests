import { Typography } from 'antd'

const { Title, Text, Paragraph } = Typography

export default function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <Text className="eyebrow">{eyebrow}</Text>
        <Title level={1}>{title}</Title>
        {description ? <Paragraph type="secondary">{description}</Paragraph> : null}
      </div>
      {action}
    </div>
  )
}
