// Perfil: envía el formulario de "Editar datos" con fetch a PUT /api/user,
// para poder usar PUT (un formulario HTML solo envía GET o POST) y mostrar
// los errores del backend sin salir de la página.

const profileForm = document.querySelector('.js-edit-profile');

if (profileForm) {
    const errorsBox = profileForm.querySelector('.js-form-errors');
    const successMsg = profileForm.querySelector('.js-form-success');

    /** Muestra la lista de errores (textContent: el texto nunca se interpreta como HTML). */
    const showErrors = (messages) => {
        const list = document.createElement('ul');
        messages.forEach((text) => {
            const item = document.createElement('li');
            item.textContent = text;
            list.appendChild(item);
        });
        errorsBox.replaceChildren(list);
        errorsBox.hidden = false;
    };

    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = profileForm.querySelector('button[type="submit"]');
        button.disabled = true;
        errorsBox.hidden = true;
        successMsg.textContent = '';

        const body = Object.fromEntries(new FormData(profileForm));

        try {
            const response = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                // La sesión ha caducado: al inicio para volver a entrar
                window.location.href = '/';
                return;
            }

            if (response.ok) {
                // Actualiza los datos de arriba sin recargar
                document.querySelector('.js-profile-name').textContent = data.user.name;
                document.querySelector('.js-profile-email').textContent = data.user.email;
                successMsg.textContent = 'Datos guardados';
            } else {
                showErrors(data.errors || [data.message || 'No se han podido guardar los cambios.']);
            }
        } catch (error) {
            showErrors(['Error de conexión. Inténtalo de nuevo.']);
        }
        button.disabled = false;
    });
}
