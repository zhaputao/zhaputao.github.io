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
    const visibleBookCount = (data.books || []).length;
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
    const books = (data.books || []).filter(book => filter === 'all' || book.status === filter);
    const target = document.querySelector('#reading-books');
    const more = document.querySelector('#reading-more');
    if (target.dataset.filter !== filter) {
      target.dataset.expanded = 'false';
      target.dataset.filter = filter;
    }
    more.hidden = true;
    more.onclick = null;
    document.querySelector('#reading-book-count').textContent = `${books.length} 本书`;
    if (!books.length) {
      target.innerHTML = empty(filter === 'all' ? '暂无公开书架数据' : '这个分类还没有书');
      return;
    }
    const palette = ['#344b43', '#747953', '#943f35', '#344b65', '#8b6a4b', '#645367', '#a18d70', '#475959'];
    const perRow = Math.max(3, Math.floor((target.clientWidth - 32) / 40));
    const rows = [];
    for (let offset = 0; offset < books.length; offset += perRow) {
      rows.push(`<div class="reading-shelf-row">${books.slice(offset, offset + perRow).map((book, index) => {
        const seed = [...String(book.bookId || book.title)].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 0);
        const title = escapeHTML(book.title);
        const status = book.kind === 'audio' ? '有声书' : book.status === 'finished' ? '已读完' : '正在读';
        return `<article class="reading-book${index >= perRow - 3 ? ' reading-book-end' : ''}" style="--spine-color:${palette[seed % palette.length]};--book-height:${142 + seed % 36}px">
          <button type="button" class="reading-book-spine" aria-label="查看《${title}》封面，${status}" aria-expanded="false">
            <span class="reading-spine-title">${title}</span><span class="reading-spine-author">${escapeHTML(book.author || '佚名')}</span><i class="reading-spine-dot${book.status === 'finished' ? ' is-finished' : ''}"></i>
          </button>
          <div class="reading-book-preview">
            <div class="reading-book-cover">${book.cover ? `<img src="${escapeHTML(book.cover)}" alt="${title}封面" loading="lazy">` : `<span class="reading-cover-fallback">${title}</span>`}</div>
            <div class="reading-book-caption"><strong>${title}</strong><span>${escapeHTML(book.author || '佚名')} · ${status}</span>${book.deepLink && /^(https?:|weread:)/i.test(book.deepLink) ? `<a href="${escapeHTML(book.deepLink)}" rel="noopener">打开阅读 ↗</a>` : ''}</div>
          </div>
        </article>`;
      }).join('')}</div>`);
    }
    target.innerHTML = rows.join('');
    const updateExpansion = () => {
      const expanded = target.dataset.expanded === 'true';
      target.querySelectorAll('.reading-shelf-row').forEach((row, index) => {
        row.hidden = !expanded && index >= 3;
      });
      more.hidden = rows.length <= 3;
      more.setAttribute('aria-expanded', String(expanded));
      more.textContent = expanded ? '收起书架 ↑' : '更多 ↓';
    };
    more.onclick = () => {
      const collapsing = target.dataset.expanded === 'true';
      target.dataset.expanded = String(!collapsing);
      updateExpansion();
      if (collapsing) more.scrollIntoView({ block: 'nearest' });
    };
    updateExpansion();
    target.querySelectorAll('.reading-book-spine').forEach(button => {
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        target.querySelectorAll('.reading-book-spine').forEach(other => other.setAttribute('aria-expanded', 'false'));
        button.setAttribute('aria-expanded', String(expanded));
      });
    });
    target.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = 'reading-cover-fallback';
      fallback.textContent = img.alt.replace(/封面$/, '');
      img.replaceWith(fallback);
    }));
  };

  const renderTimeline = data => {
    const now = new Date();
    const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(now));
    const month = Number(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'Asia/Shanghai' }).format(now));
    const history = data.readingTimeline || [{ year: data.year, months: data.monthlyReadTimes }];
    const years = [year - 2, year - 1, year];
    const max = Math.max(1, ...history.filter(item => years.includes(item.year)).flatMap(item => item.months || []).filter(Number.isFinite));
    const updated = data.generatedAt ? new Date(data.generatedAt) : null;
    const syncedMonth = updated ? Number(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'Asia/Shanghai' }).format(updated)) : 0;
    const syncedYear = updated ? Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(updated)) : 0;
    document.querySelector('#reading-timeline-range').textContent = `${years[0]} — ${year}`;
    document.querySelector('#reading-timeline-grid').innerHTML = '<span></span>' + Array.from({ length: 12 }, (_, i) => `<span class="reading-timeline-month">${i + 1}月</span>`).join('') + years.map(value => {
      const months = history.find(item => Number(item.year) === value)?.months;
      return `<span class="reading-timeline-year">${value}</span>` + Array.from({ length: 12 }, (_, i) => {
        const future = value === year && i + 1 > month;
        const stale = value > syncedYear || (value === syncedYear && i + 1 > syncedMonth);
        const seconds = months?.[i];
        const missing = !Number.isFinite(seconds) || stale;
        const label = `${value}年${i + 1}月：${future ? '尚未到来' : missing ? '尚未同步' : formatDuration(seconds)}`;
        const level = future ? 'future' : missing ? 'missing' : seconds > 0 ? Math.max(1, Math.ceil(seconds / max * 4)) : 0;
        return `<button type="button" class="reading-timeline-cell" data-level="${level}" aria-label="${label}" title="${label}"></button>`;
      }).join('');
    }).join('');
    document.querySelectorAll('.reading-timeline-cell').forEach(cell => {
      const show = () => { document.querySelector('#reading-timeline-detail').textContent = cell.getAttribute('aria-label'); };
      cell.addEventListener('pointerenter', show);
      cell.addEventListener('focus', show);
      cell.addEventListener('click', show);
    });
  };

  const renderHighlights = data => {
    const highlights = (data.highlights || []).slice(0, 15);
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
      let activeFilter = 'all';
      renderBooks(data);
      renderTimeline(data);
      window.readingShelfObserver?.disconnect();
      let shelfWidth = document.querySelector('#reading-books').clientWidth;
      window.readingShelfObserver = new ResizeObserver(entries => {
        const width = Math.round(entries[0].contentRect.width);
        if (Math.abs(width - shelfWidth) < 2) return;
        shelfWidth = width;
        renderBooks(data, activeFilter);
      });
      window.readingShelfObserver.observe(document.querySelector('#reading-books'));
      app.addEventListener('click', event => {
        if (!event.target.closest('.reading-book')) {
          app.querySelectorAll('.reading-book-spine').forEach(button => button.setAttribute('aria-expanded', 'false'));
        }
      });
      app.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          app.querySelectorAll('.reading-book-spine').forEach(button => button.setAttribute('aria-expanded', 'false'));
          document.activeElement?.blur();
        }
      });
      renderHighlights(data);
      setupHighlightScroller();
      document.querySelector('#reading-empty').hidden = Boolean(hasData);
      document.querySelectorAll('[data-reading-filter]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.readingFilter === 'all'));
        button.addEventListener('click', () => {
          document.querySelectorAll('[data-reading-filter]').forEach(item => {
            item.classList.toggle('is-active', item === button);
            item.setAttribute('aria-pressed', String(item === button));
          });
          activeFilter = button.dataset.readingFilter;
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
