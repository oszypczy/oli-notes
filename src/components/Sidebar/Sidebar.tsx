import type { TreeNode, PdfFile } from '../../types';
import { SearchBar } from '../SearchBar/SearchBar';
import { TreeView } from '../TreeView/TreeView';
import styles from './Sidebar.module.css';

interface SidebarProps {
  tree: TreeNode[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPath: string | null;
  onSelectPdf: (pdf: PdfFile) => void;
}

export function Sidebar({ tree, searchQuery, onSearchChange, selectedPath, onSelectPdf }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <SearchBar value={searchQuery} onChange={onSearchChange} />
      <div className={styles.treeContainer}>
        <TreeView
          tree={tree}
          searchQuery={searchQuery}
          selectedPath={selectedPath}
          onSelectPdf={onSelectPdf}
        />
      </div>
      <div className={styles.disclaimer}>
        <p>
          Prywatne notatki autora udostępnione nieodpłatnie
          studentom Politechniki Warszawskiej. Wykorzystywanie
          w celach komercyjnych bez zgody autora jest zabronione.
        </p>
        <p className={styles.copyright}>&copy; {new Date().getFullYear()} Oliwier Szypczyn</p>
      </div>
    </aside>
  );
}
