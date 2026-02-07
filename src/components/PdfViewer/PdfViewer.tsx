import type { PdfFile } from '../../types';
import { DownloadIcon } from '../icons';
import { EmptyState } from '../EmptyState/EmptyState';
import styles from './PdfViewer.module.css';

interface PdfViewerProps {
  pdf: PdfFile | null;
}

export function PdfViewer({ pdf }: PdfViewerProps) {
  if (!pdf) {
    return (
      <div className={styles.viewer}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <span className={styles.fileName}>{pdf.label}</span>
        <a className={styles.downloadBtn} href={pdf.path} download>
          <DownloadIcon />
          Pobierz
        </a>
      </div>
      <div className={styles.pdfContainer} key={pdf.path}>
        <object
          data={pdf.path}
          type="application/pdf"
          className={styles.pdfObject}
        >
          <p className={styles.fallback}>
            Twoja przeglądarka nie wspiera podglądu PDF.{' '}
            <a href={pdf.path} download>Pobierz plik</a>
          </p>
        </object>
      </div>
    </div>
  );
}
