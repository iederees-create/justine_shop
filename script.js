/** ================================
 * Avon + Justine — Unified Storefront Logic
 * - Loads products from products.json (+ optional avon-products.json)
 * - Normalizes, dedupes, and renders cards
 * - Image/Video media support (mp4)
 * - Search / sort (+ optional brand, category)
 * - Cart (localStorage) with qty/remove
 * - Cart drawer compatibility: #cartDrawer (+ #cartOverlay) or legacy #cart
 * - WhatsApp & Email checkout with optional customer fields
 * ================================= */

/** ===== WHATSAPP NUMBER ===== **/
const WA_NUMBER = "27845272182"; // international format without +
const WA_BASE = `https://wa.me/${WA_NUMBER}?text=`;

/** ===== STATE ===== **/
const CART_KEY = "aj_cart_v1";
let state = {
  products: [],
  cart: []
};

/** ===== ELEMENTS (gracefully optional) ===== **/
const els = {
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  search: document.getElementById("search"),
  brand: document.getElementById("brand"),
  category: document.getElementById("category"),
  sort: document.getElementById("sort"),

  // header button + counters
  cartBtn: document.getElementById("cartButton"),
  cartCount: document.getElementById("cartCount"),

  // NEW drawer (preferred)
  cartDrawer: document.getElementById("cartDrawer"),
  cartOverlay: document.getElementById("cartOverlay"),
  closeCartBtn: document.getElementById("closeCart"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  checkoutWA: document.getElementById("checkoutWA"),

  // Legacy panel support
  cartLegacy: document.getElementById("cart"),
  subtotalLegacy: document.getElementById("subtotal"),
  waOrderLegacy: document.getElementById("waOrder"),
  emailOrderLegacy: document.getElementById("emailOrder"),

  // Optional customer fields (cart form)
  custName: document.getElementById("custName"),
  custPhone: document.getElementById("custPhone"),
  custEmail: document.getElementById("custEmail"),
  custAddress: document.getElementById("custAddress"),
  custNotes: document.getElementById("custNotes"),
};

/** ===== SMALL UTILS ===== **/
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)
  );
}
function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function round2(n){ return Math.round((Number(n)||0)*100)/100; }
function hashCode(str){ let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return h; }
function money(n){ return `R${(Number(n)||0).toFixed(2)}`; }
function priceToNumber(p){
  // Supports "R349.90", "449.90", 449.90, "R 1 299.95" etc.
  if (typeof p === "number") return p;
  const num = parseFloat(String(p||"").replace(/[^\d.]/g,""));
  return isFinite(num) ? num : 0;
}

/** ===== STORAGE (cart) ===== **/
function loadCart(){
  try {
    const raw = localStorage.getItem(CART_KEY);
    state.cart = raw ? JSON.parse(raw) : [];
  } catch {
    state.cart = [];
  }
}
function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}
function cartCount(){
  return state.cart.reduce((n,i)=> n + (i.qty||0), 0);
}
function cartSum(){
  return state.cart.reduce((s,i)=> s + (i.qty * (i.price||0)), 0);
}
function updateCartBadge(){
  if (els.cartCount) els.cartCount.textContent = String(cartCount());
}

/** ===== DATA LOAD ===== **/
async function loadProducts() {
  const sources = [
    { url: 'products.json',       brand: 'Justine' },
    { url: 'avon-products.json',  brand: 'Avon' }  // optional; non-fatal if missing
  ];

  const lists = [];
  for (const src of sources) {
    try {
      const res = await fetch(src.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${src.url} not found`);
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : [];
      const tagged = arr.map(r => ({ ...r, brand: r.brand || src.brand }));
      lists.push(tagged);
    } catch (e) {
      console.warn("Load warning:", e.message);
    }
  }

  const merged = lists.flat();
  const cleaned = sanitizeProducts(merged);
  state.products = cleaned;

  // Optional: populate filters if those selects exist but are empty
  hydrateFilterOptions();

  render();
}

/** ===== NORMALIZE / SANITIZE ===== **/
function sanitizeProducts(list) {
  const normalized = list
    .map(normalizeEntry)
    .filter(validProduct);

  // Dedupe priority: brand+code OR brand+name
  const seen = new Map();
  for (const p of normalized) {
    const key = p.code ? `${p.brand}|code:${p.code}` : `${p.brand}|name:${slug(p.name)}`;
    if (!seen.has(key)) {
      seen.set(key, p);
    } else {
      const ex = seen.get(key);
      const better = { ...ex };
      // Prefer lower price
      if (p.price < ex.price) better.price = p.price, better.price_text = p.price_text;
      // Prefer specific category
      if (ex.category === 'General' && p.category !== 'General') better.category = p.category;
      // Prefer a real image/video if existing is missing/placeholder
      const haveMedia = (m)=> m && !/placeholder/i.test(m);
      if (!haveMedia(ex.media) && haveMedia(p.media)) better.media = p.media;
      seen.set(key, better);
    }
  }

  const out = Array.from(seen.values());
  out.sort((a,b) => a.name.localeCompare(b.name));
  return out;
}

function normalizeEntry(e){
  // Accept both your new JSON (with price strings, image/video fields) and older imports
  const originalName = String(e.name || "").trim();
  let extractedCode = "";
  const codeMatch = originalName.match(/\bCode\s+(\d{4,10})\b/i);
  if (codeMatch) extractedCode = codeMatch[1];
  let code = (String(e.code||"").match(/^\d{3,10}$/) ? String(e.code) : "") || extractedCode;

  // Clean name (remove loud promo phrases)
  let name = removePromoPhrases(originalName);
  if (!/\p{L}/u.test(name)) name = originalName;
  name = fixCasing(name);

  // Price (numeric + text)
  const price_num = priceToNumber(e.price);
  const price_text = typeof e.price === "string" && /[^\d]/.test(e.price)
    ? e.price.trim()
    : (isFinite(price_num) && price_num > 0 ? `R${price_num.toFixed(2)}` : "");

  // Media (image or video)
  const media = pickMedia(e);

  // Category/brand
  const category = e.category && e.category !== 'General' ? String(e.category).trim() : guessCategory(name);
  const brand = (e.brand || '').trim() || guessBrand(name);

  // ID (stable)
  const id = Number.isFinite(Number(e.id)) ? Number(e.id) : Math.abs(hashCode((brand||'') + (code||'') + name));

  // Description
  const description = (e.description || "").trim();

  return {
    id,
    brand,
    name,
    code,
    price: round2(price_num),
    price_text,
    category,
    description,
    // keep original fields for optional use
    promotion: e.promotion || "",
    discount: e.discount || "",
    availability: e.availability || "",
    // unified media field:
    media
  };
}

function pickMedia(e){
  // Prefer explicit video if present, else image
  // Also tolerate mp4 mistakenly placed in image field
  const v = (e.video || "").trim();
  const i = (e.image || "").trim();
  const looksMp4 = (s)=> /\.mp4(\?.*)?$/i.test(s);
  if (v) return v;
  if (i) return i;
  // fallback
  return "images/placeholder.svg";
}

function removePromoPhrases(s) {
  const kill = [
    /\bREGULAR PRICE\b/gi, /\bLOWER PRICE\b/gi, /\bGREAT DEAL\b/gi, /\bBESTSELLER\b/gi,
    /\bSAVE\b/gi, /\bUP TO\b/gi, /\bONLY\b/gi, /\bBOTH FOR\b/gi, /\bEACH\b/gi,
    /\bWHEN YOU BUY\b/gi, /\bBUY( THE)?\b/gi, /\b& GET\b/gi, /\bFREE\b/gi,
    /\bORDER CODE\s+\d{3,10}\b/gi, /\bNOVEMBER\s*2025?\b/gi, /\bOCTOBE?R?\s*2025?\b/gi
  ];
  for (const r of kill) s = s.replace(r, " ").trim();
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
  if (/(serum|cream|spf|day|night|moisturi[sz]er|cleanser|toner|mask|eye cream)/i.test(n)) return "Skincare";
  if (/(foundation|concealer|lip|mascara|eyeliner|brow|palette|blush|powder|nail)/i.test(n)) return "Makeup";
  if (/(tissue oil|body (wash|butter|lotion|cr[eè]me)|shower cr[eè]me|intimate wash|cleansing bar|bath cr[eè]me|bubble bath)/i.test(n)) return "Bath & Body";
  if (/\bmen('|’)?s\b/.test(n)) return "Men's";
  if (/(handbag|watch|earrings|necklace|bracelet|scarf|bag|weekender|pouch|wallet|jewellery|jewelry|bangle|set)/i.test(n)) return "Style Store";
  if (/(derma roller|applicator|tool|brush|grooming set)/i.test(n)) return "Tools";
  return "General";
}
function guessBrand(name) {
  return /tissue oil|justine/i.test(name) ? "Justine" : "Avon";
}
function validProduct(p) {
  if (!p.name || p.name.length < 3) return false;
  // price 25..2000, but allow zero if truly a bundle pseudo-item (we'll hide add if price 0)
  if (!(p.price === 0 || (p.price >= 25 && p.price <= 2000))) return false;
  if (p.code && !/^\d{3,10}$/.test(p.code)) p.code = "";
  if (!p.brand) p.brand = "Avon";
  return true;
}

/** ===== FILTER UI (optional hydration) ===== **/
function hydrateFilterOptions(){
  // If brand/category selects exist and are empty, populate them
  if (els.brand && !els.brand.options.length){
    const brands = Array.from(new Set(state.products.map(p=>p.brand))).sort();
    els.brand.innerHTML = `<option value="all">All brands</option>` + brands.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  }
  if (els.category && !els.category.options.length){
    const cats = Array.from(new Set(state.products.map(p=>p.category))).sort();
    els.category.innerHTML = `<option value="all">All categories</option>` + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }
}

/** ===== MEDIA RENDER ===== **/
function productMediaHTML(p){
  const src = p.media || "";
  const isMp4 = /\.mp4(\?.*)?$/i.test(src);
  if (isMp4){
    // square-friendly container to match your .card .img CSS
    return `
      <div class="img">
        <video autoplay loop muted playsinline class="w-full h-full object-cover">
          <source src="${src}" type="video/mp4">
        </video>
      </div>`;
  }
  return `
    <div class="img">
      <img src="${src || 'images/placeholder.svg'}"
           alt="${escapeHtml(p.name)}"
           onerror="this.onerror=null;this.src='images/placeholder.svg'"/>
    </div>`;
}

/** ===== RENDER GRID ===== **/
function render(){
  if (!els.grid) return;

  const q = (els.search && els.search.value || "").trim().toLowerCase();
  const cat = (els.category && els.category.value) || "all";
  const brand = (els.brand && els.brand.value) || "all";

  let items = [...state.products];

  if (brand && brand !== 'all') items = items.filter(p => p.brand === brand);
  if (cat && cat !== 'all') items = items.filter(p => p.category === cat);
  if (q) {
    items = items.filter(p =>
      [p.name, p.code, p.description, p.brand, p.category].join(' ').toLowerCase().includes(q)
    );
  }

  const sort = (els.sort && els.sort.value) || "featured";
  if (sort === 'price_asc') items.sort((a,b)=>a.price - b.price);
  if (sort === 'price_desc') items.sort((a,b)=>b.price - a.price);
  if (sort === 'alpha') items.sort((a,b)=>a.name.localeCompare(b.name));

  els.grid.innerHTML = '';
  if (!items.length){
    els.empty && els.empty.classList.remove('hidden');
    return;
  } else {
    els.empty && els.empty.classList.add('hidden');
  }

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    const brandBadgeClass = p.brand ? `brand-${p.brand}` : '';

    // hide "Add" if no price
    const canAdd = p.price > 0;

    card.innerHTML = `
      ${productMediaHTML(p)}
      <div class="body">
        <div class="flex items-start justify-between gap-3">
          <h4 class="text-base">${escapeHtml(p.name)}</h4>
          <span class="badge ${brandBadgeClass}">${p.brand || ''}</span>
        </div>
        ${p.description ? `<p class="small mt-1">${escapeHtml(p.description)}</p>` : ''}
        <div class="mt-3 flex items-center justify-between">
          <span class="price">${p.price_text ? escapeHtml(p.price_text) : money(p.price)}</span>
          <span class="small">${p.code ? `Code: ${escapeHtml(p.code)}` : ''}</span>
        </div>
        ${p.promotion ? `<div class="small mt-1">${escapeHtml(p.promotion)}</div>` : ''}
        <button class="add mt-4" data-id="${p.id}" ${!canAdd ? "disabled" : ""}>${canAdd ? "Add to cart" : "Unavailable"}</button>
      </div>
    `;
    els.grid.appendChild(card);
  });

  // Delegated Add buttons
  els.grid.querySelectorAll('.add').forEach(btn => {
    btn.addEventListener('click', (e)=>{
      const id = Number(e.currentTarget.getAttribute('data-id'));
      addToCart(id);
    });
  });
}

/** ===== CART OPS ===== **/
function addToCart(id){
  const p = state.products.find(x => Number(x.id) === Number(id));
  if (!p) return;
  if (!(p.price > 0)) return; // don't add if no price
  const found = state.cart.find(x => x.id === p.id);
  if (found) found.qty += 1;
  else state.cart.push({ id: p.id, brand: p.brand, name: p.name, code: p.code, price: p.price, price_text: p.price_text, qty: 1 });
  saveCart();
  updateCartBadge();
  renderCart();
  openCart();
}

function removeFromCart(id){
  state.cart = state.cart.filter(x => x.id !== id);
  saveCart();
  renderCart();
}

function updateQty(id, delta){
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderCart();
}

/** ===== CART UI (Drawer or Legacy) ===== **/
function openCart(){
  if (els.cartDrawer){
    els.cartDrawer.classList.add('open');
    if (els.cartOverlay) els.cartOverlay.classList.remove('hidden');
    document.body.style.overflow = "hidden";
  } else if (els.cartLegacy){
    els.cartLegacy.classList.add('open');
  }
}
function closeCart(){
  if (els.cartDrawer){
    els.cartDrawer.classList.remove('open');
    if (els.cartOverlay) els.cartOverlay.classList.add('hidden');
    document.body.style.overflow = "";
  } else if (els.cartLegacy){
    els.cartLegacy.classList.remove('open');
  }
}

/** ===== CART RENDER (both UIs) ===== **/
function renderCart(){
  // items container is shared (preferred: #cartItems)
  const itemsEl = els.cartItems || (els.cartLegacy && els.cartLegacy.querySelector('#cartItems'));
  const totalEl = els.cartTotal || els.subtotalLegacy;
  const waBtn = els.checkoutWA || els.waOrderLegacy;

  if (!itemsEl) return;

  if (!state.cart.length){
    itemsEl.innerHTML = `<p class="small">Your cart is empty.</p>`;
    if (totalEl) totalEl.textContent = "R0.00";
    if (waBtn) waBtn.setAttribute("href", buildWhatsAppURL());
    updateCartBadge();
    return;
  }

  let html = "";
  state.cart.forEach(item => {
    const line = item.price * item.qty;
    html += `
      <div class="cart-item">
        <div>
          <div class="font-semibold">${escapeHtml(item.name)}</div>
          <div class="small">${[item.brand, item.code ? `Code: ${escapeHtml(item.code)}` : ''].filter(Boolean).join(' • ')}</div>
          <div class="small">${(item.price_text || money(item.price))} × ${item.qty} = <span class="font-semibold">${money(line)}</span></div>
          <div class="remove mt-1" data-id="${item.id}">Remove</div>
          <hr class="sep" />
        </div>
        <div class="qty">
          <button data-id="${item.id}" data-delta="-1">−</button>
          <span>${item.qty}</span>
          <button data-id="${item.id}" data-delta="1">+</button>
        </div>
      </div>
    `;
  });

  itemsEl.innerHTML = html;
  if (totalEl) totalEl.textContent = money(cartSum());

  // Update WA anchor (preferred drawer) with full message
  if (waBtn && waBtn.tagName === "A") {
    waBtn.setAttribute("href", buildWhatsAppURL());
    waBtn.setAttribute("target", "_blank");
    waBtn.setAttribute("rel", "noopener");
  }

  // Legacy buttons (click handlers)
  if (els.waOrderLegacy) on(els.waOrderLegacy, "click", (e)=>{ e.preventDefault(); sendWhatsApp(); });
  if (els.emailOrderLegacy) on(els.emailOrderLegacy, "click", (e)=>{ e.preventDefault(); sendEmail(); });

  // Row interactions
  itemsEl.querySelectorAll('.remove').forEach(a=>{
    a.addEventListener('click', (e)=>removeFromCart(Number(e.currentTarget.getAttribute('data-id'))));
  });
  itemsEl.querySelectorAll('.qty button').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const id = Number(e.currentTarget.getAttribute('data-id'));
      const delta = Number(e.currentTarget.getAttribute('data-delta'));
      updateQty(id, delta);
    });
  });

  updateCartBadge();
}

/** ===== CHECKOUT MESSAGE ===== **/
function buildMessage(){
  const lines = [];
  lines.push(`*New Order — Avon + Justine Shop*`);
  lines.push('');
  state.cart.forEach(i=>{
    const priceText = i.price_text || money(i.price);
    lines.push(`• ${i.brand ? `[${i.brand}] ` : ''}${i.name} ${i.code ? `(Code ${i.code}) ` : ''}× ${i.qty} — ${priceText}`);
  });
  const total = cartSum();
  lines.push('');
  lines.push(`*Subtotal:* ${money(total)}`);
  lines.push('');

  // Optional customer fields
  const name = els.custName && els.custName.value || '';
  const phone = els.custPhone && els.custPhone.value || '';
  const email = els.custEmail && els.custEmail.value || '';
  const addr = els.custAddress && els.custAddress.value || '';
  const notes = els.custNotes && els.custNotes.value || '';

  if (name || phone || email || addr || notes){
    lines.push(`*Customer*`);
    if (name) lines.push(`Name: ${name}`);
    if (phone) lines.push(`Phone: ${phone}`);
    if (email) lines.push(`Email: ${email}`);
    if (addr) lines.push(`Address: ${addr}`);
    if (notes) lines.push(`Notes: ${notes}`);
    lines.push('');
  }

  lines.push('_Sent from my storefront._');
  return encodeURIComponent(lines.join('\n'));
}

function buildWhatsAppURL(){
  if (!state.cart.length){
    return WA_BASE + encodeURIComponent("Hi! I'd like to order, but my cart is empty.");
  }
  return WA_BASE + buildMessage();
}

function sendWhatsApp(){
  if (!state.cart.length){ alert('Your cart is empty.'); return; }
  window.open(buildWhatsAppURL(), '_blank');
}

function sendEmail(){
  if (!state.cart.length){ alert('Your cart is empty.'); return; }
  const to = ''; // optional: your email here
  const subject = encodeURIComponent("New Order — Avon + Justine Shop");
  const body = decodeURIComponent(buildMessage()); // use plain text in email body
  const mailto = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

/** ===== INIT & EVENTS ===== **/
function attachFilters(){
  // Search / Sort always if present
  on(els.search, 'input', render);
  on(els.sort, 'change', render);

  // Optional brand/category selects
  on(els.brand, 'change', render);
  on(els.category, 'change', render);
}

function attachCartUI(){
  // Header cart button
  on(els.cartBtn, 'click', (e)=>{ e.preventDefault(); openCart(); });

  // Close actions
  on(els.closeCartBtn, 'click', (e)=>{ e.preventDefault(); closeCart(); });
  on(els.cartOverlay, 'click', (e)=>{ e.preventDefault(); closeCart(); });

  // Legacy buttons wired in renderCart() (to keep href in drawer variant)
}

window.addEventListener("DOMContentLoaded", async ()=>{
  loadCart();
  updateCartBadge();
  attachFilters();
  attachCartUI();
  await loadProducts();
  renderCart(); // show persisted cart
});
