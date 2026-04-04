const fs = require('fs');
const path = require('path');
const https = require('https');

const BLOG_URL = 'https://newwwwwsave.blogspot.com';
const SITE_URL = 'https://bookmyads.in';
const POSTS_PER_PAGE = 12;

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function generateSlug(title, postId) {
    const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 120);
    return `${cleanTitle}-${postId}`;
}

function generateCategorySlug(category) {
    return category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function extractImage(content) {
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : 'https://picsum.photos/800/400?random=1';
}

function cleanContent(content) {
    return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/href="\//g, `href="${BLOG_URL}/`)
        .replace(/src="\//g, `src="${BLOG_URL}/`);
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch(e) {
        return dateStr;
    }
}

function readTime(content) {
    const words = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parsePost(entry) {
    const content = entry.content.$t;
    const title = entry.title.$t;
    const postId = entry.id.$t.split('post-')[1];
    
    return {
        id: postId,
        title: title,
        slug: generateSlug(title, postId),
        published: entry.published.$t,
        publishedFormatted: formatDate(entry.published.$t),
        author: entry.author?.[0]?.name?.$t || 'Editor',
        content: cleanContent(content),
        summary: entry.summary?.$t || content.replace(/<[^>]*>/g, '').substring(0, 160) + '...',
        image: extractImage(content),
        categories: entry.category?.map(c => c.term) || [],
        readTime: readTime(content)
    };
}

async function loadAllPosts() {
    let allPosts = [];
    let startIndex = 1;
    const maxResults = 100;
    
    while (true) {
        const url = `${BLOG_URL}/feeds/posts/default?alt=json&start-index=${startIndex}&max-results=${maxResults}`;
        const data = await fetchJSON(url);
        
        if (!data.feed || !data.feed.entry) break;
        
        const posts = data.feed.entry.map(parsePost);
        allPosts.push(...posts);
        
        if (posts.length < maxResults) break;
        startIndex += maxResults;
    }
    
    return allPosts;
}

function renderPostCard(post, isCategoryPage = false, isPagePath = false) {
    const linkPath = isCategoryPage ? `../${post.slug}.html` : `/${post.slug}.html`;
    const imgPath = post.image;
    
    return `
        <div class="news-card">
            <img src="${imgPath}" class="card-img" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.src='https://picsum.photos/400/250?random=1'">
            <div class="card-content">
                <div class="card-category">${escapeHtml(post.categories[0] || 'News')}</div>
                <h3 class="card-title"><a href="${linkPath}">${escapeHtml(post.title)}</a></h3>
                <div class="card-meta">
                    <span><i class="far fa-calendar"></i> ${post.publishedFormatted}</span>
                    <span class="read-time"><i class="far fa-clock"></i> ${post.readTime}</span>
                </div>
                <p class="card-excerpt">${escapeHtml(post.summary)}</p>
            </div>
        </div>
    `;
}

function renderSidebarRecent(posts) {
    return posts.slice(0, 5).map(post => `
        <li><a href="/${post.slug}.html">${escapeHtml(post.title)}</a></li>
    `).join('');
}

function renderSidebarCategories(categories) {
    return Array.from(categories).slice(0, 10).map(cat => {
        const catSlug = generateCategorySlug(cat);
        return `<li><a href="/category/${catSlug}.html">${escapeHtml(cat)}</a></li>`;
    }).join('');
}

function renderCategoryNav(categories) {
    return Array.from(categories).slice(0, 8).map(cat => {
        const catSlug = generateCategorySlug(cat);
        return `<li><a href="/category/${catSlug}.html">${escapeHtml(cat)}</a></li>`;
    }).join('');
}

function renderDropdownCategories(categories) {
    return Array.from(categories).slice(0, 15).map(cat => {
        const catSlug = generateCategorySlug(cat);
        return `<a href="/category/${catSlug}.html">${escapeHtml(cat)}</a>`;
    }).join('');
}

function renderBreakingTicker(posts) {
    const titles = posts.slice(0, 5).map(p => p.title);
    return `🔥 ${titles.join('  •  ')}`;
}

function generateHomepage(posts, allPosts, categories, currentPage = 1, totalPages = 1) {
    const template = fs.readFileSync(path.join(__dirname, 'templates', 'index.html'), 'utf8');
    const recentPosts = renderSidebarRecent(allPosts);
    const categoryList = renderSidebarCategories(categories);
    const categoryNav = renderCategoryNav(categories);
    const dropdownCategories = renderDropdownCategories(categories);
    const breakingNews = renderBreakingTicker(posts);
    
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const pagePosts = posts.slice(start, end);
    const postsHTML = pagePosts.map(p => renderPostCard(p, false)).join('');
    
    const ogImage = posts[0]?.image || 'https://picsum.photos/1200/630';
    
    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML = '<div class="pagination">';
        if (currentPage > 1) {
            const prevPage = currentPage === 2 ? '/' : `/page/${currentPage - 1}.html`;
            paginationHTML += `<a href="${prevPage}" class="page-link prev">&laquo; Previous</a>`;
        }
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            if (i === currentPage) {
                paginationHTML += `<span class="page-link active">${i}</span>`;
            } else if (i === 1) {
                paginationHTML += `<a href="/" class="page-link">${i}</a>`;
            } else {
                paginationHTML += `<a href="/page/${i}.html" class="page-link">${i}</a>`;
            }
        }
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/page/${currentPage + 1}.html" class="page-link next">Next &raquo;</a>`;
        }
        paginationHTML += '</div>';
    }
    
    let html = template
        .replace(/{{TITLE}}/g, currentPage === 1 ? 'NewsPortal - Breaking News & Headlines' : `NewsPortal - Page ${currentPage}`)
        .replace(/{{DESCRIPTION}}/g, 'Latest breaking news, headlines, and in-depth analysis from around the world')
        .replace(/{{CANONICAL}}/g, currentPage === 1 ? `${SITE_URL}/` : `${SITE_URL}/page/${currentPage}.html`)
        .replace(/{{OG_IMAGE}}/g, ogImage)
        .replace('{{POSTS}}', postsHTML)
        .replace('{{RECENT_POSTS}}', recentPosts)
        .replace('{{CATEGORIES_SIDEBAR}}', categoryList)
        .replace('{{CATEGORY_NAV}}', categoryNav)
        .replace('{{DROPDOWN_CATEGORIES}}', dropdownCategories)
        .replace('{{BREAKING_NEWS}}', breakingNews)
        .replace('{{PAGINATION}}', paginationHTML);
    
    return html;
}

function generatePostPage(post, allPosts, categories) {
    const template = fs.readFileSync(path.join(__dirname, 'templates', 'post.html'), 'utf8');
    
    const relatedPosts = allPosts
        .filter(p => p.id !== post.id && p.categories.some(c => post.categories.includes(c)))
        .slice(0, 4);
    
    const relatedHTML = relatedPosts.map(related => `
        <div class="related-card">
            <img src="${related.image}" alt="${escapeHtml(related.title)}">
            <div style="padding: 12px">
                <h4><a href="/${related.slug}.html">${escapeHtml(related.title)}</a></h4>
                <small>${related.readTime}</small>
            </div>
        </div>
    `).join('');
    
    const labelsHTML = post.categories.map(label => {
        const catSlug = generateCategorySlug(label);
        return `<a href="/category/${catSlug}.html" class="label-badge">${escapeHtml(label)}</a>`;
    }).join('');
    
    const breadcrumbHTML = post.categories[0] ? `
        <div class="breadcrumbs">
            <a href="/">Home</a>
            <span> › </span>
            <a href="/category/${generateCategorySlug(post.categories[0])}.html">${escapeHtml(post.categories[0])}</a>
            <span> › </span>
            <span>${escapeHtml(post.title)}</span>
        </div>
    ` : `
        <div class="breadcrumbs">
            <a href="/">Home</a>
            <span> › </span>
            <span>${escapeHtml(post.title)}</span>
        </div>
    `;
    
    const categoryNav = renderCategoryNav(categories);
    const dropdownCategories = renderDropdownCategories(categories);
    
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": post.title,
        "image": post.image,
        "datePublished": post.published,
        "dateModified": post.published,
        "author": {
            "@type": "Person",
            "name": post.author
        },
        "publisher": {
            "@type": "Organization",
            "name": "NewsPortal",
            "logo": {
                "@type": "ImageObject",
                "url": `${SITE_URL}/icon-192.png`
            }
        },
        "description": post.summary,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${SITE_URL}/${post.slug}.html`
        }
    };
    
    let html = template
        .replace(/{{TITLE}}/g, `${escapeHtml(post.title)} - NewsPortal`)
        .replace(/{{DESCRIPTION}}/g, escapeHtml(post.summary))
        .replace(/{{CANONICAL}}/g, `${SITE_URL}/${post.slug}.html`)
        .replace(/{{OG_IMAGE}}/g, post.image)
        .replace('{{JSON_LD}}', JSON.stringify(jsonLd, null, 2))
        .replace('{{BREADCRUMB}}', breadcrumbHTML)
        .replace('{{POST_TITLE}}', escapeHtml(post.title))
        .replace('{{POST_DATE}}', post.publishedFormatted)
        .replace('{{POST_AUTHOR}}', escapeHtml(post.author))
        .replace('{{POST_READ_TIME}}', post.readTime)
        .replace('{{POST_IMAGE}}', post.image)
        .replace('{{POST_CONTENT}}', post.content)
        .replace('{{POST_LABELS}}', labelsHTML)
        .replace('{{RELATED_POSTS}}', relatedHTML)
        .replace('{{RELATED_VISIBLE}}', relatedPosts.length ? 'block' : 'none')
        .replace('{{CATEGORY_NAV}}', categoryNav)
        .replace('{{DROPDOWN_CATEGORIES}}', dropdownCategories);
    
    return html;
}

function generateCategoryPage(categoryName, posts, allPosts, categories) {
    const template = fs.readFileSync(path.join(__dirname, 'templates', 'category.html'), 'utf8');
    
    const categoryPosts = posts.filter(p => p.categories.includes(categoryName));
    const categoryNav = renderCategoryNav(categories);
    const dropdownCategories = renderDropdownCategories(categories);
    const breakingNews = renderBreakingTicker(allPosts.slice(0, 5));
    const categorySlug = generateCategorySlug(categoryName);
    
    const postsHTML = categoryPosts.map(post => renderPostCard(post, true)).join('');
    const noPostsHTML = categoryPosts.length === 0 ? '<p style="text-align:center;padding:40px;">No posts in this category.</p>' : '';
    
    const ogImage = categoryPosts[0]?.image || 'https://picsum.photos/1200/630';
    
    let html = template
        .replace(/{{TITLE}}/g, `${escapeHtml(categoryName)} - NewsPortal`)
        .replace(/{{DESCRIPTION}}/g, `Latest news articles in ${escapeHtml(categoryName)} category`)
        .replace(/{{CANONICAL}}/g, `${SITE_URL}/category/${categorySlug}.html`)
        .replace(/{{OG_IMAGE}}/g, ogImage)
        .replace('{{CATEGORY_NAME}}', escapeHtml(categoryName))
        .replace('{{POSTS}}', postsHTML)
        .replace('{{NO_POSTS}}', noPostsHTML)
        .replace('{{CATEGORY_NAV}}', categoryNav)
        .replace('{{DROPDOWN_CATEGORIES}}', dropdownCategories)
        .replace('{{BREAKING_NEWS}}', breakingNews);
    
    return html;
}

function generateSitemap(posts, categories) {
    const today = new Date().toISOString().split('T')[0];
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${SITE_URL}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>`;
    
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    for (let i = 2; i <= totalPages; i++) {
        sitemap += `
    <url>
        <loc>${SITE_URL}/page/${i}.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>`;
    }
    
    categories.forEach(cat => {
        const catSlug = generateCategorySlug(cat);
        sitemap += `
    <url>
        <loc>${SITE_URL}/category/${catSlug}.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`;
    });
    
    posts.forEach(post => {
        const lastmod = new Date(post.published).toISOString().split('T')[0];
        sitemap += `
    <url>
        <loc>${SITE_URL}/${post.slug}.html</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>`;
    });
    
    sitemap += `
</urlset>`;
    
    return sitemap;
}

function copyPublicAssets() {
    const publicDir = path.join(__dirname, 'public');
    const distDir = path.join(__dirname, 'dist');
    
    if (fs.existsSync(publicDir)) {
        const files = fs.readdirSync(publicDir);
        files.forEach(file => {
            const srcPath = path.join(publicDir, file);
            const destPath = path.join(distDir, file);
            if (fs.statSync(srcPath).isFile()) {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }
}

async function build() {
    console.log('🚀 Starting static build...');
    console.log(`📍 Site URL: ${SITE_URL}`);
    
    const distDir = path.join(__dirname, 'dist');
    const categoryDir = path.join(distDir, 'category');
    const pageDir = path.join(distDir, 'page');
    
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    fs.mkdirSync(distDir);
    fs.mkdirSync(categoryDir);
    fs.mkdirSync(pageDir);
    
    console.log('📡 Fetching posts from Blogger...');
    const allPosts = await loadAllPosts();
    console.log(`✅ Loaded ${allPosts.length} posts`);
    
    if (allPosts.length === 0) {
        console.error('❌ No posts found. Check your Blogger URL.');
        process.exit(1);
    }
    
    const categories = new Set();
    allPosts.forEach(post => {
        post.categories.forEach(cat => categories.add(cat));
    });
    console.log(`📁 Found ${categories.size} categories`);
    
    console.log('📁 Copying static assets...');
    copyPublicAssets();
    
    const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
    
    console.log('🏠 Generating homepage and pagination...');
    for (let page = 1; page <= totalPages; page++) {
        const homepageHTML = generateHomepage(allPosts, allPosts, categories, page, totalPages);
        if (page === 1) {
            fs.writeFileSync(path.join(distDir, 'index.html'), homepageHTML);
            console.log(`   ✓ index.html`);
        } else {
            fs.writeFileSync(path.join(pageDir, `${page}.html`), homepageHTML);
            console.log(`   ✓ page/${page}.html`);
        }
    }
    
    console.log('📄 Generating post pages...');
    for (const post of allPosts) {
        const postHTML = generatePostPage(post, allPosts, categories);
        fs.writeFileSync(path.join(distDir, `${post.slug}.html`), postHTML);
        console.log(`   ✓ ${post.slug}.html`);
    }
    
    console.log('📁 Generating category pages...');
    for (const category of categories) {
        const categorySlug = generateCategorySlug(category);
        const categoryHTML = generateCategoryPage(category, allPosts, allPosts, categories);
        fs.writeFileSync(path.join(categoryDir, `${categorySlug}.html`), categoryHTML);
        console.log(`   ✓ category/${categorySlug}.html`);
    }
    
    console.log('🗺️ Generating sitemap...');
    const sitemap = generateSitemap(allPosts, categories);
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
    
    const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml`;
    fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);
    
    console.log('✅ Build completed successfully!');
    console.log(`📁 Output directory: ${distDir}`);
}

build().catch(console.error);