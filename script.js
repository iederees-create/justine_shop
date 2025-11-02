// =========================
// RENDER PRODUCTS FROM JSON
// =========================
async function loadProducts() {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  try {
    const res = await fetch("products.json");
    const products = await res.json();

    if (!Array.isArray(products)) {
      console.error("Expected array in products.json");
      return;
    }

    // Render product cards
    grid.innerHTML = "";
    products.forEach((p) => {
      const card = document.createElement("div");
      card.className = "product-card";

      // Detect image or video
      const isVideo = p.image?.endsWith(".mp4");

      const media = isVideo
        ? `<video autoplay loop muted playsinline class="product-media">
             <source src="${p.image}" type="video/mp4">
           </video>`
        : `<img src="${p.image}" alt="${p.name}" class="product-media">`;

      card.innerHTML = `
        <div class="product-media">${media}</div>
        <div class="p-4 flex flex-col grow">
          <h3 class="font-semibold text-lg mb-1">${p.name}</h3>
          <p class="text-sm text-white/70 mb-2">${p.description || ""}</p>
          <div class="mt-auto">
            <p class="font-bold text-[var(--accent)]">${p.price}</p>
            ${p.promotion ? `<p class="text-xs text-white/60">${p.promotion}</p>` : ""}
          </div>
          <div class="flex justify-between items-center mt-4">
            <button class="bg-[var(--accent)] text-black px-3 py-1 rounded-lg text-sm font-semibold hover:bg-[var(--accent-dark)] transition addCartBtn">Add</button>
            <button class="text-xs text-white/70 hover:text-[var(--accent)] transition shareBtn">Share</button>
          </div>
        </div>
      `;

      // Share button
      const shareBtn = card.querySelector(".shareBtn");
      shareBtn.addEventListener("click", () => openShareModal(p));

      grid.appendChild(card);
    });

    // Handle empty state
    empty.classList.toggle("hidden", grid.children.length > 0);

  } catch (err) {
    console.error("Error loading products.json:", err);
    empty.textContent = "Error loading products.";
    empty.classList.remove("hidden");
  }
}

// =========================
// SHARE MODAL HANDLER
// =========================
function openShareModal(product) {
  const modal = document.getElementById("shareModal");
  const caption = document.getElementById("shareCaption");

  caption.innerText = product.social?.caption || "";
  modal.classList.remove("hidden");

  // Update share links
  document.getElementById("shareTikTok").href = product.social?.share_links?.tiktok || "#";
  document.getElementById("shareInstagram").href = product.social?.share_links?.instagram || "#";
  document.getElementById("shareFacebook").href = product.social?.share_links?.facebook || "#";
  document.getElementById("shareWhatsApp").href = product.social?.share_links?.whatsapp || "#";
}

// =========================
// FILTERS (Search + Sort)
// =========================
document.getElementById("search").addEventListener("input", filterProducts);
document.getElementById("sort").addEventListener("change", filterProducts);

async function filterProducts() {
  const res = await fetch("products.json");
  const products = await res.json();
  const searchTerm = document.getElementById("search").value.toLowerCase();
  const sortOption = document.getElementById("sort").value;

  let filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm) ||
    (p.category && p.category.toLowerCase().includes(searchTerm))
  );

  // Sorting
  if (sortOption === "price_asc") {
    filtered.sort((a, b) => parseFloat(a.price.replace(/[^\d.]/g, "")) - parseFloat(b.price.replace(/[^\d.]/g, "")));
  } else if (sortOption === "price_desc") {
    filtered.sort((a, b) => parseFloat(b.price.replace(/[^\d.]/g, "")) - parseFloat(a.price.replace(/[^\d.]/g, "")));
  } else if (sortOption === "alpha") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Re-render
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const isVideo = p.image?.endsWith(".mp4");
    const media = isVideo
      ? `<video autoplay loop muted playsinline class="product-media">
           <source src="${p.image}" type="video/mp4">
         </video>`
      : `<img src="${p.image}" alt="${p.name}" class="product-media">`;

    card.innerHTML = `
      <div class="product-media">${media}</div>
      <div class="p-4 flex flex-col grow">
        <h3 class="font-semibold text-lg mb-1">${p.name}</h3>
        <p class="text-sm text-white/70 mb-2">${p.description || ""}</p>
        <div class="mt-auto">
          <p class="font-bold text-[var(--accent)]">${p.price}</p>
          ${p.promotion ? `<p class="text-xs text-white/60">${p.promotion}</p>` : ""}
        </div>
        <div class="flex justify-between items-center mt-4">
          <button class="bg-[var(--accent)] text-black px-3 py-1 rounded-lg text-sm font-semibold hover:bg-[var(--accent-dark)] transition addCartBtn">Add</button>
          <button class="text-xs text-white/70 hover:text-[var(--accent)] transition shareBtn">Share</button>
        </div>
      </div>
    `;

    const shareBtn = card.querySelector(".shareBtn");
    shareBtn.addEventListener("click", () => openShareModal(p));

    grid.appendChild(card);
  });

  document.getElementById("empty").classList.toggle("hidden", grid.children.length > 0);
}

// =========================
// INITIAL LOAD
// =========================
window.addEventListener("DOMContentLoaded", loadProducts);
