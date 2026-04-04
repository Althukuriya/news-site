// ==================== UI ONLY - NO DATA FETCHING ====================

function initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
    });
}

function initReadingProgress() {
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const bar = document.getElementById('readingProgressBar');
        if (bar) bar.style.width = scrolled + '%';
    });
}

function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const nav = document.querySelector('.main-nav ul');
    if (toggle && nav) {
        toggle.addEventListener('click', () => nav.classList.toggle('open'));
    }
}

function initSearchToggle() {
    const toggle = document.getElementById('searchToggleBtn');
    const container = document.getElementById('searchBarContainer');
    if (toggle && container) {
        toggle.addEventListener('click', () => container.classList.toggle('active'));
    }
}

function updateBookmarkCount() {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const countElem = document.getElementById('bookmarkCount');
    if (countElem) countElem.textContent = bookmarks.length;
}

function initBookmarkNav() {
    const btn = document.getElementById('bookmarkNavBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            window.location.href = '/bookmarks.html';
        });
    }
}

function initPushNotifications() {
    const btn = document.getElementById('pushNotifyBtn');
    if (!btn) return;
    if ('Notification' in window) {
        btn.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                btn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
                btn.style.background = '#27ae60';
                localStorage.setItem('notificationsEnabled', 'true');
            }
        });
        if (localStorage.getItem('notificationsEnabled') === 'true') {
            btn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
            btn.style.background = '#27ae60';
        }
    }
}

function initLiveSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('liveSearchResults');
    if (!searchInput) return;
    
    let timer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();
        if (query.length < 2) {
            resultsDiv.classList.remove('active');
            return;
        }
        timer = setTimeout(() => {
            const posts = document.querySelectorAll('.news-card');
            const matches = [];
            posts.forEach(post => {
                const title = post.querySelector('.card-title a')?.textContent || '';
                if (title.toLowerCase().includes(query.toLowerCase())) {
                    const link = post.querySelector('.card-title a')?.href;
                    const img = post.querySelector('.card-img')?.src;
                    const excerpt = post.querySelector('.card-excerpt')?.textContent || '';
                    if (link) {
                        matches.push({ title, link, img, excerpt });
                    }
                }
            });
            
            if (matches.length > 0) {
                resultsDiv.innerHTML = matches.slice(0, 5).map(post => `
                    <div class="live-search-item" onclick="window.location.href='${post.link}'" style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;gap:12px">
                        <img src="${post.img}" style="width:50px;height:50px;object-fit:cover;border-radius:8px">
                        <div><strong>${escapeHtml(post.title)}</strong><br><small>${escapeHtml(post.excerpt.substring(0, 60))}...</small></div>
                    </div>
                `).join('');
                resultsDiv.classList.add('active');
            } else {
                resultsDiv.innerHTML = '<div style="padding:12px;text-align:center">No results found</div>';
                resultsDiv.classList.add('active');
            }
        }, 300);
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.classList.remove('active');
        }
    });
    
    document.getElementById('searchSubmitBtn')?.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
        }
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
            }
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function init() {
    initDarkMode();
    initReadingProgress();
    initMobileMenu();
    initSearchToggle();
    updateBookmarkCount();
    initBookmarkNav();
    initPushNotifications();
    initLiveSearch();
}

init();