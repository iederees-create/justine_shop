/** ===== WHATSAPP NUMBER ===== **/
const WA_NUMBER = "27845272182"; // international format without +
const WA_BASE = `https://wa.me/${WA_NUMBER}?text=`;

/** ===== STATE / ELEMENTS ===== **/
let state = { products: [], cart: [] };

const els = {
  grid: document.getElementById('grid'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  brand: document.getElementById('brand'),
  category: document.getElementById('category'),
  sort: document.getElementById('sort'),
  cartBtn: document.getElementById('cartButton'),
  cart: document.getElementById('cart'),
  closeCart: document.getElementById('closeCart'),
  cartItems: document.getElementById('cartItems'),
  subtotal: document.getElementById('subtotal'),
  cartCount: document.getElementById('cartCount'),
  waOrder: document.getElementById('waOrder'),
  emailOrder: document.getElementById('emailOrder'),
  custName: document.getElementById('custName'),
  custPhone: document.getElementById('custPhone'),
  custEmail: document.getElementById('custEmail'),
  custAddress: document.getElementById('custAddress'),
  custNotes: document.getElementById('custNotes'),
};

/** ===== LOAD PRODUCT DATA (single file) ===== **/
async function loadProducts() {
  const sources = [
    { url: 'products.json', brand: 'Avon + Justine' }
  ];

  const lists = [];
  for (const src of sources) {
    try {
      const res = await fetch(src.url);
      if (!res.ok) throw new Error(`${src.url} not found`);
      const raw = await res.json();
      const tagged = Array.isArray(raw)
        ? raw.map(r => ({ ...r, brand: r.brand || src.brand }))
        : [];
      lists.push(tagged);
    } catch (e) {
      console.warn('Load warning:', e.message);
    }
  }

  const merged = lists.flat();
  const cleaned = sanitizeProducts(merged);
  state.products = cleaned;
  attachFilters();
  render();
}

/** ===== FILTER EVENTS ===== **/
function attachFilters() {
  ['input', 'change'].forEach(ev => {
    els.search.addEventListener(ev, render);
    els.brand.addEventListener(ev, render);
    els.category.addEventListener(ev, render);
    els.sort.addEventListener(ev, render);
  });
}

/** ===== SANITIZE ===== **/
function sanitizeProducts(list) {
  const normalized = list.map(normalizeEntry).filter(validProduct);
  const seen = new Map();

  for (const p of normalized) {
    const key = p.code ? `${p.brand}|code:${p.code}` : `${p.brand}|name:${slug(p.name)}`;
    if (!seen.has(key)) {
      seen.set(key, p);
    } else {
      const existing = seen.get(key);
      if (p.price < existing.price) seen.set(key, { ...existing, price: p.price });
      if (existing.category === 'General' && p.category !== 'General') {
        seen.set(key, { ...seen.get(key), category: p.category });
      }
      if ((!existing.image || existing.image.includes('placeholder')) && p.image) {
        seen.set(key, { ...seen.get(key), image: p.image });
      }
    }
  }

  const out = Array.from(seen.values());
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function normalizeEntry(e) {
  const originalName = (e.name || "").trim();
  let extractedCode = "";
  const codeMatch = originalName.match(/\bCode\s+(\d{4,8})\b/i);
  if (codeMatch) extractedCode = codeMatch[1];
  let code = (String(e.code || "").match(/^\d{3,10}$/) ? String(e.code) : "") || extractedCode;

  let name = originalName
    .replace(/(\d)\s*(ml|g|kg|l)\b/gi, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

  name = removePromoPhrases(name);
  if (!/\p{L}/u.test(name)) name = originalName;
  name = fixCasing(name);

  let price = Number(e.price);
  if (!isFinite(price)) price = 0;
  if (price >= 10000) price = Math.round(price) / 100;
  if (price > 2000) price = 0;

  const category = e.category && e.category !== 'General' ? e.category : guessCategory(name);
  const brand = (e.brand || '').trim() || guessBrand(name);

  const image = e.image && e.image.trim() ? e.image : "images/placeholder.svg";
  const id = Number.isFinite(Number(e.id))
    ? Number(e.id)
    : Math.abs(hashCode((brand || '') + (code || '') + name));
  const description = (e.description || "").trim();

  return { id, brand, name, code, price: round2(price), category, image, description };
}

function removePromoPhrases(s) {
  const kill = [
    /\bREGULAR PRICE\b/gi, /\bLOWER PRICE\b/gi, /\bGREAT DEAL\b/gi, /\bBESTSELLER\b/gi,
    /\bSAVE\b/gi, /\bUP TO\b/gi, /\bONLY\b/gi, /\bBOTH FOR\b/gi, /\bEACH\b/gi,
    /\bWHEN YOU BUY\b/gi, /\bBUY( THE)?\b/gi, /\b& GET\b/gi, /\bFREE\b/gi,
    /\bORDER CODE\s+\d{3,10}\b/gi, /\bOCTOBE?R?\s*2025?\b/gi
  ];
  for (const r of kill) s = s.replace(r, " ").trim();
  if (/^\d+\s*(ml|g|kg|l)\b/i.test(s) && s.split(" ").length <= 3) s = "";
  s = s.replace(/\bCode\s+\d{3,10}\b/gi, "").replace(/\s{2,}/g, " ").trim();
  return s;
}

function fixCasing(s) {
  s = s
    .replace(/\beau de parfum\b/gi, "Eau de Parfum")
    .replace(/\beau de toilette\b/gi, "Eau de Toilette")
    .replace(/\broll[-\s]?on\b/gi, "Roll-On")
    .replace(/\bdeodorant\b/gi, "Deodorant")
    .replace(/\bbody (spray|lotion|wash|butter|oil|cr[eè]me)\b/gi, (m) =>
      m.split(" ").map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    );
  return s.replace(/\s{2,}/g, " ").trim();
}

function guessCategory(name) {
  const n = name.toLowerCase();
  if (/(eau de parfum|eau de toilette|cologne|deodorant spray|parfum)/i.test(n)) return "Fragrance";
  if (/(serum|cream|spf|day cream|night cream|moisturi[sz]er|cleanser|toner|mask|eye cream|foundation|concealer|lip|mascara|eyeliner|brow|palette|blush|powder|nail)/i.test(n)) return "Makeup";
  if (/(tissue oil|body (wash|butter|lotion|cr[eè]me)|shower|bath|bubble)/i.test(n)) return "Bath & Body";
  if (/\bmen('|’)?s\b/.test(n)) return "Men's";
  if (/(handbag|watch|earrings|necklace|bracelet|scarf|bag|wallet|jewellery|jewelry)/i.test(n)) return "Style Store";
  if (/(tool|brush|grooming set)/i.test(n)) return "Tools";
  return "Skincare";
}

function guessBrand(name) {
  return /tissue oil|justine/i.test(name) ? "Justine" : "Avon";
}

function validProduct(p) {
  if (!p.name || p.name.length < 6) return false;
  const promoWords = /\b(SAVE|ONLY|UP TO|BOTH FOR|GREAT DEAL|EACH|ORDER CODE|BUY|FREE)\b/i;
  if (promoWords.test(p.name)) return false;
  if (!(p.price >= 25 && p.price <= 2000)) return false;
  if (p.code && !/^\d{3,10}$/.test(p.code)) p.code = "";
  if (!p.brand) p.brand = "Avon";
  return true;
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100 }
function hashCode(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return h; }

/** ===== RENDER ===== **/
function render() {
  const q = (els.search.value || "").trim().toLowerCase();
  const cat = els.category.value;
  const brand = els.brand.value;
  let items = [...state.products];

  if (brand && brand !== 'all') items = items.filter(p => p.brand === brand);
  if (cat && cat !== 'all') items = items.filter(p => p.category === cat);
  if (q) items = items.filter(p => [p.name, p.code, p.description, p.brand].join(' ').toLowerCase().includes(q));

  const sort = els.sort.value;
  if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
  if (sort === 'alpha') items.sort((a, b) => a.name.localeCompare(b.name));

  els.grid.innerHTML = '';
  if (!items.length) {
    els.empty.classList.remove('hidden');
    return;
  } else {
    els.empty.classList.add('hidden');
  }

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    const brandBadgeClass = p.brand ? `brand-${p.brand}` : '';
    card.innerHTML = `
      <div class="img">
        <img src="${p.image || 'images/placeholder.svg'}"
             alt="${escapeHtml(p.name)}"
             class="w-full h-full object-cover"
             onerror="this.onerror=null;this.src='images/placeholder.svg'"/>
      </div>
      <div class="body">
        <div class="flex items-start justify-between gap-3">
          <h4 class="text-base">${escapeHtml(p.name)}</h4>
          <span class="badge ${brandBadgeClass}">${p.brand || ''}</span>
        </div>
        ${p.description ? `<p class="small mt-1">${escapeHtml(p.description)}</p>` : ''}
        <div class="mt-3 flex items-center justify-between">
          <span class="price">R${p.price.toFixed(2)}</span>
          <span class="small">${p.code ? `Code: ${p.code}` : ''}</span>
        </div>
        <button class="add mt-4" data-id="${p.id}">Add to cart</button>
      </div>
    `;
    els.grid.appendChild(card);
  });

  els.grid.querySelectorAll('.add').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-id');
      addToCart(Number(id));
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

/** ===== CART ===== **/
function addToCart(id) {
  const p = state.products.find(x => Number(x.id) === Number(id));
  if (!p) return;
  const found = state.cart.find(x => x.id === p.id);
  if (found) found.qty += 1;
  else state.cart.push({ ...p, qty: 1 });
  updateCart();
  openCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(x => x.id !== id);
  updateCart();
}

function updateQty(id, delta) {
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  updateCart();
}

function money(n) { return `R${(Number(n) || 0).toFixed(2)}` }

function updateCart() {
  els.cartItems.innerHTML = '';
  let subtotal = 0;
  state.cart.forEach(item => {
    const line = item.price * item.qty;
    subtotal += line;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div class="font-semibold">${escapeHtml(item.name)}</div>
        <div class="small">${[item.brand, item.code ? `Code: ${item.code}` : ''].filter(Boolean).join(' • ')}</div>
        <div class="small">${money(item.price)} × ${item.qty} = <span class="font-semibold">${money(line)}</span></div>
        <div class="remove mt-1" data-id="${item.id}">Remove</div>
        <hr class="sep" />
      </div>
      <div class="qty">
        <button data-id="${item.id}" data-delta="-1">−</button>
        <span>${item.qty}</span>
        <button data-id="${item.id}" data-delta="1">+</button>
      </div>
    `;
    els.cartItems.appendChild(row);
  });
  els.subtotal.textContent = money(subtotal);
  els.cartCount.textContent = state.cart.reduce((s, x) => s + x.qty, 0);

  els.cartItems.querySelectorAll('.remove').forEach(a => {
    a.addEventListener('click', e => removeFromCart(Number(e.currentTarget.getAttribute('data-id'))));
  });
  els.cartItems.querySelectorAll('.qty button').forEach(b => {
    b.addEventListener('click', e => {
      const id = Number(e.currentTarget.getAttribute('data-id'));
      const delta = Number(e.currentTarget.getAttribute('data-delta'));
      updateQty(id, delta);
    });
  });
}

/** ===== CART UI ===== **/
function openCart() { els.cart.classList.add('open'); }
function closeCart() { els.cart.classList.remove('open'); }
els.cartBtn.addEventListener('click', openCart);
els.closeCart.addEventListener('click', closeCart);

/** ===== CHECKOUT ===== **/
function buildMessage() {
  const lines = [];
  lines.push(`*New Order — Avon + Justine Shop*`);
  lines.push('');
  state.cart.forEach(i => {
    lines.push(`• ${i.brand ? `[${i.brand}] ` : ''}${i.name} ${i.code ? `(Code ${i.code}) ` : ''}× ${i.qty} — R${(i.price * i.qty).toFixed(2)}`);
  });
  const total = state.cart.reduce((s, x) => s + x.price * x.qty, 0);
  lines.push('');
  lines.push(`*Subtotal:* R${total.toFixed(2)}`);
  lines.push('');
  const name = els.custName.value || '';
  const phone = els.custPhone.value || '';
  const email = els.custEmail.value || '';
  const addr = els.custAddress.value || '';
  const notes = els.custNotes.value || '';
  lines.push(`*Customer*`);
  if (name) lines.push(`Name: ${name}`);
  if (phone) lines.push(`Phone: ${phone}`);
  if (email) lines.push(`Email: ${email}`);
  if (addr) lines.push(`Address: ${addr}`);
  if (notes) lines.push(`Notes: ${notes}`);
  lines.push('');
  lines.push('_Sent from my storefront._');
  return encodeURIComponent(lines.join('\n'));
}

function sendWhatsApp() {
  if (!state.cart.length) { alert('Your cart is empty.'); return; }
  const url = WA_BASE + buildMessage();
  window.open(url, '_blank');
}

function sendEmail() {
  if (!state.cart.length) { alert('Your cart is empty.'); return; }
  const to = ''; // optional: set your email
  const subject = encodeURIComponent("New Order — Avon + Justine Shop");
  const body = buildMessage();
  const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
}
els.waOrder.addEventListener('click', sendWhatsApp);
els.emailOrder.addEventListener('click', sendEmail);

/** ===== INIT + HUB LINK TRACKING ===== **/
loadProducts();
document.addEventListener("DOMContentLoaded", () => {
  const islamicLinks = document.querySelectorAll('a[href*="iederees-create.github.io/iederees-downloads"]');
  islamicLinks.forEach(link => {
    if (!link.href.includes("?src=shop")) {
      link.href += link.href.includes("?") ? "&src=shop" : "?src=shop";
    }
  });
});
