import { param, initPage, safeNext } from './common.js';

const { store, user } = await initPage('');
const next = safeNext(param('next'));
if (user) location.href = next;

const $ = (id) => document.getElementById(id);
let mode = 'login';

function setMode(newMode) {
  mode = newMode;
  const isRegister = mode === 'register';
  $('tab-login').classList.toggle('active', !isRegister);
  $('tab-register').classList.toggle('active', isRegister);
  $('name-field').hidden = !isRegister;
  $('pw-hint').hidden = !isRegister;
  $('demo-hint').hidden = isRegister;
  $('submit').textContent = isRegister ? 'Create account' : 'Log in';
  $('password').setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
  $('error').textContent = '';
}

$('tab-login').addEventListener('click', () => setMode('login'));
$('tab-register').addEventListener('click', () => setMode('register'));

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('error').textContent = '';
  $('submit').disabled = true;
  try {
    const credentials = { email: $('email').value, password: $('password').value };
    if (mode === 'register') await store.register({ ...credentials, name: $('name').value });
    else await store.login(credentials);
    location.href = next;
  } catch (err) {
    $('error').textContent = err.message;
    $('submit').disabled = false;
  }
});
