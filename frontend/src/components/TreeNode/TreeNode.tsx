import { useState, useEffect } from 'react';
import type { TreeNode as TreeNodeType, PdfFile } from '../../types';
import { ChevronIcon, FolderIcon, FileIcon } from '../icons';
import styles from './TreeNode.module.css';

interface TreeNodeProps {
  node: TreeNodeType;
  depth: number;
  selectedPath: string | null;
  onSelectPdf: (pdf: PdfFile) => void;
  isSearching: boolean;
}

export function TreeNode({ node, depth, selectedPath, onSelectPdf, isSearching }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isSearching) setIsExpanded(true);
  }, [isSearching]);

  if (node.type === 'file') {
    const isActive = node.path === selectedPath;
    return (
      <button
        className={`${styles.nodeRow} ${isActive ? styles.nodeRowActive : ''}`}
        style={{ paddingLeft: depth * 16 + 12 }}
        onClick={() => onSelectPdf(node)}
      >
        <FileIcon className={styles.fileIcon} />
        <span className={styles.label}>{node.label}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        className={styles.nodeRow}
        style={{ paddingLeft: depth * 16 + 12 }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronIcon className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`} />
        <FolderIcon className={styles.folderIcon} />
        <span className={styles.label}>{node.label}</span>
      </button>
      <div className={`${styles.childrenContainer} ${isExpanded ? styles.childrenContainerExpanded : ''}`}>
        {node.children.map((child) => (
          <TreeNode
            key={child.type === 'file' ? child.path : child.name}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelectPdf={onSelectPdf}
            isSearching={isSearching}
          />
        ))}
      </div>
    </div>
  );
}
