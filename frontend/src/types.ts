export interface PdfFile {
  type: 'file';
  name: string;
  label: string;
  path: string;
}

export interface PdfFolder {
  type: 'folder';
  name: string;
  label: string;
  children: TreeNode[];
}

export type TreeNode = PdfFile | PdfFolder;
