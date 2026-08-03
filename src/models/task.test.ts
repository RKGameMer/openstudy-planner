import { describe, expect, it } from 'vitest'
import {
  createTask,
  isPositiveIntegerMinutes,
  isStudyFormat,
  isTask,
  isTaskStatus,
  isTaskSubject,
  isValidLocalDate,
  STUDY_FORMATS,
  TASK_DATA_FORMAT_VERSION,
  TASK_STATUSES,
  TASK_SUBJECTS,
  type CreateTaskDependencies,
} from './task'

const FIXED_ID = '4f5a1e22-7e29-4eea-987c-d7c5a54d7375'
const FIXED_TIMESTAMP = '2026-08-03T10:20:30.000Z'

function createTestDependencies(): CreateTaskDependencies {
  return {
    createId: () => FIXED_ID,
    now: () => new Date(FIXED_TIMESTAMP),
  }
}

describe('createTask', () => {
  it('creates a task when only its name is provided', () => {
    const task = createTask({ name: '完成数学函数练习' }, createTestDependencies())

    expect(task).toMatchObject({
      dataFormatVersion: TASK_DATA_FORMAT_VERSION,
      id: FIXED_ID,
      name: '完成数学函数练习',
      status: '待处理',
      subject: null,
      studyFormat: null,
      contentScope: null,
      nextStep: null,
      completionCriteria: null,
      plannedDate: null,
      todayPriorityDate: null,
      notes: null,
      actualDurationMinutes: null,
      actualCompletion: null,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    })
    expect(isTask(task)).toBe(true)
  })

  it('trims whitespace around a task name', () => {
    const task = createTask({ name: '  背诵英语词组  ' }, createTestDependencies())

    expect(task.name).toBe('背诵英语词组')
  })

  it.each(['', '   ', '\n\t'])('rejects a blank task name: %j', (name) => {
    expect(() => createTask({ name }, createTestDependencies())).toThrow('任务名称不能为空。')
  })

  it('generates a UUID and initial timestamps by default', () => {
    const firstTask = createTask({ name: '语文现代文阅读' })
    const secondTask = createTask({ name: '英语语法复习' })

    expect(firstTask.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(firstTask.id).not.toBe(secondTask.id)
    expect(firstTask.createdAt).toBe(firstTask.updatedAt)
    expect(new Date(firstTask.createdAt).toISOString()).toBe(firstTask.createdAt)
  })

  it('accepts every optional field when it has a valid value', () => {
    const task = createTask(
      {
        name: '完成函数练习第 1—5 题',
        subject: '数学',
        studyFormat: '刷题',
        contentScope: '函数练习第 1—5 题',
        nextStep: '先完成第 1 题',
        completionCriteria: '独立完成 5 题并订正',
        plannedDate: '2026-08-04',
        todayPriorityDate: '2026-08-03',
        notes: '先复习定义域。',
        actualDurationMinutes: 45,
        actualCompletion: '完成 5 题，订正 2 题。',
      },
      createTestDependencies(),
    )

    expect(task).toMatchObject({
      subject: '数学',
      studyFormat: '刷题',
      plannedDate: '2026-08-04',
      todayPriorityDate: '2026-08-03',
      actualDurationMinutes: 45,
    })
  })
})

describe('task enumerations', () => {
  it('contains only the supported subjects', () => {
    expect(TASK_SUBJECTS).toEqual(['语文', '数学', '英语', '其他'])
    expect(isTaskSubject('物理')).toBe(false)
  })

  it('contains only the supported study formats', () => {
    expect(STUDY_FORMATS).toEqual(['录播课', '直播课', '自学', '刷题', '复习', '测试', '其他'])
    expect(isStudyFormat('讲座')).toBe(false)
  })

  it('contains only the supported statuses and excludes postponement', () => {
    expect(TASK_STATUSES).toEqual(['待处理', '进行中', '部分完成', '已完成', '已移除'])
    expect(isTaskStatus('延期')).toBe(false)
  })
})

describe('task field validation', () => {
  it('accepts a positive integer duration or an empty value', () => {
    expect(isPositiveIntegerMinutes(1)).toBe(true)
    expect(isPositiveIntegerMinutes(60)).toBe(true)
    expect(createTask({ name: '整理错题', actualDurationMinutes: null }, createTestDependencies()))
      .toMatchObject({ actualDurationMinutes: null })
  })

  it.each([0, -1, 1.5])('rejects an invalid actual duration: %j', (duration) => {
    expect(isPositiveIntegerMinutes(duration)).toBe(false)
    expect(() =>
      createTask({ name: '整理错题', actualDurationMinutes: duration }, createTestDependencies()),
    ).toThrow('实际用时必须是正整数分钟或为空。')
  })

  it('accepts only valid YYYY-MM-DD local calendar dates', () => {
    expect(isValidLocalDate('2026-08-03')).toBe(true)
    expect(isValidLocalDate('2024-02-29')).toBe(true)
    expect(isValidLocalDate('2026-2-3')).toBe(false)
    expect(isValidLocalDate('2026-02-29')).toBe(false)
    expect(isValidLocalDate('2026-13-01')).toBe(false)
    expect(isValidLocalDate('2026-04-31')).toBe(false)
  })

  it('rejects invalid task date fields', () => {
    expect(() => createTask({ name: '复习词组', plannedDate: '2026-02-29' }, createTestDependencies())).toThrow(
      '计划日期必须是有效的 YYYY-MM-DD 日期。',
    )
    expect(() =>
      createTask({ name: '复习词组', todayPriorityDate: '2026-2-3' }, createTestDependencies()),
    ).toThrow('今日重点日期必须是有效的 YYYY-MM-DD 日期。')
  })
})
