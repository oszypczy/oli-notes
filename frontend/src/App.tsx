import { useState, useCallback } from 'react';
import type { PdfFile } from './types';
import { usePdfTree } from './hooks/usePdfTree';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PdfViewer } from './components/PdfViewer/PdfViewer';
import styles from './App.module.css';

function App() {
  const { tree, loading, error } = usePdfTree();
  const [selectedPdf, setSelectedPdf] = useState<PdfFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectPdf = useCallback((pdf: PdfFile) => {
    setSelectedPdf(pdf);
    setSidebarOpen(false);
  }, []);

  return (
    <div className={styles.layout}>
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
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
        <PdfViewer pdf={selectedPdf} />
      </main>
    </div>
  );
}

export default App;
