import { APP_NAME, APP_VERSION } from './app-info'
import './App.css'

export function App() {
  return (
    <main className="app-shell">
      <section className="app-placeholder" aria-labelledby="app-title">
        <p className="app-placeholder__eyebrow">MVP 项目基础结构</p>
        <h1 id="app-title">{APP_NAME}</h1>
        <p>应用基础工程已就绪，后续开发将在已确认的 MVP 范围内逐步实现。</p>
        <p className="app-placeholder__version">基础版本 {APP_VERSION}</p>
      </section>
    </main>
  )
}
