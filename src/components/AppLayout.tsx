import { Outlet } from 'react-router-dom'
import { APP_NAME } from '../app/app-info'
import { PrimaryNavigation } from './PrimaryNavigation'

export function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-layout__header">
        <div className="app-layout__brand">
          <p className="app-layout__brand-name">{APP_NAME}</p>
        </div>
        <PrimaryNavigation />
      </header>
      <main className="app-layout__content">
        <Outlet />
      </main>
    </div>
  )
}
