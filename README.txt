
Justine Shop — Static Storefront
================================

What you have
-------------
- index.html  — storefront with search, filters, and a cart drawer
- style.css   — clean “framed/hero” aesthetic on black
- script.js   — product rendering, cart, and WhatsApp checkout
- products.json — sample seed products (codes & prices from Oct 2025 brochure)
- C10 October Brochure 2025_LR.pdf — linkable from the navbar (put this file next to index.html)
- images/     — add your own images into images/products/*.jpg and images/hero.jpg

How to use
----------
1) Copy the entire folder to your hosting (GitHub Pages, Netlify, Render static, or your own server).
2) Open script.js and set WA_NUMBER to your WhatsApp number if different.
3) Replace placeholder images in /images/products and the hero.jpg.
4) Edit products.json to add/remove items. Keep fields: id, name, code, price, category, image, description.
5) (Optional) Change copy, FAQ, and footer in index.html to your own voice & terms.

Checkout flow
-------------
- Customers add items, open the cart, enter details, and press “Order via WhatsApp”.
- The site opens a WhatsApp chat prefilled with their order + details.
- You can confirm delivery and payment on WhatsApp (EFT/cash/collection).
- “Order via Email” uses a mailto: link with the same order text.

Notes
-----
- All prices here are seeded from the October 2025 brochure and are for example. Update monthly.
- This is an independent consultant page; not an official Avon Justine site.
