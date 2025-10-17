
const WA_NUMBER = "27845272182"; // your WhatsApp destination (international format, no +)
const WA_BASE = `https://wa.me/${WA_NUMBER}?text=`;

let state = {
  products: [],
  cart: []
};

const els = {
  grid: document.getElementById('grid'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
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

async function loadProducts(){
  const res = await fetch('products.json');
  const data = await res.json();
  state.products = data;
  render();
}

function render(){
  const q = els.search.value.trim().toLowerCase();
  const cat = els.category.value;
  let items = [...state.products];

  if (cat && cat !== 'all'){
    items = items.filter(p => p.category === cat);
  }
  if (q){
    items = items.filter(p =>
      [p.name, p.code, p.description].join(' ').toLowerCase().includes(q)
    );
  }
  const sort = els.sort.value;
  if (sort === 'price_asc') items.sort((a,b)=>a.price - b.price);
  if (sort === 'price_desc') items.sort((a,b)=>b.price - a.price);
  if (sort === 'alpha') items.sort((a,b)=>a.name.localeCompare(b.name));

  els.grid.innerHTML = '';
  if (!items.length){
    els.empty.classList.remove('hidden');
    return;
  } else {
    els.empty.classList.add('hidden');
  }

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="img">${p.image ? `<img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover"/>` : 'Add image'}</div>
      <div class="body">
        <div class="flex items-start justify-between gap-3">
          <h4 class="text-base">${p.name}</h4>
          <span class="badge">${p.category}</span>
        </div>
        <p class="small mt-1">${p.description || ''}</p>
        <div class="mt-3 flex items-center justify-between">
          <span class="price">R${p.price.toFixed(2)}</span>
          <span class="small">Code: ${p.code}</span>
        </div>
        <button class="add mt-4" data-id="${p.id}">Add to cart</button>
      </div>
    `;
    els.grid.appendChild(card);
  });

  // attach add handlers
  els.grid.querySelectorAll('.add').forEach(btn => {
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.getAttribute('data-id');
      addToCart(id);
    });
  });
}

function addToCart(id){
  const p = state.products.find(x => String(x.id) === String(id));
  if (!p) return;
  const found = state.cart.find(x => x.id === p.id);
  if (found) found.qty += 1;
  else state.cart.push({ ...p, qty: 1 });
  updateCart();
  openCart();
}

function removeFromCart(id){
  state.cart = state.cart.filter(x => x.id !== id);
  updateCart();
}

function updateQty(id, delta){
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  updateCart();
}

function money(n){ return `R${n.toFixed(2)}` }

function updateCart(){
  els.cartItems.innerHTML = '';
  let subtotal = 0;
  state.cart.forEach(item => {
    const line = item.price * item.qty;
    subtotal += line;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div class="font-semibold">${item.name}</div>
        <div class="small">Code: ${item.code}</div>
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
  els.cartCount.textContent = state.cart.reduce((s,x)=>s+x.qty,0);

  // bind remove & qty
  els.cartItems.querySelectorAll('.remove').forEach(a=>{
    a.addEventListener('click', (e)=>removeFromCart(Number(e.currentTarget.getAttribute('data-id'))));
  });
  els.cartItems.querySelectorAll('.qty button').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const id = Number(e.currentTarget.getAttribute('data-id'));
      const delta = Number(e.currentTarget.getAttribute('data-delta'));
      updateQty(id, delta);
    });
  });
}

function openCart(){ els.cart.classList.add('open'); }
function closeCart(){ els.cart.classList.remove('open'); }

function buildMessage(){
  const lines = [];
  lines.push(`*New Order — Justine Shop*`);
  lines.push('');
  state.cart.forEach(i=>{
    lines.push(`• ${i.name} (Code ${i.code}) × ${i.qty} — R${(i.price*i.qty).toFixed(2)}`);
  });
  const total = state.cart.reduce((s,x)=>s+x.price*x.qty,0);
  lines.push(``);
  lines.push(`*Subtotal:* R${total.toFixed(2)}`);
  lines.push(``);
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

function sendWhatsApp(){
  if (!state.cart.length){ alert('Your cart is empty.'); return; }
  const url = WA_BASE + buildMessage();
  window.open(url, '_blank');
}

function sendEmail(){
  if (!state.cart.length){ alert('Your cart is empty.'); return; }
  const to = ''; // optional: set your email
  const subject = encodeURIComponent("New Order — Justine Shop");
  const body = buildMessage();
  const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
}

// Events
els.search.addEventListener('input', render);
els.category.addEventListener('change', render);
els.sort.addEventListener('change', render);
els.cartBtn.addEventListener('click', openCart);
els.closeCart.addEventListener('click', closeCart);
els.waOrder.addEventListener('click', sendWhatsApp);
els.emailOrder.addEventListener('click', sendEmail);

// Init
loadProducts();
