import { describe, expect, it } from 'vitest'
import { App } from './App'
import { APP_NAME, APP_VERSION } from './app-info'

describe('application foundation', () => {
  it('exports a renderable application shell and version information', () => {
    expect(App).toBeTypeOf('function')
    expect(APP_NAME).toBe('OpenStudy Planner')
    expect(APP_VERSION).toBe('0.1.0')
  })
})
