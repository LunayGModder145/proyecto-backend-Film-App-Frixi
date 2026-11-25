// Favoritos: "Añadir a Favoritos" (buscador y detalle) y "Quitar" (Mis películas).
// Se envían con fetch a /api/favorites para no salir de la página
// y se muestra el resultado en el <p.card__msg> de cada tarjeta.

/**
 * Llama a /api/favorites y devuelve el status y el JSON de la respuesta.
 * @param {"POST"|"DELETE"} method
 * @param {{ movieId: string, source: string }} body
 */
const sendFavorite = async (method, body) => {
    const response = await fetch('/api/favorites', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
};

/** Escribe un mensaje en el <p.card__msg> que haya dentro de `container`. */
const showMessage = (container, text, isError = false) => {
    const msg = container.querySelector('.card__msg');
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle('card__msg--error', isError);
};

// ---------- Añadir a Favoritos ----------
document.querySelectorAll('.js-add-favorite').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;

        try {
            const { status, data } = await sendFavorite('POST', {
                movieId: form.elements.movieId.value,
                source: form.elements.source.value
            });

            if (status === 201) {
                showMessage(form, '✓ Añadida a Mis películas');
                button.textContent = '★ En Mis películas';
                return; // el botón se queda desactivado: ya está guardada
            }
            if (status === 409) {
                showMessage(form, 'Ya está en Mis películas');
                button.textContent = '★ En Mis películas';
                return;
            }
            showMessage(form, data.message || 'No se ha podido añadir', true);
        } catch (error) {
            showMessage(form, 'Error de conexión. Inténtalo de nuevo.', true);
        }
        button.disabled = false;
    });
});

// ---------- Quitar de Mis películas ----------
document.querySelectorAll('.js-remove-favorite').forEach((button) => {
    button.addEventListener('click', async () => {
        const card = button.closest('.card');
        button.disabled = true;

        try {
            const { status, data } = await sendFavorite('DELETE', {
                movieId: button.dataset.id,
                source: button.dataset.source
            });

            // 404: ya no estaba guardada (p. ej. quitada desde otra pestaña), así que también se quita
            if (status === 200 || status === 404) {
                card.remove();

                const grid = document.querySelector('.js-favorites-grid');
                if (grid && !grid.querySelector('.card')) {
                    grid.remove();
                    document.querySelector('.js-favorites-empty').hidden = false;
                }
                return;
            }
            showMessage(card, data.message || 'No se ha podido quitar', true);
        } catch (error) {
            showMessage(card, 'Error de conexión. Inténtalo de nuevo.', true);
        }
        button.disabled = false;
    });
});
