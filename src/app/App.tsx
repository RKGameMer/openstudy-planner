import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { FeedbackProvider } from '../components/FeedbackProvider'
import { DataInfoPage } from '../pages/DataInfoPage'
import { TaskLibraryPage } from '../pages/TaskLibraryPage'
import { TodayPage } from '../pages/TodayPage'
import type { TaskDataAccess } from '../data'
import { TaskProvider } from './TaskContext'
import './App.css'

export function App({ dataAccess, getToday }: { dataAccess?: TaskDataAccess; getToday?: () => string } = {}) {
  return (
    <TaskProvider dataAccess={dataAccess} getToday={getToday}>
      <FeedbackProvider>
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
      </FeedbackProvider>
    </TaskProvider>
  )
}
