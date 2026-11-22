const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const API = 'http://localhost:8080/api';
const WEB = 'http://localhost:4173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');

const P_LAPTOP = '00000000-0000-0000-0000-000000000101';
const P_MOUSE = '00000000-0000-0000-0000-000000000103';

// --- Helpers de API ----------------------------------------------------------
async function api(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, json, text };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Sesiones -----------------------------------------------------------------
async function login(email, password) {
  const r = await api('POST', `${API}/auth/login`, { email, password });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return r.json;
}

async function seedCart(token, entries) {
  const cart = await api('GET', `${API}/cart`, undefined, token);
  for (const item of (cart.json.items ?? [])) {
    await api('DELETE', `${API}/cart/items/${item.id}`, undefined, token);
  }
  for (const [productId, quantity] of entries) {
    const r = await api('POST', `${API}/cart/items`, { productId, quantity }, token);
    if (r.status !== 200) throw new Error(`seed cart -> ${r.status}: ${r.text}`);
  }
}

function seedSession(page, token, profile) {
  return page.evaluate(
    ([t, p]) => {
      window.localStorage.setItem('shop_token', t);
      window.localStorage.setItem('shop_profile', JSON.stringify(p));
    },
    [token, profile],
  );
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(`  [OK] ${name}`);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);
}

// --- Flujo --------------------------------------------------------------------
(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const user = await login('user@demo.com', 'User123!');
  const admin = await login('admin@demo.com', 'Admin123!');
  console.log('Sesiones: user + admin');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check', '--disable-features=msEdgeWelcomeExperience'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('pageerror:', err.message));

  try {
    // --- Publico -------------------------------------------------------------
    console.log('Capturas publicas');
    await goto(page, `${WEB}/`);
    await shot(page, '01-catalogo.png');

    await goto(page, `${WEB}/product/${P_LAPTOP}`);
    await shot(page, '02-detalle-producto.png');

    await goto(page, `${WEB}/login`);
    await shot(page, '03-login.png');

    // --- Sesion usuario --------------------------------------------------------
    console.log('Capturas de usuario');
    await goto(page, `${WEB}/`);
    await seedSession(page, user.token, user.user);
    await seedCart(user.token, [[P_MOUSE, 1]]);

    await goto(page, `${WEB}/cart`);
    await shot(page, '04-carrito.png');

    await goto(page, `${WEB}/checkout`);
    await shot(page, '05-checkout-form.png');

    // Checkout exitoso desde la UI
    await page.type('#checkout-address', 'Cra 15 # 45-32, Bogota');
    await page.type('#checkout-card', '4242424242424242');
    await page.type('#checkout-cardholder', 'Usuario Demo');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.body.innerText.includes('Compra realizada'), { timeout: 20000 });
    await sleep(600);
    await shot(page, '06-checkout-exito.png');

    // Checkout rechazado desde la UI (tarjeta ...0002)
    await seedCart(user.token, [[P_MOUSE, 1]]);
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(600);
    await page.type('#checkout-address', 'Cra 15 # 45-32, Bogota');
    await page.type('#checkout-card', '4242424242420002');
    await page.type('#checkout-cardholder', 'Usuario Demo');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.body.innerText.includes('No se pudo procesar el pago'), { timeout: 20000 });
    await sleep(600);
    await shot(page, '07-checkout-rechazado.png');

    // Mis ordenes + detalle
    await goto(page, `${WEB}/orders`);
    await shot(page, '08-mis-ordenes.png');

    const orders = await api('GET', `${API}/orders/mine?page=0&size=5`, undefined, user.token);
    const firstOrder = orders.json.content[0];
    await goto(page, `${WEB}/orders/${firstOrder.id}`);
    await shot(page, '09-detalle-orden.png');

    await goto(page, `${WEB}/profile`);
    await shot(page, '10-perfil.png');

    // --- Sesion admin ----------------------------------------------------------
    console.log('Capturas de admin');
    await goto(page, `${WEB}/`);
    await seedSession(page, admin.token, admin.user);

    await goto(page, `${WEB}/admin/products`);
    await shot(page, '11-admin-productos.png');

    await goto(page, `${WEB}/admin/orders`);
    await shot(page, '12-admin-ordenes.png');

    // --- Swagger ---------------------------------------------------------------
    console.log('Capturas de API docs');
    await goto(page, 'http://localhost:8080/swagger-ui/index.html');
    await sleep(800);
    await shot(page, '13-swagger.png');
  } finally {
    await browser.close();
  }
  console.log('Capturas completadas en', OUT);
})().catch((err) => {
  console.error('FALLO en capturas:', err);
  process.exit(1);
});
