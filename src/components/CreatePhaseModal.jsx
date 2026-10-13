import { DatePicker, Form, Input, Modal, Select } from 'antd'
import { environmentOptions } from '../constants'

export default function CreatePhaseModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm()

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // keep the modal open so the user can fix validation errors
    }
    const { period, ...rest } = values
    await onCreate({
      ...rest,
      startedAt: period[0].format('YYYY-MM-DD'),
      endedAt: period[1].format('YYYY-MM-DD'),
    })
    form.resetFields()
  }

  return (
    <Modal title="Create test phase" open={open} onCancel={onCancel} onOk={submit} okText="Create phase" destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Phase name" rules={[{ required: true, message: 'Enter a phase name' }]}>
          <Input placeholder="e.g. Release 2.5.0" />
        </Form.Item>
        <Form.Item name="environment" label="Environment" rules={[{ required: true, message: 'Select an environment' }]}>
          <Select options={environmentOptions} placeholder="Select environment" />
        </Form.Item>
        <Form.Item
          name="period"
          label="Testing period"
          rules={[
            { required: true, message: 'Choose the testing period' },
            { validator: (_, value) => (value?.[1]?.isBefore(value?.[0], 'day') ? Promise.reject(new Error('End date cannot be before start date')) : Promise.resolve()) },
          ]}
        >
          <DatePicker.RangePicker className="full-width" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
