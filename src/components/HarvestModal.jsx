import { Button, DatePicker, Form, Modal, Space, Typography } from 'antd'
import { ImportOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography

export default function HarvestModal({ open, form, environment, onClose, onHarvest, harvesting }) {
  return (
    <Modal
      title="Собрать тесты из запусков"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Paragraph type="secondary">
        Выберите диапазон дат запуска. Уникальные пути тестов, найденные в пересекающихся запусках, будут добавлены в каталог.
        {environment ? <> Собираются только запуски, у которых <Text code>Circuit</Text> совпадает с окружением этой фазы (<Text code>{environment}</Text>).</> : null}
      </Paragraph>
      <Form form={form} layout="vertical" onFinish={onHarvest}>
        <Form.Item
          name="harvestPeriod"
          label="Диапазон дат запуска"
          rules={[{ required: true, message: 'Выберите диапазон дат запуска для сбора' }]}
        >
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            aria-label="Диапазон дат запуска для сбора тестов"
            placeholder={['Дата начала', 'Дата окончания']}
          />
        </Form.Item>
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" htmlType="submit" icon={<ImportOutlined />} loading={harvesting}>Начать сбор</Button>
        </Space>
      </Form>
    </Modal>
  )
}
