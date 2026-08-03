import { useMemo, useState, type ReactNode } from 'react'
import { FeedbackContext, type ConfirmationRequest, type FeedbackContextValue } from './feedbackContext'

type FeedbackMessage = {
  kind: 'success' | 'error'
  text: string
  retry?: () => void
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<FeedbackMessage | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null)

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showSuccess(text) {
        setMessage({ kind: 'success', text })
      },
      showError(text, retry) {
        setMessage({ kind: 'error', text, retry })
      },
      requestConfirmation(request) {
        setConfirmation(request)
      },
    }),
    [],
  )

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {message !== null && (
        <div className={`feedback feedback--${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          <span>{message.text}</span>
          {message.retry !== undefined && (
            <button
              className="button button--quiet"
              onClick={() => message.retry?.()}
              type="button"
            >
              重试
            </button>
          )}
          <button aria-label="关闭提示" className="feedback__close" onClick={() => setMessage(null)} type="button">
            关闭
          </button>
        </div>
      )}
      {confirmation !== null && (
        <div aria-labelledby="confirmation-title" className="confirmation-backdrop" role="presentation">
          <section aria-describedby="confirmation-description" aria-modal="true" className="confirmation" role="alertdialog">
            <h2 id="confirmation-title">{confirmation.title}</h2>
            <p id="confirmation-description">{confirmation.description}</p>
            <div className="button-row">
              <button className="button button--secondary" onClick={() => setConfirmation(null)} type="button">
                {confirmation.cancelLabel ?? '取消'}
              </button>
              <button
                className={`button${confirmation.danger ? ' button--danger' : ''}`}
                onClick={() => {
                  const request = confirmation
                  setConfirmation(null)
                  request.onConfirm()
                }}
                type="button"
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}
