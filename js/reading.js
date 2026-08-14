(() => {
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);

  const formatDuration = seconds => {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return hours ? `${hours}小时${minutes ? `${minutes}分` : ''}` : `${minutes}分钟`;
  };

  const formatDate = timestamp => {
    if (!timestamp) return '';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).replaceAll('/', '-');
  };

  const formatCompactDuration = seconds => {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    if (hours) return `${hours}时${minutes ? `${minutes}分` : ''}`;
    return `${minutes}分`;
  };

  const empty = message => `<div class="reading-inline-empty">${escapeHTML(message)}</div>`;

  const renderStats = data => {
    const summary = data.summary || {};
    const visibleBookCount = (data.books || []).filter(book => book.cover).slice(0, 9).length;
    const cards = [
      [visibleBookCount, '公开书架'],
      [summary.finishedCount || 0, '已读完'],
      [formatDuration(summary.yearReadTime), `${data.year} 年阅读`],
      [summary.yearReadDays || 0, `${data.year} 年阅读天数`]
    ];
    document.querySelector('#reading-stats').innerHTML = cards.map(([value, label]) => `
      <article class="reading-stat"><strong>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span></article>
    `).join('');
  };

  const renderMonths = data => {
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const values = Array.from({ length: 7 }, (_, index) => Number(data.weekdayReadTimes?.[index]) || 0);
    const max = Math.max(...values, 1);
    const rangeTarget = document.querySelector('#reading-week-range');
    if (rangeTarget) {
      const start = data.weekStart ? new Date(Number(data.weekStart) * 1000) : null;
      const end = start ? new Date(start.getTime() + 6 * 86400000) : null;
      rangeTarget.textContent = start && end
        ? `${start.getMonth() + 1}.${start.getDate()} — ${end.getMonth() + 1}.${end.getDate()}`
        : '';
    }
    document.querySelector('#reading-months').innerHTML = values.map((seconds, index) => `
      <div class="reading-month" title="${labels[index]}：${formatDuration(seconds)}">
        <span class="reading-month-value">${formatCompactDuration(seconds)}</span>
        <div class="reading-month-bar" style="height:${Math.max(3, Math.round(seconds / max * 70))}px"></div>
        <span class="reading-month-label">${labels[index]}</span>
      </div>
    `).join('');
  };

  const renderCategories = data => {
    const categories = (data.categories || []).slice(0, 6);
    const target = document.querySelector('#reading-categories');
    if (!categories.length) {
      target.innerHTML = empty('暂无偏好统计');
      return;
    }
    const max = Math.max(...categories.map(item => Number(item.value) || 0), 1);
    target.innerHTML = categories.map(item => `
      <div class="reading-category">
        <div class="reading-category-head"><span>${escapeHTML(item.name)}</span><span>${formatDuration(item.readingTime)}</span></div>
        <div class="reading-category-track"><div class="reading-category-fill" style="width:${Math.max(4, (Number(item.value) || 0) / max * 100)}%"></div></div>
      </div>
    `).join('');
  };

  const renderBooks = (data, filter = 'all') => {
    const booksWithCovers = (data.books || []).filter(book => book.cover);
    const books = filter === 'finished'
      ? booksWithCovers.filter(book => book.status === 'finished')
      : filter === 'reading'
        ? booksWithCovers.filter(book => book.status === 'reading').slice(0, 9)
        : booksWithCovers.slice(0, 9);
    const target = document.querySelector('#reading-books');
    if (!books.length) {
      target.innerHTML = empty(filter === 'all' ? '暂无公开书架数据' : '这个分类还没有书');
      return;
    }
    target.innerHTML = books.map(book => {
      const content = `
        <div class="reading-book-cover">
          ${book.cover ? `<img src="${escapeHTML(book.cover)}" alt="${escapeHTML(book.title)}封面" loading="lazy">` : ''}
          ${book.kind === 'audio' ? '<span class="reading-book-kind">听书</span>' : ''}
          <span class="reading-book-status">${book.status === 'finished' ? '读完' : '在读'}</span>
        </div>
        <h3 class="reading-book-title" title="${escapeHTML(book.title)}">${escapeHTML(book.title)}</h3>
        <p class="reading-book-author">${escapeHTML(book.author || '佚名')}</p>`;
      return book.deepLink
        ? `<a class="reading-book" href="${escapeHTML(book.deepLink)}" rel="noopener">${content}</a>`
        : `<article class="reading-book">${content}</article>`;
    }).join('');
  };

  const renderHighlights = data => {
    const highlights = (data.highlights || []).slice(0, 10);
    document.querySelector('#reading-highlight-count').textContent = highlights.length ? `${highlights.length} 条公开摘录` : '';
    const target = document.querySelector('#reading-highlights');
    if (!highlights.length) {
      target.innerHTML = empty('暂无公开划线');
      return;
    }
    target.innerHTML = highlights.map(item => `
      <article class="reading-highlight">
        <blockquote>${escapeHTML(item.text)}</blockquote>
        <div class="reading-highlight-meta">
          <span><span class="reading-highlight-book">《${escapeHTML(item.bookTitle)}》</span>${item.chapter ? ` · ${escapeHTML(item.chapter)}` : ''}</span>
          <time>${formatDate(item.createTime)}</time>
        </div>
      </article>
    `).join('');
  };

  const setupHighlightScroller = () => {
    const target = document.querySelector('#reading-highlights');
    const cards = [...(target?.querySelectorAll('.reading-highlight') || [])];
    clearInterval(window.readingHighlightTimer);
    if (!target || cards.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let index = 0;
    let paused = false;
    const setPaused = value => { paused = value; };
    target.addEventListener('pointerenter', () => setPaused(true));
    target.addEventListener('pointerleave', () => setPaused(false));
    target.addEventListener('focusin', () => setPaused(true));
    target.addEventListener('focusout', () => setPaused(false));
    window.readingHighlightTimer = setInterval(() => {
      if (paused) return;
      index = (index + 1) % cards.length;
      target.scrollTo({
        top: index === 0 ? 0 : cards[index].offsetTop - target.offsetTop,
        behavior: 'smooth'
      });
    }, 5000);
  };

  const init = async () => {
    const app = document.querySelector('#reading-app');
    if (!app || app.dataset.ready === 'true') return;
    app.dataset.ready = 'true';
    try {
      const response = await fetch('/reading/data.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('reading data unavailable');
      const data = await response.json();
      const hasData = data.generatedAt || data.books?.length || data.highlights?.length;
      document.querySelector('#reading-updated').textContent = data.generatedAt
        ? `数据更新于 ${new Date(data.generatedAt).toLocaleString('zh-CN')}`
        : '等待第一次数据同步';
      document.querySelector('#reading-year').textContent = `${data.year || new Date().getFullYear()} · YEAR IN BOOKS`;
      renderStats(data);
      renderMonths(data);
      renderCategories(data);
      renderBooks(data);
      renderHighlights(data);
      setupHighlightScroller();
      document.querySelector('#reading-empty').hidden = Boolean(hasData);
      document.querySelectorAll('[data-reading-filter]').forEach(button => {
        button.addEventListener('click', () => {
          document.querySelectorAll('[data-reading-filter]').forEach(item => item.classList.toggle('is-active', item === button));
          renderBooks(data, button.dataset.readingFilter);
        });
      });
    } catch (error) {
      document.querySelector('#reading-updated').textContent = '阅读数据暂时无法加载';
      document.querySelector('#reading-empty').hidden = false;
    }
  };

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
  if (document.readyState !== 'loading') init();
})();
