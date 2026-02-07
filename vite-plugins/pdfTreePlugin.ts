import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

interface TreeNodeData {
  type: 'file' | 'folder';
  name: string;
  label: string;
  path?: string;
  children?: TreeNodeData[];
}

function humanize(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scanDirectory(dirPath: string, urlPrefix: string): TreeNodeData[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.pdf')).sort((a, b) => a.name.localeCompare(b.name));
  const nodes: TreeNodeData[] = [];

  for (const folder of folders) {
    nodes.push({
      type: 'folder',
      name: folder.name,
      label: humanize(folder.name),
      children: scanDirectory(
        path.join(dirPath, folder.name),
        `${urlPrefix}/${folder.name}`
      ),
    });
  }

  for (const file of files) {
    nodes.push({
      type: 'file',
      name: file.name,
      label: file.name.replace(/\.pdf$/i, '').toUpperCase(),
      path: `${urlPrefix}/${file.name}`,
    });
  }

  return nodes;
}

const VIRTUAL_MODULE_ID = 'virtual:pdf-tree';
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID;

export function pdfTreePlugin(): Plugin {
  let pdfsDir: string;

  return {
    name: 'pdf-tree',

    configResolved(config) {
      pdfsDir = path.resolve(config.root, 'public/pdfs');
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id === RESOLVED_ID) {
        const tree = scanDirectory(pdfsDir, '/pdfs');
        return `export default ${JSON.stringify(tree, null, 2)};`;
      }
    },

    configureServer(server) {
      server.watcher.add(pdfsDir);
      server.watcher.on('all', (_event, filePath) => {
        if (filePath.startsWith(pdfsDir)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
          }
        }
      });
    },
  };
}
