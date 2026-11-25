// Gestión de usuarios (admin): crear, editar y borrar con fetch,
// para poder usar PUT y DELETE y mostrar los errores del backend sin salir de la página.

/**
 * Llama a la API de usuarios y devuelve el status y el JSON de la respuesta.
 * @param {string} url
 * @param {"POST"|"PUT"|"DELETE"} method
 * @param {Object} [body]
 */
const sendUser = async (url, method, body) => {
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
};

/** Muestra una lista de errores en el recuadro .js-form-errors del formulario. */
const showUserFormErrors = (form, messages) => {
    const box = form.querySelector('.js-form-errors');
    if (!box) return;

    const list = document.createElement('ul');
    messages.forEach((text) => {
        const item = document.createElement('li');
        item.textContent = text; // textContent: el texto nunca se interpreta como HTML
        list.appendChild(item);
    });
    box.replaceChildren(list);
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// ---------- Crear (POST) y Editar (PUT) ----------
// Los dos formularios usan este mismo código: el método va en data-method
// y la URL en el atributo action.
document.querySelectorAll('.js-user-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        // FormData lee todos los campos del formulario por su "name"
        const body = Object.fromEntries(new FormData(form));

        try {
            const { status, data } = await sendUser(form.action, form.dataset.method, body);

            if (status === 200 || status === 201) {
                window.location.href = form.dataset.redirect;
                return;
            }
            if (status === 401) {
                window.location.href = '/';
                return;
            }
            if (status === 404) {
                showUserFormErrors(form, ['El usuario ya no existe.']);
            } else {
                showUserFormErrors(form, data.errors || [data.message || 'No se ha podido guardar el usuario.']);
            }
        } catch (error) {
            showUserFormErrors(form, ['Error de conexión. Inténtalo de nuevo.']);
        }
        button.disabled = false;
    });
});

// ---------- Borrar (DELETE) ----------
document.querySelectorAll('.js-delete-user').forEach((button) => {
    button.addEventListener('click', async () => {
        // El README pide confirmación (igual que al borrar películas)
        if (!confirm(`¿Seguro que quieres borrar a "${button.dataset.name}"? Se borrarán también sus películas favoritas.`)) {
            return;
        }

        const item = button.closest('.user-list__item');
        const msg = item.querySelector('.card__msg');
        button.disabled = true;

        try {
            const { status, data } = await sendUser(`/api/user/${button.dataset.id}`, 'DELETE');

            // 404: ya no existía (p. ej. borrado desde otra pestaña), así que también se quita
            if (status === 200 || status === 404) {
                item.remove();
                return;
            }
            msg.textContent = data.message || 'No se ha podido borrar';
            msg.classList.add('card__msg--error');
        } catch (error) {
            msg.textContent = 'Error de conexión. Inténtalo de nuevo.';
            msg.classList.add('card__msg--error');
        }
        button.disabled = false;
    });
});
