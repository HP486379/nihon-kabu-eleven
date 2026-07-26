import React from 'react';

type AppErrorBoundaryState = {
  error: Error | null;
};

const STORAGE_PREFIX = 'nihon-kabu-eleven:';

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application render failed', error, info);
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
            width: 'min(560px, 100%)',
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={this.reload}>再読み込み</button>
            <button type="button" onClick={this.resetAppStorageAndReload}>保存データをリセットして再読み込み</button>
          </div>
        </section>
      </main>
    );
  }
}
