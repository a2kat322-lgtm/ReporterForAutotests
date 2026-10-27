import { Component } from 'react'
import { Alert, Button, Space, Typography } from 'antd'

const { Paragraph } = Typography

/**
 * Catches render and lazy-import errors of the active route so one broken
 * section does not blank the whole app. Remount it with a `key` per route to
 * clear the error when the user navigates away.
 *
 * The fallback intentionally uses `Alert` instead of `Result`: every antd
 * component that is not used anywhere else ends up in the eagerly loaded
 * vendor chunk.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleRetry = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Alert
        type="error"
        showIcon
        message="Раздел не удалось отобразить"
        description={(
          <>
            <Paragraph type="secondary" style={{ marginBottom: 12 }}>
              {error.message || 'Непредвиденная ошибка интерфейса. Технические подробности — в консоли браузера.'}
            </Paragraph>
            <Space wrap>
              <Button type="primary" onClick={this.handleRetry}>Попробовать снова</Button>
              <Button onClick={() => window.location.reload()}>Перезагрузить страницу</Button>
            </Space>
          </>
        )}
      />
    )
  }
}
