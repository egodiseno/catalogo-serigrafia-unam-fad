'use client';

/**
 * components/admin/ConfirmModal.jsx — Modal de confirmación
 *
 * Port React del VanillaJS confirm-modal.js. Usa las mismas clases CSS:
 *   .confirm-overlay / .confirm--visible / .confirm-dialog
 *   .confirm-icon / .confirm-icon--{danger|warning|info}
 *   .confirm-content / .confirm-actions
 *   .btn / .btn-secondary / .btn-danger
 *
 * Props:
 *   title          — título del diálogo
 *   message        — texto descriptivo (opcional)
 *   onConfirm      — callback al confirmar (puede ser async)
 *   onCancel       — callback al cancelar / cerrar
 *   confirmLabel   — texto del botón de confirmación (default 'Confirmar')
 *   cancelLabel    — texto del botón de cancelar (default 'Cancelar')
 *   confirmVariant — 'danger' | 'warning' | 'info' (default 'danger')
 *
 * Cierra con Escape. Foco atrapado dentro del diálogo (a11y).
 */

import { useEffect, useRef, useState } from 'react';

const ICONOS = { danger: '🗑️', warning: '⚠️', info: 'ℹ️' };

export default function ConfirmModal({
  title = '¿Confirmar acción?',
  message = '',
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
}) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const doneRef = useRef(false);

  // Transición de entrada + foco inicial en "Cancelar" (opción más segura)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  // Escape para cerrar + foco atrapado (Tab cicla dentro del diálogo)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    if (doneRef.current || busy) return;
    doneRef.current = true;
    setVisible(false);
    onCancel?.();
  };

  const handleConfirm = async () => {
    if (doneRef.current) return;
    try {
      setBusy(true);
      await onConfirm?.();
      doneRef.current = true;
      setVisible(false);
    } catch (err) {
      console.error('[ConfirmModal] onConfirm:', err);
      setBusy(false);
    }
  };

  const variant = ICONOS[confirmVariant] ? confirmVariant : 'danger';

  return (
    <div
      className={`confirm-overlay${visible ? ' confirm--visible' : ''}`}
      style={{ display: 'flex' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmModalTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="confirm-dialog" ref={dialogRef}>
        <div className={`confirm-icon confirm-icon--${variant}`} aria-hidden="true">
          {ICONOS[variant]}
        </div>
        <div className="confirm-content">
          <h3 id="confirmModalTitle">{title}</h3>
          {message ? <p>{message}</p> : null}
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn-secondary"
            ref={cancelBtnRef}
            onClick={handleCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
