import { DatePicker, Form, Input, Modal } from 'antd'
import ruRU from 'antd/locale/ru_RU'

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
    <Modal title="Создать тестовую фазу" open={open} onCancel={onCancel} onOk={submit} okText="Создать фазу" destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Название фазы" rules={[{ required: true, message: 'Введите название фазы' }]}>
          <Input placeholder="например, Релиз 2.5.0" />
        </Form.Item>
        <Form.Item name="environment" label="Окружение" rules={[{ required: true, message: 'Введите окружение' }]}>
          <Input placeholder="например, dso" />
        </Form.Item>
        <Form.Item
          name="period"
          label="Период тестирования"
          rules={[
            { required: true, message: 'Выберите период тестирования' },
            { validator: (_, value) => (value?.[1]?.isBefore(value?.[0], 'day') ? Promise.reject(new Error('Дата окончания не может быть раньше даты начала')) : Promise.resolve()) },
          ]}
        >
          <DatePicker.RangePicker className="full-width" locale={ruRU.DatePicker} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
