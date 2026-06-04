/*
  Prototipo 1 — Público esencial
  Entrega 12 — Handoff final: documentación estabilizada; sin cambios funcionales.
  Entrega 5 — Compartir obra pública.
  Scope: compartir la URL de la ficha pública, copiar enlace, canales externos básicos y accesibilidad del estado.
*/

(() => {
  const panel = document.querySelector('[data-share-panel]');
  if (!panel) return;

  const title = panel.getAttribute('data-share-title') || document.title || 'Ficha de obra';
  const copyButton = panel.querySelector('[data-share-copy]');
  const nativeButton = panel.querySelector('[data-share-native]');
  const urlText = panel.querySelector('[data-share-url-text]');
  const status = panel.querySelector('[data-share-status]');
  const channels = Array.from(panel.querySelectorAll('[data-share-channel]'));

  const fallbackPath = 'obra-memoria-del-taller.html';
  const shareUrl = (() => {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.hash = '';
      return currentUrl.href;
    } catch (error) {
      return fallbackPath;
    }
  })();

  const shareText = `${title} — ${shareUrl}`;

  const setStatus = (message, type = 'success') => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
  };

  const copyWithFallback = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const updateChannelLinks = () => {
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    channels.forEach((link) => {
      const channel = link.getAttribute('data-share-channel');

      if (channel === 'whatsapp') {
        link.href = `https://wa.me/?text=${encodedText}`;
      }

      if (channel === 'email') {
        link.href = `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;
      }

      if (channel === 'sms') {
        link.href = `sms:?&body=${encodedText}`;
      }
    });
  };

  if (urlText) {
    urlText.textContent = shareUrl;
    urlText.setAttribute('title', shareUrl);
  }

  updateChannelLinks();

  if (nativeButton && navigator.share) {
    nativeButton.hidden = false;
    nativeButton.addEventListener('click', async () => {
      try {
        await navigator.share({ title, text: title, url: shareUrl });
        setStatus('Panel de compartir abierto.');
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        setStatus('No se pudo abrir el panel de compartir del dispositivo.', 'error');
      }
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      try {
        const copied = await copyWithFallback(shareUrl);
        if (!copied) throw new Error('copy-failed');
        setStatus('Enlace de la ficha copiado.');
      } catch (error) {
        setStatus('No se pudo copiar el enlace automáticamente.', 'error');
      }
    });
  }
})();
