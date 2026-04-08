// ==========================================
// BYTEBULLETIN - STATIC CMS VERSION (PRODUCTION)
// No admin leaks, proper error handling, SEO optimized
// ==========================================

// ------------------------------
// CONFIGURATION & GLOBALS
// ------------------------------
const CONFIG = {
    postsIndexUrl: '/data/posts/index.json',
    postsDir: '/data/posts/',
    defaultImage: '/images/placeholder.jpg',
    cacheTimeout: 300000,
    readingSpeed: 200,
    debounceDelay: 300
};

let state = {
    allPosts: [],
    categories: new Set(),
    isLoading: false,
    lastFetch: 0,
    currentPage: 'home',
    currentCategory: null,
    currentSearchQuery: null
};

let dom = {
    dynamicContent: null,
    bookmarkCount: null,
    breakingTicker: null,
    searchInput: null,
    searchResults: null,
    darkModeToggle: null,
    mobileMenuToggle: null,
    categoryNav: null,
    dropdownContent: null,
    readingProgress: null
};

// ------------------------------
// UTILITIES
// ------------------------------
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    } catch {
        return dateStr;
    }
}

function calculateReadTime(content) {
    if (!content) return '1 min read';
    const text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const words = text.split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / CONFIG.readingSpeed));
    return `${minutes} min read`;
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
}

function showLoader(container = dom.dynamicContent) {
    if (container) {
        container.innerHTML = `
            <div class="loader-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading news...</p>
            </div>
        `;
    }
}

function showError(message, isFatal = false, container = dom.dynamicContent) {
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-exclamation-triangle" style="font-size:64px;color:#e63946;"></i>
                </div>
                <h3>${isFatal ? 'System Error' : 'Something went wrong'}</h3>
                <p>${escapeHtml(message)}</p>
                <button onclick="location.reload()" class="empty-state-btn">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
    console.error('[ByteBulletin Error]', message);
}

function showEmptyState(message, container = dom.dynamicContent) {
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📰</div>
                <h3>${escapeHtml(message)}</h3>
                <p>No news available right now. Please check back later.</p>
                <a href="/" class="empty-state-btn" style="background:#666;">← Back to Home</a>
            </div>
        `;
    }
}

function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${type === 'success' ? '#27ae60' : '#3498db'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ------------------------------
// DATA FETCHING (JSON-Based)
// ------------------------------
async function fetchAllPosts(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && state.allPosts.length > 0 && (now - state.lastFetch) < CONFIG.cacheTimeout) {
        return state.allPosts;
    }
    
    if (state.isLoading) {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!state.isLoading) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
        return state.allPosts;
    }
    
    state.isLoading = true;
    
    try {
        const indexResponse = await fetch(CONFIG.postsIndexUrl);
        
        if (!indexResponse.ok) {
            if (indexResponse.status === 404) {
                console.warn('index.json not found - this is normal for new sites');
                state.allPosts = [];
                state.isLoading = false;
                showEmptyState('No news available right now. Please check back later.');
                return [];
            }
            throw new Error(`HTTP ${indexResponse.status}`);
        }
        
        let postList = await indexResponse.json();
        
        if (!Array.isArray(postList)) {
            if (postList && Array.isArray(postList.posts)) {
                postList = postList.posts;
            } else {
                throw new Error('Invalid index format');
            }
        }
        
        if (!Array.isArray(postList) || postList.length === 0) {
            state.allPosts = [];
            state.isLoading = false;
            showEmptyState('No news available right now. Please check back later.');
            return [];
        }
        
        // PARALLEL FETCHING WITH Promise.all
        const postPromises = postList.map(async (filename) => {
            try {
                const res = await fetch(`${CONFIG.postsDir}${filename}`);
                if (!res.ok) return null;
                const data = await res.json();
                return data;
            } catch {
                return null;
            }
        });
        
        const results = await Promise.all(postPromises);
        
        const posts = results
            .filter(post => post && post.id && post.title)
            .map(post => {
                const normalizedPost = {
                    id: post.id || generateSlug(post.title),
                    title: post.title || 'Untitled',
                    slug: post.slug || generateSlug(post.title),
                    date: post.date || new Date().toISOString(),
                    image: (post.image && post.image !== '') ? post.image : CONFIG.defaultImage,
                    category: post.category || 'News',
                    tags: Array.isArray(post.tags) ? post.tags : (post.tags ? [post.tags] : ['News']),
                    summary: post.summary || (post.content ? post.content.replace(/<[^>]*>/g, '').substring(0, 150) : ''),
                    content: post.content || '<p>No content available.</p>',
                    featured: post.featured === true,
                    author: post.author || 'ByteBulletin Staff',
                    readingTime: post.readingTime || calculateReadTime(post.content),
                    seoTitle: post.seo?.seoTitle || post.seoTitle || post.title,
                    seoDescription: post.seo?.seoDescription || post.seoDescription || (post.summary || '').substring(0, 160)
                };
                if (normalizedPost.category) state.categories.add(normalizedPost.category);
                return normalizedPost;
            });
        
        if (posts.length === 0) {
            showEmptyState('No news available right now. Please check back later.');
            state.allPosts = [];
            state.isLoading = false;
            return [];
        }
        
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        state.allPosts = posts;
        state.lastFetch = now;
        state.isLoading = false;
        
        return posts;
        
    } catch (err) {
        state.isLoading = false;
        console.error('Fetch posts error:', err);
        showEmptyState('No news available right now. Please check back later.');
        return [];
    }
}

function getPostById(id) {
    return state.allPosts.find(p => p.id === id);
}

function getPostsByCategory(category) {
    return state.allPosts.filter(p => p.category === category);
}

function getFeaturedPosts() {
    return state.allPosts.filter(p => p.featured === true);
}

function searchPosts(query) {
    const lowerQuery = query.toLowerCase();
    return state.allPosts.filter(p => 
        p.title.toLowerCase().includes(lowerQuery) ||
        (p.summary && p.summary.toLowerCase().includes(lowerQuery)) ||
        p.content.toLowerCase().includes(lowerQuery) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
}

// ------------------------------
// RENDERING COMPONENTS
// ------------------------------
function renderNewsCard(post, showBookmarkBtn = true) {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const isBookmarked = bookmarks.includes(post.id);
    const featuredBadge = post.featured ? '<span class="featured-badge"><i class="fas fa-star"></i> Featured</span>' : '';
    
    return `
        <div class="news-card" data-id="${post.id}">
            <div class="card-img-wrapper">
                <img src="${post.image}" class="card-img" alt="${escapeHtml(post.title)}" loading="lazy" 
                     onerror="this.onerror=null; this.src='${CONFIG.defaultImage}'">
                ${featuredBadge}
            </div>
            <div class="card-content">
                <div class="card-category">${escapeHtml(post.category)}</div>
                <h3 class="card-title"><a href="/post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
                <div class="card-meta">
                    <span><i class="far fa-calendar"></i> ${formatDate(post.date)}</span>
                    <span class="read-time"><i class="far fa-clock"></i> ${post.readingTime || calculateReadTime(post.content)}</span>
                </div>
                <p class="card-excerpt">${escapeHtml(post.summary || post.content.replace(/<[^>]*>/g, '').substring(0, 150))}</p>
                ${showBookmarkBtn ? `<button class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${post.id}"><i class="fas fa-bookmark"></i> ${isBookmarked ? 'Saved' : 'Save'}</button>` : ''}
            </div>
        </div>
    `;
}

function renderFeaturedHero() {
    const featured = getFeaturedPosts().slice(0, 3);
    if (featured.length === 0) return '';
    
    const mainFeatured = featured[0];
    const sideFeatured = featured.slice(1, 3);
    
    return `
        <div class="featured-hero">
            <div class="featured-main">
                <img src="${mainFeatured.image}" alt="${escapeHtml(mainFeatured.title)}" onerror="this.src='${CONFIG.defaultImage}'">
                <div class="featured-main-content">
                    <span class="featured-label"><i class="fas fa-fire"></i> Featured Story</span>
                    <h2><a href="/post.html?id=${mainFeatured.id}">${escapeHtml(mainFeatured.title)}</a></h2>
                    <p>${escapeHtml(mainFeatured.summary || mainFeatured.content.replace(/<[^>]*>/g, '').substring(0, 120))}</p>
                    <div class="featured-meta">
                        <span><i class="far fa-calendar"></i> ${formatDate(mainFeatured.date)}</span>
                        <span><i class="far fa-clock"></i> ${mainFeatured.readingTime || calculateReadTime(mainFeatured.content)}</span>
                    </div>
                </div>
            </div>
            ${sideFeatured.length ? `
            <div class="featured-side">
                ${sideFeatured.map(post => `
                    <div class="featured-side-item">
                        <img src="${post.image}" alt="${escapeHtml(post.title)}" onerror="this.src='${CONFIG.defaultImage}'">
                        <div class="featured-side-content">
                            <h3><a href="/post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
                            <span class="featured-side-meta">${formatDate(post.date)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    `;
}

function renderModernShareButtons() {
    const currentUrl = encodeURIComponent(window.location.href);
    const currentTitle = encodeURIComponent(document.title);
    return `
        <div class="modern-share">
            <span class="share-label"><i class="fas fa-share-alt"></i> Share this article</span>
            <div class="share-buttons-group">
                <a href="https://www.facebook.com/sharer/sharer.php?u=${currentUrl}" target="_blank" rel="noopener noreferrer" class="share-icon-btn share-fb">
                    <i class="fab fa-facebook-f"></i> <span class="share-text">Facebook</span>
                </a>
                <a href="https://twitter.com/intent/tweet?text=${currentTitle}&url=${currentUrl}" target="_blank" rel="noopener noreferrer" class="share-icon-btn share-x">
                    <i class="fab fa-twitter"></i> <span class="share-text">X</span>
                </a>
                <a href="https://wa.me/?text=${currentTitle}%20${currentUrl}" target="_blank" rel="noopener noreferrer" class="share-icon-btn share-wa">
                    <i class="fab fa-whatsapp"></i> <span class="share-text">WhatsApp</span>
                </a>
                <button class="share-icon-btn share-copy" id="copyLinkBtn">
                    <i class="fas fa-link"></i> <span class="share-text">Copy Link</span>
                </button>
            </div>
        </div>
    `;
}

function renderRelatedPosts(currentPostId, category, limit = 4) {
    const related = state.allPosts
        .filter(p => p.id !== currentPostId && p.category === category)
        .slice(0, limit);
    
    if (related.length === 0) return '';
    
    return `
        <div class="related-posts">
            <h3><i class="fas fa-link"></i> Related Articles</h3>
            <div class="related-posts-grid">
                ${related.map(post => `
                    <div class="related-post-card">
                        <img src="${post.image}" class="related-post-img" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
                        <div class="related-post-content">
                            <h4 class="related-post-title"><a href="/post.html?id=${post.id}">${escapeHtml(post.title)}</a></h4>
                            <div class="related-post-meta">${post.readingTime || calculateReadTime(post.content)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ------------------------------
// PAGE LOADERS
// ------------------------------
async function loadHome() {
    showLoader();
    const posts = await fetchAllPosts();
    
    if (!posts || posts.length === 0) {
        showEmptyState('No news available right now. Please check back later.');
        return;
    }
    
    const latestPosts = posts.slice(0, 12);
    const categoriesArray = Array.from(state.categories).slice(0, 20);
    
    const html = `
        ${renderFeaturedHero()}
        <div class="two-column">
            <div class="main-col">
                <h2 style="font-size:28px;margin-bottom:28px;border-left:5px solid #e63946;padding-left:18px">
                    <i class="fas fa-fire"></i> Latest Headlines
                </h2>
                <div class="news-grid">${latestPosts.map(p => renderNewsCard(p)).join('')}</div>
            </div>
            <aside class="sidebar">
                <div class="sidebar-widget">
                    <h3><i class="fas fa-clock"></i> Recent Posts</h3>
                    <ul class="recent-list">
                        ${posts.slice(0, 5).map(p => `<li><a href="/post.html?id=${p.id}">${escapeHtml(p.title)}</a></li>`).join('')}
                    </ul>
                </div>
                <div class="sidebar-widget">
                    <h3><i class="fas fa-tags"></i> Categories</h3>
                    <ul class="category-list">
                        ${categoriesArray.slice(0, 15).map(cat => `<li><a href="/category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a></li>`).join('')}
                    </ul>
                </div>
            </aside>
        </div>
    `;
    
    if (dom.dynamicContent) dom.dynamicContent.innerHTML = html;
    attachBookmarkEvents();
    updateCategoryDropdown(categoriesArray);
    updateBreakingTicker(posts);
}

async function loadCategory() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('cat');
    
    if (!category) {
        loadHome();
        return;
    }
    
    showLoader();
    const posts = await fetchAllPosts();
    
    if (!posts || posts.length === 0) {
        showEmptyState('No news available right now. Please check back later.');
        return;
    }
    
    const filtered = posts.filter(p => p.category === category);
    
    if (filtered.length === 0) {
        showEmptyState(`No articles found in "${category}"`);
        return;
    }
    
    const html = `
        <div style="margin:48px 0;">
            <h2 style="margin-bottom:28px;border-left:5px solid #e63946;padding-left:18px;">
                <i class="fas fa-folder"></i> ${escapeHtml(category)} 
                <span style="font-size:14px;color:#999;font-weight:normal;">(${filtered.length} articles)</span>
            </h2>
            <div class="news-grid">${filtered.map(p => renderNewsCard(p)).join('')}</div>
        </div>
    `;
    
    if (dom.dynamicContent) dom.dynamicContent.innerHTML = html;
    attachBookmarkEvents();
}

async function loadPost() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    
    if (!postId) {
        loadHome();
        return;
    }
    
    showLoader();
    const posts = await fetchAllPosts();
    
    if (!posts || posts.length === 0) {
        showEmptyState('No news available right now. Please check back later.');
        return;
    }
    
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
        showEmptyState('Article not found.');
        return;
    }
    
    // DYNAMIC SEO
    const seoTitle = post.seoTitle || post.title;
    const seoDescription = post.seoDescription || post.summary || post.content.replace(/<[^>]*>/g, '').substring(0, 160);
    
    document.title = `${seoTitle} - ByteBulletin`;
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', seoDescription.substring(0, 160));
    } else {
        const newMeta = document.createElement('meta');
        newMeta.name = 'description';
        newMeta.content = seoDescription.substring(0, 160);
        document.head.appendChild(newMeta);
    }
    
    const metaOgDesc = document.querySelector('meta[property="og:description"]');
    if (metaOgDesc) {
        metaOgDesc.setAttribute('content', seoDescription.substring(0, 160));
    }
    
    const metaOgImage = document.querySelector('meta[property="og:image"]');
    if (metaOgImage && post.image) {
        metaOgImage.setAttribute('content', post.image);
    }
    
    const breadcrumb = `
        <nav class="breadcrumb-nav">
            <ul class="breadcrumb">
                <li><a href="/"><i class="fas fa-home"></i> Home</a></li>
                <li class="separator">›</li>
                <li><a href="/category.html?cat=${encodeURIComponent(post.category)}">${escapeHtml(post.category)}</a></li>
                <li class="separator">›</li>
                <li class="active">${escapeHtml(post.title)}</li>
            </ul>
        </nav>
    `;
    
    const html = `${breadcrumb}
    <div class="article-full">
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="post-meta">
            <span><i class="far fa-calendar-alt"></i> ${formatDate(post.date)}</span>
            <span><i class="far fa-user"></i> ${escapeHtml(post.author)}</span>
            <span class="read-time"><i class="far fa-clock"></i> ${post.readingTime || calculateReadTime(post.content)}</span>
        </div>
        ${renderModernShareButtons()}
        <img src="${post.image}" class="post-featured-img" alt="${escapeHtml(post.title)}" onerror="this.src='${CONFIG.defaultImage}'">
        <div class="post-content">${post.content}</div>
        <div class="post-labels">
            <span class="label-badge"><i class="fas fa-folder"></i> ${escapeHtml(post.category)}</span>
            ${post.tags ? post.tags.map(tag => `<span class="label-badge"><i class="fas fa-tag"></i> ${escapeHtml(tag)}</span>`).join('') : ''}
        </div>
        ${renderRelatedPosts(post.id, post.category)}
    </div>`;
    
    if (dom.dynamicContent) dom.dynamicContent.innerHTML = html;
    attachBookmarkEvents();
    initCopyLink();
}

async function loadSearch() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    
    if (!query || query.trim() === '') {
        loadHome();
        return;
    }
    
    showLoader();
    const posts = await fetchAllPosts();
    
    if (!posts || posts.length === 0) {
        showEmptyState('No news available right now. Please check back later.');
        return;
    }
    
    const results = searchPosts(query);
    
    const html = `
        <div style="margin:48px 0;">
            <h2 style="margin-bottom:28px;border-left:5px solid #e63946;padding-left:18px;">
                <i class="fas fa-search"></i> Search Results: "${escapeHtml(query)}"
                <span style="font-size:14px;color:#999;font-weight:normal;">(${results.length} results)</span>
            </h2>
            ${results.length === 0 ? 
                `<div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No results found for "${escapeHtml(query)}"</h3>
                    <p>Try different keywords or browse all news articles.</p>
                    <a href="/" class="empty-state-btn">Browse all news →</a>
                </div>` : 
                `<div class="news-grid">${results.map(p => renderNewsCard(p)).join('')}</div>`
            }
        </div>
    `;
    
    if (dom.dynamicContent) dom.dynamicContent.innerHTML = html;
    attachBookmarkEvents();
}

async function loadBookmarks() {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    
    if (bookmarks.length === 0) {
        showEmptyState('No saved articles yet');
        return;
    }
    
    showLoader();
    const posts = await fetchAllPosts();
    const bookmarkedPosts = posts.filter(p => bookmarks.includes(p.id));
    
    if (bookmarkedPosts.length === 0) {
        showEmptyState('Your saved articles could not be found. They may have been removed.');
        return;
    }
    
    const html = `
        <div style="margin:48px 0;">
            <h2 style="margin-bottom:28px;border-left:5px solid #e63946;padding-left:18px;">
                <i class="fas fa-bookmark"></i> Saved Articles 
                <span style="font-size:14px;color:#999;font-weight:normal;">(${bookmarkedPosts.length} saved)</span>
            </h2>
            <div class="news-grid">${bookmarkedPosts.map(p => renderNewsCard(p, true)).join('')}</div>
        </div>
    `;
    
    if (dom.dynamicContent) dom.dynamicContent.innerHTML = html;
    attachBookmarkEvents();
}

// ------------------------------
// BOOKMARK HANDLING
// ------------------------------
function attachBookmarkEvents() {
    document.querySelectorAll('.bookmark-btn').forEach(btn => {
        btn.removeEventListener('click', handleBookmark);
        btn.addEventListener('click', handleBookmark);
    });
}

function handleBookmark(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const postId = btn.dataset.id;
    let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    
    if (bookmarks.includes(postId)) {
        bookmarks = bookmarks.filter(id => id !== postId);
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-bookmark"></i> Save';
        showToast('Article removed from bookmarks', 'info');
    } else {
        bookmarks.push(postId);
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-bookmark"></i> Saved';
        showToast('Article saved to bookmarks!', 'success');
    }
    
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    updateBookmarkCount();
}

function updateBookmarkCount() {
    const count = JSON.parse(localStorage.getItem('bookmarks') || '[]').length;
    if (dom.bookmarkCount) dom.bookmarkCount.textContent = count;
}

// ------------------------------
// UI HELPERS & NAVIGATION
// ------------------------------
function updateCategoryDropdown(categoriesArray) {
    if (dom.dropdownContent) {
        dom.dropdownContent.innerHTML = categoriesArray.slice(0, 30).map(cat => 
            `<a href="/category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>`
        ).join('');
    }
}

async function updateBreakingTicker(posts) {
    if (dom.breakingTicker && posts && posts.length) {
        const featuredTitles = posts.filter(p => p.featured).slice(0, 3).map(p => p.title);
        const titles = featuredTitles.length ? featuredTitles : posts.slice(0, 5).map(p => p.title);
        dom.breakingTicker.innerHTML = `<div class="ticker-item">🔥 ${titles.join('  •  ')}</div>`;
    }
}

function initCopyLink() {
    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) {
        copyBtn.removeEventListener('click', handleCopyLink);
        copyBtn.addEventListener('click', handleCopyLink);
    }
}

async function handleCopyLink(e) {
    const btn = e.currentTarget;
    try {
        await navigator.clipboard.writeText(window.location.href);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> <span class="share-text">Copied!</span>';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    } catch (err) {
        console.error('Copy failed:', err);
        showToast('Failed to copy link', 'error');
    }
}

// ------------------------------
// SEARCH FUNCTIONALITY
// ------------------------------
let searchTimeout = null;

function initLiveSearch() {
    if (!dom.searchInput) return;
    
    dom.searchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        searchTimeout = setTimeout(async () => {
            if (query.length < 2) {
                if (dom.searchResults) {
                    dom.searchResults.classList.remove('active');
                    dom.searchResults.innerHTML = '';
                }
                return;
            }
            
            const posts = await fetchAllPosts();
            if (!posts || posts.length === 0) return;
            
            const filtered = posts.filter(p => 
                p.title.toLowerCase().includes(query.toLowerCase()) || 
                (p.summary && p.summary.toLowerCase().includes(query.toLowerCase()))
            ).slice(0, 5);
            
            if (!dom.searchResults) return;
            
            if (filtered.length === 0) {
                dom.searchResults.innerHTML = '<div class="live-search-empty">No results found</div>';
                dom.searchResults.classList.add('active');
                return;
            }
            
            dom.searchResults.innerHTML = filtered.map(post => `
                <div class="live-search-item" data-id="${post.id}">
                    <img src="${post.image}" alt="${escapeHtml(post.title)}" onerror="this.src='${CONFIG.defaultImage}'">
                    <div class="live-search-info">
                        <div class="live-search-title">${escapeHtml(post.title)}</div>
                        <div class="live-search-meta">${post.readingTime || calculateReadTime(post.content)} • ${escapeHtml(post.category || 'News')}</div>
                    </div>
                </div>
            `).join('');
            dom.searchResults.classList.add('active');
            
            document.querySelectorAll('.live-search-item').forEach(item => {
                item.addEventListener('click', () => {
                    window.location.href = `/post.html?id=${item.dataset.id}`;
                });
            });
        }, CONFIG.debounceDelay);
    });
    
    document.addEventListener('click', (e) => {
        if (dom.searchInput && dom.searchResults && 
            !dom.searchInput.contains(e.target) && 
            !dom.searchResults.contains(e.target)) {
            dom.searchResults.classList.remove('active');
        }
    });
    
    const submitBtn = document.getElementById('searchSubmitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const q = dom.searchInput.value.trim();
            if (q) window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
        });
    }
    
    dom.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const q = dom.searchInput.value.trim();
            if (q) window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
        }
    });
}

// ------------------------------
// DARK MODE
// ------------------------------
function initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') document.body.classList.add('dark-mode');
    
    if (dom.darkModeToggle) {
        dom.darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
        });
    }
}

// ------------------------------
// READING PROGRESS
// ------------------------------
function initReadingProgress() {
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        if (dom.readingProgress) dom.readingProgress.style.width = scrolled + '%';
    });
}

// ------------------------------
// MOBILE SIDEBAR (NO ADMIN LINKS)
// ------------------------------
function createMobileSidebar() {
    if (document.getElementById('mobileSidebar')) return;
    
    const sidebarHTML = `
        <div id="mobileSidebar" class="mobile-sidebar">
            <div class="sidebar-header">
                <h3><i class="fas fa-bars"></i> Menu</h3>
                <button class="close-sidebar" id="closeSidebarBtn"><i class="fas fa-times"></i></button>
            </div>
            <ul class="mobile-category-list">
                <li><a href="/"><i class="fas fa-home"></i> Home</a></li>
                <li><a href="/bookmarks.html"><i class="fas fa-bookmark"></i> Bookmarks</a></li>
                <li><a href="/about.html"><i class="fas fa-info-circle"></i> About</a></li>
                <li><a href="/contact.html"><i class="fas fa-envelope"></i> Contact</a></li>
            </ul>
        </div>
        <div id="sidebarOverlay" class="sidebar-overlay"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', sidebarHTML);
    
    const menuToggle = dom.mobileMenuToggle;
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeBtn = document.getElementById('closeSidebarBtn');
    
    function openSidebar() { 
        sidebar?.classList.add('open'); 
        overlay?.classList.add('active'); 
        document.body.style.overflow = 'hidden'; 
    }
    
    function closeSidebar() { 
        sidebar?.classList.remove('open'); 
        overlay?.classList.remove('active'); 
        document.body.style.overflow = ''; 
    }
    
    if (menuToggle) {
        menuToggle.removeEventListener('click', openSidebar);
        menuToggle.addEventListener('click', openSidebar);
    }
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeSidebar);
        closeBtn.addEventListener('click', closeSidebar);
    }
    if (overlay) {
        overlay.removeEventListener('click', closeSidebar);
        overlay.addEventListener('click', closeSidebar);
    }
}

async function updateMobileCategories() {
    const sidebar = document.getElementById('mobileSidebar');
    const categoryList = sidebar?.querySelector('.mobile-category-list');
    
    if (categoryList && state.categories.size > 0) {
        const categoriesArray = Array.from(state.categories);
        categoryList.innerHTML = `
            <li><a href="/"><i class="fas fa-home"></i> Home</a></li>
            ${categoriesArray.map(cat => `<li><a href="/category.html?cat=${encodeURIComponent(cat)}"><i class="fas fa-folder"></i> ${escapeHtml(cat)}</a></li>`).join('')}
            <li><a href="/bookmarks.html"><i class="fas fa-bookmark"></i> Bookmarks</a></li>
            <li><a href="/about.html"><i class="fas fa-info-circle"></i> About</a></li>
            <li><a href="/contact.html"><i class="fas fa-envelope"></i> Contact</a></li>
        `;
    }
}

// ------------------------------
// PUSH NOTIFICATIONS (OPTIONAL)
// ------------------------------
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
                showToast('Notifications enabled!', 'success');
            } else {
                showToast('Notification permission denied', 'info');
            }
        });
        
        if (localStorage.getItem('notificationsEnabled') === 'true') {
            btn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
            btn.style.background = '#27ae60';
        }
    }
}

// ------------------------------
// UI TOGGLES
// ------------------------------
function initUIToggles() {
    const searchToggle = document.getElementById('searchToggleBtn');
    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            document.getElementById('searchBarContainer')?.classList.toggle('active');
        });
    }
    
    const bookmarkNav = document.getElementById('bookmarkNavBtn');
    if (bookmarkNav) {
        bookmarkNav.addEventListener('click', () => {
            window.location.href = '/bookmarks.html';
        });
    }
}

// ------------------------------
// ROUTING & INITIALIZATION
// ------------------------------
async function route() {
    const path = window.location.pathname;
    
    dom.dynamicContent = document.getElementById('dynamicContent');
    dom.bookmarkCount = document.getElementById('bookmarkCount');
    dom.breakingTicker = document.getElementById('breakingTicker');
    dom.searchInput = document.getElementById('searchInput');
    dom.searchResults = document.getElementById('liveSearchResults');
    dom.darkModeToggle = document.getElementById('darkModeToggle');
    dom.mobileMenuToggle = document.getElementById('mobileMenuToggle');
    dom.categoryNav = document.getElementById('categoryNav');
    dom.dropdownContent = document.getElementById('dropdownContent');
    dom.readingProgress = document.getElementById('readingProgressBar');
    
    createMobileSidebar();
    initDarkMode();
    initReadingProgress();
    initLiveSearch();
    initPushNotifications();
    initUIToggles();
    updateBookmarkCount();
    
    if (path.includes('post.html')) {
        await loadPost();
    } else if (path.includes('category.html')) {
        await loadCategory();
    } else if (path.includes('search.html')) {
        await loadSearch();
    } else if (path.includes('bookmarks.html')) {
        await loadBookmarks();
    } else {
        await loadHome();
    }
    
    await updateMobileCategories();
}

const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);

route();