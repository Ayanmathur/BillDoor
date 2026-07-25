'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  enabled: boolean;
  minLength?: number;
  maxInterCharDelayMs?: number;
  suppressWhenTyping?: boolean;
}

/**
 * Global Barcode Scanner Hook for BillDoor (§5.4)
 *
 * Listens in the window capture phase for high-speed hardware scanner bursts.
 * Handles Bluetooth (80ms gap), USB scanners, Enter/Tab terminators, and timeout flushes.
 * Ignores keystrokes when typing in standard form inputs (unless data-barcode-capture="true").
 */
export function useBarcodeScanner({
  onScan,
  enabled,
  minLength = 3,
  maxInterCharDelayMs = 80,
  suppressWhenTyping = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastCharTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = '';
    if (code.length >= minLength) {
      onScan(code);
    }
  }, [onScan, minLength]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const isBarcodeCaptureInput = target?.dataset?.barcodeCapture === 'true';

      // Don't hijack typing in standard text fields (e.g. customer name, search, notes)
      if (suppressWhenTyping && isEditable && !isBarcodeCaptureInput) {
        return;
      }

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const gap = now - lastCharTimeRef.current;
      lastCharTimeRef.current = now;

      // Terminators: Enter or Tab
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.trim().length >= minLength) {
          e.preventDefault();
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        flush();
        return;
      }

      // Single printable character
      if (e.key.length === 1) {
        // Reset buffer if gap exceeds burst threshold (human typing vs hardware scanner)
        if (bufferRef.current.length > 0 && gap > maxInterCharDelayMs) {
          bufferRef.current = '';
        }
        bufferRef.current += e.key;

        // Fallback flush timer for scanners without terminators
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(flush, maxInterCharDelayMs * 3);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, flush, maxInterCharDelayMs, minLength, suppressWhenTyping]);
}
