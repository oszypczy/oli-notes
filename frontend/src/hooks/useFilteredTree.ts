import { useMemo } from 'react';
import type { TreeNode } from '../types';

export function useFilteredTree(tree: TreeNode[], query: string): TreeNode[] {
  return useMemo(() => {
    if (!query.trim()) return tree;
    return filterTree(tree, query.toLowerCase());
  }, [tree, query]);
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const result: TreeNode[] = [];

  for (const node of nodes) {
    if (node.type === 'file') {
      if (
        node.label.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query)
      ) {
        result.push(node);
      }
    } else {
      const folderMatches =
        node.label.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query);
      const filteredChildren = filterTree(node.children, query);

      if (folderMatches || filteredChildren.length > 0) {
        result.push({
          ...node,
          children: folderMatches ? node.children : filteredChildren,
        });
      }
    }
  }

  return result;
}
