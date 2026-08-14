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

  const empty = message => `<div class="reading-inline-empty">${escapeHTML(message)}</div>`;

  const renderStats = data => {
    const summary = data.summary || {};
    const cards = [
      [summary.shelfCount || data.books.length, '公开书架'],
      [summary.finishedCount || 0, '已读完'],
      [formatDuration(summary.yearReadTime), `${data.year} 年阅读`],
      [summary.yearReadDays || 0, `${data.year} 年阅读天数`]
    ];
    document.querySelector('#reading-stats').innerHTML = cards.map(([value, label]) => `
      <article class="reading-stat"><strong>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span></article>
    `).join('');
  };

  const renderMonths = data => {
    const values = Array.from({ length: 12 }, (_, index) => Number(data.monthlyReadTimes?.[index]) || 0);
    const max = Math.max(...values, 1);
    document.querySelector('#reading-months').innerHTML = values.map((seconds, index) => `
      <div class="reading-month" title="${index + 1}月：${formatDuration(seconds)}">
        <div class="reading-month-bar" style="height:${Math.max(3, Math.round(seconds / max * 150))}px"></div>
        <span class="reading-month-label">${index + 1}</span>
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
    const books = (data.books || []).filter(book => filter === 'all' || book.status === filter);
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
    const highlights = data.highlights || [];
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
