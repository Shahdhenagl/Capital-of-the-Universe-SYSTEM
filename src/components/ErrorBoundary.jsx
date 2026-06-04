import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#f8d7da', color: '#721c24', minHeight: '100vh', direction: 'rtl' }}>
          <h2>حدث خطأ غير متوقع في التطبيق</h2>
          <p>يرجى تصوير هذه الشاشة وإرسالها للدعم الفني:</p>
          <pre style={{ background: '#fff', padding: '15px', overflowX: 'auto', borderRadius: '5px', textAlign: 'left', direction: 'ltr' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '10px 20px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '20px' }}
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
