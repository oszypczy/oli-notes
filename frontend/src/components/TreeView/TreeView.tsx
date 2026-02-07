import type { TreeNode as TreeNodeType, PdfFile } from '../../types';
import { useFilteredTree } from '../../hooks/useFilteredTree';
import { TreeNode } from '../TreeNode/TreeNode';
import styles from './TreeView.module.css';

interface TreeViewProps {
  tree: TreeNodeType[];
  searchQuery: string;
  selectedPath: string | null;
  onSelectPdf: (pdf: PdfFile) => void;
}

export function TreeView({ tree, searchQuery, selectedPath, onSelectPdf }: TreeViewProps) {
  const filteredTree = useFilteredTree(tree, searchQuery);
  const isSearching = searchQuery.trim().length > 0;

  if (filteredTree.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Brak wyników</p>
      </div>
    );
  }

  return (
    <nav className={styles.tree}>
      {filteredTree.map((node) => (
        <TreeNode
          key={node.type === 'file' ? node.path : node.name}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectPdf={onSelectPdf}
          isSearching={isSearching}
        />
      ))}
    </nav>
  );
}
