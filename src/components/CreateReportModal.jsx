import { DatePicker, Form, Input, Modal } from 'antd'

export default function CreateReportModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm()

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // keep the modal open so the user can fix validation errors
    }
    const created = await onCreate({
      name: values.name,
      startDate: values.period[0].format('YYYY-MM-DD'),
      endDate: values.period[1].format('YYYY-MM-DD'),
    })
    if (created) form.resetFields()
  }

  return (
    <Modal title="Create report" open={open} onCancel={onCancel} onOk={submit} okText="Create report" destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Report name" rules={[{ required: true, message: 'Enter a report name' }]}>
          <Input placeholder="e.g. Regression run" />
        </Form.Item>
        <Form.Item
          name="period"
          label="Test results period"
          rules={[
            { required: true, message: 'Choose the test results period' },
            { validator: (_, value) => (value?.[1]?.isBefore(value?.[0], 'day') ? Promise.reject(new Error('End date cannot be before start date')) : Promise.resolve()) },
          ]}
        >
          <DatePicker.RangePicker className="full-width" />
        </Form.Item>
        <div className="form-hint">Automated test runs overlapping this period will appear in the report.</div>
      </Form>
    </Modal>
  )
}
