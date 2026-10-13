import { Form, Input, Modal } from 'antd'

export default function CreateReportModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm()

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // keep the modal open so the user can fix validation errors
    }
    await onCreate({ name: values.name })
    form.resetFields()
  }

  return (
    <Modal title="Create report" open={open} onCancel={onCancel} onOk={submit} okText="Create report" destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Report name" rules={[{ required: true, message: 'Enter a report name' }]}>
          <Input placeholder="e.g. Regression run" />
        </Form.Item>
        <div className="form-hint">The report will be created for the current phase with today's date.</div>
      </Form>
    </Modal>
  )
}
