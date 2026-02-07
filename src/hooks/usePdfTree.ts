import { useState, useEffect } from 'react';
import type { TreeNode } from '../types';

interface UsePdfTreeResult {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
}

export function usePdfTree(): UsePdfTreeResult {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/pdfs/tree.json')
      .then((res) => {
        if (!res.ok) throw new Error('Nie udało się załadować listy plików');
        return res.json();
      })
      .then((data) => {
        setTree(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { tree, loading, error };
}
