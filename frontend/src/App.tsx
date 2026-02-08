import { useState, useCallback, useMemo } from 'react';
import type { PdfFile, TreeNode } from './types';
import { usePdfTree } from './hooks/usePdfTree';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PdfViewer } from './components/PdfViewer/PdfViewer';
import { LoginScreen } from './components/LoginScreen/LoginScreen';
import styles from './App.module.css';

function findBreadcrumb(nodes: TreeNode[], path: string): string[] | null {
  for (const node of nodes) {
    if (node.type === 'file' && node.path === path) {
      return [node.label];
    }
    if (node.type === 'folder') {
      const result = findBreadcrumb(node.children, path);
      if (result) return [node.label, ...result];
    }
  }
  return null;
}

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { tree, loading, error } = usePdfTree();
  const [selectedPdf, setSelectedPdf] = useState<PdfFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectPdf = useCallback((pdf: PdfFile) => {
    setSelectedPdf(pdf);
    setSidebarOpen(false);
  }, []);

  const breadcrumb = useMemo(() => {
    if (!selectedPdf || !tree.length) return null;
    return findBreadcrumb(tree, selectedPdf.path);
  }, [tree, selectedPdf]);

  if (authLoading) {
    return <div className={styles.authLoading}>Ładowanie...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={styles.layout}>
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        user={user}
        onLogout={logout}
      />
      <main className={styles.main}>
        {sidebarOpen && (
          <div
            className={styles.overlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar
          tree={tree}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPath={selectedPdf?.path ?? null}
          onSelectPdf={handleSelectPdf}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <PdfViewer pdf={selectedPdf} breadcrumb={breadcrumb} />
      </main>
    </div>
  );
}

export default App;
