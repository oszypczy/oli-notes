import { useState } from 'react';
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

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Sidebar
          tree={tree}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPath={selectedPdf?.path ?? null}
          onSelectPdf={setSelectedPdf}
        />
        <PdfViewer pdf={selectedPdf} />
      </main>
    </div>
  );
}

export default App;
