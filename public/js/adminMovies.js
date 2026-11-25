// Gestión de películas (admin): crear, editar y eliminar con fetch,
// para poder mostrar los errores del backend sin salir de la página.

/**
 * Llama a la API de películas y devuelve el status y el JSON de la respuesta.
 * @param {string} url
 * @param {"POST"|"PUT"|"DELETE"} method
 * @param {Object} [body]
 */
const sendMovie = async (url, method, body) => {
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
};

/** Muestra una lista de errores en el recuadro .js-form-errors del formulario. */
const showFormErrors = (form, messages) => {
    const box = form.querySelector('.js-form-errors');
    if (!box) return;

    box.replaceChildren();
    const list = document.createElement('ul');
    messages.forEach((text) => {
        const item = document.createElement('li');
        item.textContent = text; // textContent: el texto nunca se interpreta como HTML
        list.appendChild(item);
    });
    box.appendChild(list);
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// ---------- Crear (POST) y Editar (PUT) ----------
// Los dos formularios usan este mismo código: el método va en data-method
// y la URL en el atributo action.
document.querySelectorAll('.js-movie-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        // FormData lee todos los campos del formulario por su "name"
        const body = Object.fromEntries(new FormData(form));

        try {
            const { status, data } = await sendMovie(form.action, form.dataset.method, body);

            if (status === 200 || status === 201) {
                window.location.href = form.dataset.redirect;
                return;
            }
            if (status === 404) {
                showFormErrors(form, ['La película ya no existe.']);
            } else {
                showFormErrors(form, data.errors || [data.message || 'No se ha podido guardar la película.']);
            }
        } catch (error) {
            showFormErrors(form, ['Error de conexión. Inténtalo de nuevo.']);
        }
        button.disabled = false;
    });
});

// ---------- Eliminar (DELETE) ----------
document.querySelectorAll('.js-delete-movie').forEach((button) => {
    button.addEventListener('click', async () => {
        // El README pide algún tipo de confirmación antes de borrar
        if (!confirm(`¿Seguro que quieres eliminar "${button.dataset.title}"? Se quitará también de los favoritos de los usuarios.`)) {
            return;
        }

        const card = button.closest('.card');
        const msg = card.querySelector('.card__msg');
        button.disabled = true;

        try {
            const { status, data } = await sendMovie(`/api/movie/${button.dataset.id}`, 'DELETE');

            // 404: ya no existía (p. ej. borrada desde otra pestaña), así que también se quita
            if (status === 200 || status === 404) {
                card.remove();

                const grid = document.querySelector('.js-admin-grid');
                if (grid && !grid.querySelector('.card')) {
                    grid.remove();
                    document.querySelector('.js-admin-empty').hidden = false;
                }
                return;
            }
            msg.textContent = data.message || 'No se ha podido eliminar';
            msg.classList.add('card__msg--error');
        } catch (error) {
            msg.textContent = 'Error de conexión. Inténtalo de nuevo.';
            msg.classList.add('card__msg--error');
        }
        button.disabled = false;
    });
});
