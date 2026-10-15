import { Button, DatePicker, Form, Modal, Space, Typography } from 'antd'
import { ImportOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography

export default function HarvestModal({ open, form, environment, onClose, onHarvest, harvesting }) {
  return (
    <Modal
      title="Harvest tests from runs"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Paragraph type="secondary">
        Choose the run date range. Distinct test paths found in overlapping runs will be added to the catalog.
        {environment ? <> Only runs whose <Text code>Circuit</Text> matches this phase's environment (<Text code>{environment}</Text>) are harvested.</> : null}
      </Paragraph>
      <Form form={form} layout="vertical" onFinish={onHarvest}>
        <Form.Item
          name="harvestPeriod"
          label="Run date range"
          rules={[{ required: true, message: 'Choose the run date range to harvest' }]}
        >
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            aria-label="Run date range for harvesting tests"
            placeholder={['From date', 'To date']}
          />
        </Form.Item>
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" icon={<ImportOutlined />} loading={harvesting}>Start harvest</Button>
        </Space>
      </Form>
    </Modal>
  )
}
