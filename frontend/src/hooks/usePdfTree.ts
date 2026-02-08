import { useState, useEffect } from 'react';
import type { TreeNode } from '../types';

interface UsePdfTreeResult {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
}

function isValidPath(path: string): boolean {
  return path.startsWith('/pdfs/') && !path.includes('..') && !path.includes('//');
}

function validateTree(nodes: unknown): TreeNode[] {
  if (!Array.isArray(nodes)) return [];

  return nodes.filter((node): node is TreeNode => {
    if (!node || typeof node !== 'object') return false;
    const n = node as Record<string, unknown>;

    if (typeof n.name !== 'string' || typeof n.label !== 'string') return false;

    if (n.type === 'file') {
      return typeof n.path === 'string' && isValidPath(n.path);
    }

    if (n.type === 'folder') {
      n.children = validateTree(n.children);
      return true;
    }

    return false;
  });
}

export function usePdfTree(): UsePdfTreeResult {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/pdfs/tree.json')
      .then((res) => {
        if (res.status === 401) throw new Error('Sesja wygasła — zaloguj się ponownie');
        if (!res.ok) throw new Error('Nie udało się załadować listy plików');
        return res.json();
      })
      .then((data) => {
        setTree(validateTree(data));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { tree, loading, error };
}
