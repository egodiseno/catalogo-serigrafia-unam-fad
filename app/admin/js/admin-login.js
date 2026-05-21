/*
  Prototipo 2 — Admin esencial
  Entrega 2 — Login admin mock.
  Simulación local únicamente: no Auth real, no backend, no cookies, no Storage,
  no sesión persistente y no guardado de credenciales.
*/

(function () {
  const MOCK_EMAIL = 'admin@catalogo.local';
  const MOCK_PASSWORD = 'admin123';
  const REDIRECT_DELAY = 720;

  const form = document.querySelector('[data-login-form]');
  const emailInput = document.querySelector('[data-login-email]');
  const passwordInput = document.querySelector('[data-login-password]');
  const message = document.querySelector('[data-login-message]');
  const submitButton = document.querySelector('[data-login-submit]');
  const submitLabel = document.querySelector('[data-submit-label]');
  const spinner = document.querySelector('[data-login-spinner]');
  const passwordToggle = document.querySelector('[data-password-toggle]');

  if (!form || !emailInput || !passwordInput || !message || !submitButton || !submitLabel || !spinner) return;

  const showMessage = (type, text) => {
    message.hidden = false;
    message.textContent = text;
    message.dataset.state = type;

    if (type === 'error') {
      message.setAttribute('role', 'alert');
      message.setAttribute('aria-live', 'assertive');
    } else {
      message.setAttribute('role', 'status');
      message.setAttribute('aria-live', 'polite');
    }
  };

  const clearMessage = () => {
    message.hidden = true;
    message.textContent = '';
    delete message.dataset.state;
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
  };

  const setLoading = (isLoading) => {
    submitButton.disabled = isLoading;
    emailInput.disabled = isLoading;
    passwordInput.disabled = isLoading;
    spinner.hidden = !isLoading;
    submitLabel.textContent = isLoading ? 'Validando acceso mock' : 'Ingresar al panel';
  };

  const setInvalid = (input, isInvalid) => {
    input.setAttribute('aria-invalid', String(isInvalid));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    setInvalid(emailInput, false);
    setInvalid(passwordInput, false);
    clearMessage();

    if (!email || !password) {
      setInvalid(emailInput, !email);
      setInvalid(passwordInput, !password);
      showMessage('error', 'Completa el correo electrónico y la contraseña para continuar.');
      (!email ? emailInput : passwordInput).focus();
      return;
    }

    if (email !== MOCK_EMAIL || password !== MOCK_PASSWORD) {
      setInvalid(emailInput, true);
      setInvalid(passwordInput, true);
      showMessage('error', 'Las credenciales no coinciden con el acceso mock del prototipo.');
      passwordInput.focus();
      return;
    }

    showMessage('loading', 'Acceso mock validado. Entrando al panel administrativo…');
    setLoading(true);

    window.setTimeout(() => {
      window.location.href = 'index.html';
    }, REDIRECT_DELAY);
  });

  [emailInput, passwordInput].forEach((input) => {
    input.addEventListener('input', () => {
      setInvalid(input, false);
      if (!submitButton.disabled) clearMessage();
    });
  });

  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }
})();
