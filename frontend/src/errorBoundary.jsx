import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state to show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error or send it to an error tracking service
    this.setState({ error, errorInfo });
    console.error('Error:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Display a fallback UI when an error is caught
      return (
        <div>
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message || 'An unknown error occurred'}</p>
          {/* You can customize the error handling UI here */}
        </div>
      );
    }

    return this.props.children;  // Render children if no error occurs
  }
}

export default ErrorBoundary;
