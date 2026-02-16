(function () {
  const gallery = document.querySelector('.gallery');
  if (!gallery) return;

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('data-open', '0');
  const img = document.createElement('img');
  lb.appendChild(img);
  document.body.appendChild(lb);

  function close() {
    lb.setAttribute('data-open', '0');
    img.removeAttribute('src');
  }

  gallery.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    const src = t.getAttribute('src');
    if (!src) return;
    img.setAttribute('src', src);
    lb.setAttribute('data-open', '1');
  });

  lb.addEventListener('click', () => close());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

