// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTaskDataAccess, type StorageLike } from '../data'
import { createTask } from '../models'
import { App } from './App'
import { APP_NAME, APP_VERSION } from './app-info'

class InMemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

class FailingWriteStorage extends InMemoryStorage {
  setItem(_key: string, _value: string): void {
    throw new Error('simulated write failure')
  }
}

const FIXED_ID = '4f5a1e22-7e29-4eea-987c-d7c5a54d7375'
const FIXED_TIMESTAMP = '2026-08-03T10:20:30.000Z'

function createStoredTask(name: string, options: { priorityDate?: string | null } = {}) {
  return createTask(
    { name, todayPriorityDate: options.priorityDate ?? null },
    { createId: () => FIXED_ID, now: () => new Date(FIXED_TIMESTAMP) },
  )
}

describe('application navigation shell', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  afterEach(() => {
    cleanup()
  })

  it('defaults to Today and exposes exactly the three confirmed primary entries', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '今日' })).toBeDefined()

    const navigation = screen.getByRole('navigation', { name: '主导航' })
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '今日',
      '任务库',
      '数据与说明',
    ])
    expect(within(navigation).getByRole('link', { name: '今日' }).getAttribute('aria-current')).toBe('page')
  })

  it('navigates to the task library and data information pages with an active item', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: '任务库' }))
    expect(screen.getByRole('heading', { name: '任务库' })).toBeDefined()
    expect(screen.getByRole('link', { name: '任务库' }).getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('link', { name: '数据与说明' }))
    expect(screen.getByRole('heading', { name: '数据与说明' })).toBeDefined()
    expect(screen.getByRole('link', { name: '数据与说明' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects an invalid hash route to Today', async () => {
    window.location.hash = '#/not-a-page'

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日' })).toBeDefined()
    })
    expect(window.location.hash).toBe('#/')
  })

  it('parses the current hash route after a remount', () => {
    window.location.hash = '#/tasks'
    const firstMount = render(<App />)

    expect(screen.getByRole('heading', { name: '任务库' })).toBeDefined()

    firstMount.unmount()
    render(<App />)

    expect(screen.getByRole('heading', { name: '任务库' })).toBeDefined()
  })

  it('keeps the application identity information available', () => {
    expect(App).toBeTypeOf('function')
    expect(APP_NAME).toBe('OpenStudy Planner')
    expect(APP_VERSION).toBe('0.1.0')
  })

  it('requires confirmation before permanent deletion and leaves data unchanged after cancellation', async () => {
    window.location.hash = '#/tasks'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('需要确认的任务')
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByText('更多操作'))
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))

    expect(dataAccess.getTaskById(task.id)).not.toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('does not show success when a storage write fails and keeps quick-create input', async () => {
    window.location.hash = '#/'
    const dataAccess = createTaskDataAccess({ storage: new FailingWriteStorage() })
    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    const input = await screen.findByPlaceholderText('写下下一件需要完成的事')
    fireEvent.change(input, { target: { value: '写入失败任务' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    expect((input as HTMLInputElement).value).toBe('写入失败任务')
    expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('任务没有保存成功。'))).toBe(true)
    expect(screen.queryByText('任务已创建并加入今日重点')).toBeNull()
  })

  it('shows a non-blocking notice for unresolved past priorities without changing the task', async () => {
    window.location.hash = '#/'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('昨天的重点', { priorityDate: '2026-08-02' })
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    expect(await screen.findByText('有 1 项过往重点仍未处理')).toBeDefined()
    expect(dataAccess.getTaskById(task.id)).toMatchObject({ status: '待处理', todayPriorityDate: '2026-08-02' })
  })

  it('does not move a past priority to today when it is edited without changing its priority option', async () => {
    window.location.hash = '#/tasks'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('过往重点任务', { priorityDate: '2026-08-02' })
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByRole('button', { name: '过往重点任务' }))
    fireEvent.change(screen.getByLabelText(/任务名称/), { target: { value: '已编辑的过往重点' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(dataAccess.getTaskById(task.id)).toMatchObject({
        name: '已编辑的过往重点',
        todayPriorityDate: '2026-08-02',
      })
    })
  })
})
