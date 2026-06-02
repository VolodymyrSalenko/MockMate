import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="glass border border-slate-700/40 rounded-3xl p-10 max-w-md w-full text-center space-y-4">
          <span className="text-5xl">⚠️</span>
          <h2 className="text-xl font-black text-white">Something went wrong</h2>
          <p className="text-slate-500 text-sm">
            An unexpected error occurred. Try refreshing the page.
          </p>
          {this.state.error && (
            <p className="text-xs text-slate-700 font-mono bg-slate-900 rounded-xl px-3 py-2 text-left break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 text-sm"
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
