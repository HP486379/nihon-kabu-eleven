import React from 'react';

type AppErrorBoundaryState = {
  error: Error | null;
  componentStack: string;
};

const STORAGE_PREFIX = 'nihon-kabu-eleven:';

function formatErrorDetails(error: Error | null, componentStack: string) {
  if (!error) return '';
  return [
    `name: ${error.name || 'Error'}`,
    `message: ${error.message || '(no message)'}`,
    error.stack ? `stack:\n${error.stack}` : '',
    componentStack ? `componentStack:\n${componentStack}` : '',
  ].filter(Boolean).join('\n\n');
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application render failed', error, info);
    this.setState({ componentStack: info.componentStack || '' });
  }

  private reload = () => {
    window.location.reload();
  };

  private resetAppStorageAndReload = () => {
    try {
      const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
        .filter((key): key is string => Boolean(key?.startsWith(STORAGE_PREFIX)));
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch (_error) {
      // Storage access is best-effort; reloading is still useful when it is unavailable.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const errorDetails = formatErrorDetails(this.state.error, this.state.componentStack);

    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#f3f6fb',
          color: '#14213d',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <section
          style={{
            width: 'min(760px, 100%)',
            padding: '28px',
            border: '1px solid #dbe3f0',
            borderRadius: '18px',
            background: '#fff',
            boxShadow: '0 18px 50px rgba(20, 33, 61, 0.12)',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: '22px' }}>画面の読み込みに失敗しました</h1>
          <p style={{ margin: '0 0 20px', lineHeight: 1.7 }}>
            一時的なデータ不整合が発生しました。まず再読み込みをお試しください。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
            <button type="button" onClick={this.reload}>再読み込み</button>
            <button type="button" onClick={this.resetAppStorageAndReload}>保存データをリセットして再読み込み</button>
          </div>
          <details style={{ marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>開発者向けエラー詳細を表示</summary>
            <pre
              style={{
                marginTop: '12px',
                maxHeight: '320px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid #dbe3f0',
                borderRadius: '12px',
                background: '#f8fafc',
                padding: '12px',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              {errorDetails || 'No error details available.'}
            </pre>
          </details>
        </section>
      </main>
    );
  }
}
