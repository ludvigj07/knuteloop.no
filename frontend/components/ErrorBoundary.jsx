import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') {
      console.error('App crashed:', error, info?.componentStack);
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-screen" role="alert">
          <div className="error-boundary-screen__inner">
            <div className="error-boundary-screen__emoji" aria-hidden="true">😬</div>
            <h1>Noe gikk galt</h1>
            <p>
              Appen krasjet uventet. Prøv å laste siden på nytt — det fikser
              som regel problemet. Hvis det fortsetter, gi beskjed til admin.
            </p>
            <button
              type="button"
              className="error-boundary-screen__button"
              onClick={this.handleReload}
            >
              Last på nytt
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
