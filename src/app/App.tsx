import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { DataInfoPage } from '../pages/DataInfoPage'
import { TaskLibraryPage } from '../pages/TaskLibraryPage'
import { TodayPage } from '../pages/TodayPage'
import './App.css'

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="tasks" element={<TaskLibraryPage />} />
          <Route path="data-info" element={<DataInfoPage />} />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </HashRouter>
  )
}
