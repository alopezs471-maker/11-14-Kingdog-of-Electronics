const cuentaForm = document.querySelector('#cuenta-form');
const profileForm = document.querySelector('#profile-form');
const cuentaMessage = document.querySelector('#cuenta-message');
const toggle = document.querySelector('#cuenta-toggle');
let registering = false;

function showUser(user) {
  cuentaForm.hidden = !!user;
  toggle.hidden = !!user;
  profileForm.hidden = !user;
  document.querySelector('#cuenta-heading').textContent = user ? 'Tu perfil' : 'Tu cuenta';
  if (user) {
    profileForm.elements.name.value = user.name;
    document.querySelector('#profile-email').textContent = user.email;
  }
}

async function request(path, data) {
  const response = await fetch(path, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
  return result;
}

toggle.addEventListener('click', () => {
  registering = !registering;
  document.querySelector('#name-field').hidden = !registering;
  cuentaForm.elements.name.required = registering;
  cuentaForm.elements.password.autocomplete = registering ? 'new-password' : 'current-password';
  document.querySelector('#cuenta-submit').textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  toggle.textContent = registering ? 'Ya tengo una cuenta' : 'Crear una cuenta';
  cuentaMessage.textContent = '';
});
cuentaForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await request(registering ? '/api/register' : '/api/login', Object.fromEntries(new FormData(cuentaForm)));
    cuentaForm.reset();
    showUser(result.user);
    cuentaMessage.textContent = 'Sesión iniciada.';
  } catch (error) { cuentaMessage.textContent = error.message; }
});
profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await request('/api/profile', { name: profileForm.elements.name.value });
    showUser(result.user);
    cuentaMessage.textContent = 'Perfil actualizado.';
  } catch (error) { cuentaMessage.textContent = error.message; }
});
document.querySelector('#logout').addEventListener('click', async () => {
  try {
    await request('/api/logout', {});
    showUser(null);
    cuentaMessage.textContent = 'Sesión cerrada.';
  } catch (error) { cuentaMessage.textContent = error.message; }
});
request('/api/me').then(result => showUser(result.user)).catch(() => {
  cuentaMessage.textContent = 'Para usar tu cuenta, inicia la página con el servidor de Kingdog.';
});
