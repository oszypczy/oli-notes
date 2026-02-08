import { useState, useEffect, useRef } from 'react';
import type { PdfFile } from '../../types';
import { DownloadIcon } from '../icons';
import { EmptyState } from '../EmptyState/EmptyState';
import styles from './PdfViewer.module.css';

interface PdfViewerProps {
  pdf: PdfFile | null;
  breadcrumb: string[] | null;
}

export function PdfViewer({ pdf, breadcrumb }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pdf) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setProgress(0);
    setBlobUrl(null);

    if (!pdf.path.startsWith('/pdfs/') || pdf.path.includes('..')) {
      console.error('Invalid PDF path:', pdf.path);
      setLoading(false);
      return;
    }

    fetch(pdf.path, { signal: controller.signal })
      .then(async (response) => {
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        if (!response.body) {
          const blob = await response.blob();
          return blob;
        }

        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            setProgress(Math.round((received / total) * 100));
          }
        }

        return new Blob(chunks, { type: 'application/pdf' });
      })
      .then((blob) => {
        if (!controller.signal.aborted) {
          setBlobUrl(URL.createObjectURL(blob));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load PDF:', err);
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [pdf?.path]);

  useEffect(() => {
    const url = blobUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [blobUrl]);

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
        <span className={styles.fileName}>{breadcrumb ? breadcrumb.join(' / ') : pdf.label}</span>
        <a className={styles.downloadBtn} href={pdf.path} download>
          <DownloadIcon />
          Pobierz
        </a>
      </div>
      <div className={styles.pdfContainer}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.progressWrapper}>
              <div
                className={styles.progressBar}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={styles.loadingText}>
              {progress > 0 ? `Ładowanie PDF... ${progress}%` : 'Ładowanie PDF...'}
            </span>
          </div>
        )}
        {blobUrl && (
          <object
            data={blobUrl}
            type="application/pdf"
            className={styles.pdfObject}
          >
            <p className={styles.fallback}>
              Twoja przeglądarka nie wspiera podglądu PDF.{' '}
              <a href={pdf.path} download>Pobierz plik</a>
            </p>
          </object>
        )}
      </div>
    </div>
  );
}
