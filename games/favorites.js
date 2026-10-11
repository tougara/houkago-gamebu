(() => {
  'use strict';

  const storageKey = 'houkago_game_favorites_v1';
  const descriptions = {
    'nise-transfer-student': '役職の情報と話し合いでニセモノを見つけよう',
    'minna-wa-docchi': '2択のお題で、みんなの考えの違いを楽しもう',
    'kankaku-meter': '感覚を合わせて、みんなで協力しよう',
    'kyokasho-tower': '教科書の置き方を考えて勝負しよう',
    'gesture-battle': 'ジェスチャーでお題を伝えて盛り上がろう',
    'pitadome-challenge': 'タイミングを見極めてピタッと止めよう',
    'link-burst': '同じ色をつなげて爽快な連鎖を決めよう'
  };

  const cardById = new Map();
  const favoriteButtons = [];
  const featuredSection = document.querySelector('.featured-game');
  const featuredLink = featuredSection.querySelector('.featured-card');
  const featuredArt = featuredLink.querySelector('.featured-art');
  const featuredImage = featuredArt.querySelector('img');
  const featuredTitle = featuredLink.querySelector('.featured-copy strong');
  const featuredDescription = featuredLink.querySelector('.featured-copy span');
  const featuredMeta = featuredLink.querySelector('.featured-meta');
  const filters = Array.from(document.querySelectorAll('[data-game-filter]'));
  const count = document.getElementById('gameCount');
  const empty = document.getElementById('favoritesEmpty');

  function makeFavoriteButton(id, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-toggle';
    button.dataset.favoriteId = id;
    button.dataset.favoriteName = name;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="12 2.6 15 8.6 21.7 9.6 16.9 14.4 18.1 21.1 12 17.9 5.9 21.1 7.1 14.4 2.3 9.6 9 8.6 12 2.6"></polygon></svg>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(button.dataset.favoriteId);
    });
    favoriteButtons.push(button);
    return button;
  }

  // Keep navigation links and favorite buttons as siblings, not nested controls.
  document.querySelectorAll('.compact-game-grid > a.compact-game-card[href]').forEach((card) => {
    const id = card.getAttribute('href').replace(/\/$/, '');
    const name = card.querySelector('h2').textContent.trim();
    const wrap = document.createElement('div');
    wrap.className = 'favorite-card-wrap compact-card-wrap';
    wrap.dataset.gameCard = '';
    wrap.dataset.categories = card.dataset.categories || '';
    wrap.dataset.gameId = id;
    card.removeAttribute('data-game-card');
    card.before(wrap);
    wrap.appendChild(card);
    wrap.appendChild(makeFavoriteButton(id, name));
    cardById.set(id, card);
  });

  const featureWrap = document.createElement('div');
  featureWrap.className = 'favorite-card-wrap featured-card-wrap';
  featuredLink.before(featureWrap);
  featureWrap.appendChild(featuredLink);
  const featureStar = makeFavoriteButton('nise-transfer-student', 'ニセ転校生を探せ！');
  featureWrap.appendChild(featureStar);

  function readFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(raw)) return [];
      return [...new Set(raw.filter((id) => cardById.has(id)))];
    } catch (_) {
      return [];
    }
  }

  let favorites = readFavorites();
  let activeFilter = 'all';

  function showFeaturedGame(id) {
    const card = cardById.get(id);
    if (!card) return;
    const name = card.querySelector('h2').textContent.trim();
    const sourceArt = card.querySelector('.compact-game-art');
    const sourceImage = sourceArt.querySelector('img');
    const bg = getComputedStyle(sourceArt);

    featuredLink.href = card.getAttribute('href');
    featuredImage.src = sourceImage.src;
    featuredImage.alt = name;
    featuredTitle.textContent = name;
    featuredDescription.textContent = descriptions[id] || '';
    featuredArt.className = 'featured-art';
    featuredArt.style.backgroundImage = bg.backgroundImage;
    featuredArt.style.backgroundPosition = bg.backgroundPosition;
    featuredArt.style.backgroundSize = bg.backgroundSize;
    featuredArt.style.backgroundRepeat = bg.backgroundRepeat;
    featuredArt.style.backgroundColor = bg.backgroundColor;

    featuredMeta.replaceChildren();
    card.querySelectorAll('.compact-tags span').forEach((tag) => {
      const item = document.createElement('span');
      item.textContent = tag.textContent;
      featuredMeta.appendChild(item);
    });

    featureStar.dataset.favoriteId = id;
    featureStar.dataset.favoriteName = name;
  }

  function refresh() {
    const recommendedId = favorites.length ? favorites[favorites.length - 1] : 'nise-transfer-student';
    showFeaturedGame(recommendedId);

    favoriteButtons.forEach((button) => {
      const selected = favorites.includes(button.dataset.favoriteId);
      button.classList.toggle('is-favorite', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', button.dataset.favoriteName +
        (selected ? 'のお気に入り登録を解除' : 'をお気に入りに登録'));
      button.title = selected ? 'お気に入りを解除' : 'お気に入りに登録';
    });

    filters.forEach((filter) => {
      const selected = filter.dataset.gameFilter === activeFilter;
      filter.classList.toggle('selected', selected);
      filter.setAttribute('aria-pressed', String(selected));
    });

    let visible = 0;
    document.querySelectorAll('[data-game-card]').forEach((card) => {
      const categories = (card.dataset.categories || '').split(' ');
      const id = card.dataset.gameId;
      const show = activeFilter === 'all' ||
        (activeFilter === 'favorites' ? !!id && favorites.includes(id) : categories.includes(activeFilter));
      card.hidden = !show;
      if (show) visible++;
    });
    count.textContent = String(visible);
    empty.hidden = activeFilter !== 'favorites' || visible !== 0;
    // When filtering favorites, never show an unrelated default recommendation.
    featuredSection.hidden = activeFilter === 'favorites' && favorites.length === 0;
  }

  function toggleFavorite(id) {
    if (!cardById.has(id)) return;
    favorites = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    try {
      localStorage.setItem(storageKey, JSON.stringify(favorites));
    } catch (_) {
      // In restricted browsing contexts, keep favorites for this page.
    }
    refresh();
  }

  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      activeFilter = filter.dataset.gameFilter;
      refresh();
    });
  });

  refresh();
})();