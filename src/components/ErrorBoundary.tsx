import { Component, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="app-placeholder" aria-labelledby="error-title">
            <p className="app-placeholder__eyebrow">应用出现错误</p>
            <h1 id="error-title">请刷新页面后重试</h1>
            <p>当前基础版本未上传任何任务内容或错误信息。</p>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
