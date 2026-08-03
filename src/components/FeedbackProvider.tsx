import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FeedbackContext, type ConfirmationRequest, type FeedbackContextValue } from './feedbackContext'

type FeedbackMessage = {
  kind: 'success' | 'error'
  text: string
  retry?: () => void
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<FeedbackMessage | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmationTriggerRef = useRef<HTMLElement | null>(null)

  function closeConfirmation() {
    setConfirmation(null)
  }

  useEffect(() => {
    if (confirmation !== null) {
      cancelButtonRef.current?.focus()
      return
    }

    const trigger = confirmationTriggerRef.current
    confirmationTriggerRef.current = null
    if (trigger?.isConnected) {
      trigger.focus()
    }
  }, [confirmation])

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showSuccess(text) {
        setMessage({ kind: 'success', text })
      },
      showError(text, retry) {
        setMessage({ kind: 'error', text, retry })
      },
      requestConfirmation(request) {
        confirmationTriggerRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
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
        <div className="confirmation-backdrop" role="presentation">
          <section
            aria-describedby="confirmation-description"
            aria-labelledby="confirmation-title"
            aria-modal="true"
            className="confirmation"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                closeConfirmation()
                return
              }

              if (event.key === 'Tab') {
                const cancelButton = cancelButtonRef.current
                const confirmButton = confirmButtonRef.current
                if (cancelButton === null || confirmButton === null) {
                  return
                }

                if (event.shiftKey && document.activeElement === cancelButton) {
                  event.preventDefault()
                  confirmButton.focus()
                } else if (!event.shiftKey && document.activeElement === confirmButton) {
                  event.preventDefault()
                  cancelButton.focus()
                }
              }
            }}
            role="dialog"
          >
            <h2 id="confirmation-title">{confirmation.title}</h2>
            <p id="confirmation-description">{confirmation.description}</p>
            <div className="button-row">
              <button
                className="button button--secondary"
                onClick={closeConfirmation}
                ref={cancelButtonRef}
                type="button"
              >
                {confirmation.cancelLabel ?? '取消'}
              </button>
              <button
                className={`button${confirmation.danger ? ' button--danger' : ''}`}
                onClick={() => {
                  const request = confirmation
                  closeConfirmation()
                  request.onConfirm()
                }}
                ref={confirmButtonRef}
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
