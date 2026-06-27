'use client';
// components/public/WorkShare.jsx
// Botones de compartir obra — réplica de la sección #shareSection de public-detail.js
// Selectores CSS: .work-share, .work-share h3, .work-share__subtitle,
//   .work-share__copy-section, .work-share__input, .btn-copy, .btn-copy.copied,
//   .work-share__buttons, .btn-share, .btn-share--wa, .btn-share--email, .btn-share--sms

import { useState, useEffect } from 'react';
import { Mail, MessageCircle, Link2, Check } from 'lucide-react';

/**
 * @param {{ titulo: string, artista: string, descripcion?: string }} props
 */
export default function WorkShare({ titulo, artista, descripcion }) {
  // URL se resuelve client-side (window no disponible en SSR)
  const [url, setUrl]       = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const encodedUrl      = encodeURIComponent(url);
  const emailSubject    = encodeURIComponent(`${titulo} — ${artista}`);
  const emailBody       = encodeURIComponent(
    `${descripcion ? descripcion.slice(0, 160) : titulo}\n\n${url}`
  );

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback: seleccionar el input para que el usuario copie manualmente
      const input = document.querySelector('.work-share__input');
      if (input) { input.select(); document.execCommand('copy'); }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="work-share">
      <h3>Compartir</h3>
      <p className="work-share__subtitle">Comparte esta obra</p>

      {/* Copiar enlace */}
      <div className="work-share__copy-section">
        <input
          className="work-share__input"
          type="text"
          readOnly
          value={url}
          aria-label="URL de la obra"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className={`btn-copy${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Enlace copiado' : 'Copiar enlace'}
        >
          {copied
            ? <Check  size={16} aria-hidden />
            : <Link2  size={16} aria-hidden />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      {/* Botones de redes */}
      <div className="work-share__buttons">
        {/* WhatsApp — SVG inline (Bootstrap Icons bi-whatsapp) */}
        <a
          href={`https://wa.me/?text=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-share btn-share--wa"
          aria-label="Compartir en WhatsApp"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
          </svg>
          <span>WhatsApp</span>
        </a>

        {/* Email */}
        <a
          href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
          className="btn-share btn-share--email"
          aria-label="Compartir por correo electrónico"
        >
          <Mail size={16} aria-hidden />
          <span>Email</span>
        </a>

        {/* SMS — oculto en desktop (CSS .btn-share--sms { display: none } @media md+) */}
        <a
          href={`sms:?body=${encodedUrl}`}
          className="btn-share btn-share--sms"
          aria-label="Compartir por SMS"
        >
          <MessageCircle size={16} aria-hidden />
          <span>SMS</span>
        </a>
      </div>
    </div>
  );
}
