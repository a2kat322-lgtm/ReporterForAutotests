import { DatePicker, Form, Input, Modal } from 'antd'
import ruRU from 'antd/locale/ru_RU'

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
    <Modal title="Создать отчёт" open={open} onCancel={onCancel} onOk={submit} okText="Создать отчёт" destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Название отчёта" rules={[{ required: true, message: 'Введите название отчёта' }]}>
          <Input placeholder="например, Регрессионный прогон" />
        </Form.Item>
        <Form.Item
          name="period"
          label="Период результатов тестов"
          rules={[
            { required: true, message: 'Выберите период результатов тестов' },
            { validator: (_, value) => (value?.[1]?.isBefore(value?.[0], 'day') ? Promise.reject(new Error('Дата окончания не может быть раньше даты начала')) : Promise.resolve()) },
          ]}
        >
          <DatePicker.RangePicker className="full-width" locale={ruRU.DatePicker} />
        </Form.Item>
        <div className="form-hint">Автоматические запуски тестов, пересекающиеся с этим периодом, попадут в отчёт.</div>
      </Form>
    </Modal>
  )
}
