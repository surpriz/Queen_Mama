import React from 'react'
import i18n from '@/i18n'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    // Report to Sentry so React render crashes are visible
    import('@/services/crash/crashReporter').then(({ captureError }) => {
      captureError(error, {
        componentStack: errorInfo.componentStack ?? undefined,
        service: 'react-error-boundary',
      })
    }).catch(() => { /* noop */ })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-qm-error text-headline font-semibold mb-2">
            {i18n.t('error.somethingWentWrong')}
          </div>
          <p className="text-qm-text-secondary text-body-sm mb-4">
            {this.state.error?.message || i18n.t('error.unexpectedError')}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-qm-md bg-qm-surface-medium text-qm-text-primary text-body-sm hover:bg-qm-surface-hover transition-colors"
          >
            {i18n.t('actions.tryAgain')}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
