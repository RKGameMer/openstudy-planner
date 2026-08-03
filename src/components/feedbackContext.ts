import { createContext, useContext } from 'react'

export interface ConfirmationRequest {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
}

export interface FeedbackContextValue {
  showSuccess(text: string): void
  showError(text: string, retry?: () => void): void
  requestConfirmation(request: ConfirmationRequest): void
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext)
  if (context === null) {
    throw new Error('useFeedback 必须在 FeedbackProvider 内使用。')
  }

  return context
}
