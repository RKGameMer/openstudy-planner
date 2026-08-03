// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { APP_NAME, APP_VERSION } from './app-info'

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
})
