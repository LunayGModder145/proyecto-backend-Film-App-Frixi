// Menú hamburguesa: abre y cierra la "persiana" añadiendo la clase .open
const menuToggle = document.getElementById('menuToggle');
const mainMenu = document.getElementById('mainMenu');

if (menuToggle && mainMenu) {
    menuToggle.addEventListener('click', () => {
        const isOpen = mainMenu.classList.toggle('open');
        menuToggle.classList.toggle('open', isOpen);
        menuToggle.setAttribute('aria-expanded', isOpen);
    });
}

// Botón "Crear nueva" (vista de admin): muestra u oculta el formulario
const toggleCreate = document.getElementById('toggleCreate');
const createForm = document.getElementById('createForm');

if (toggleCreate && createForm) {
    toggleCreate.addEventListener('click', () => {
        createForm.hidden = !createForm.hidden;
        toggleCreate.setAttribute('aria-expanded', !createForm.hidden);
    });
}
