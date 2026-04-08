// ==========================================
// SEO ENHANCER FOR BYTEBULLETIN
// Dynamically adds canonical tags, meta tags, and SEO improvements
// No conflicts with existing script.js
// ==========================================

(function() {
    'use strict';
    
    // Configuration
    const SITE_URL = 'https://bookmyads.in';
    const SITE_NAME = 'ByteBulletin';
    const DEFAULT_IMAGE = 'https://bookmyads.in/images/placeholder.jpg';
    const TWITTER_HANDLE = '@bytebulletin'; // Change to your Twitter handle
    
    // Helper function to get URL parameters
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    // Helper function to get current page type
    function getPageType() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        
        if (filename === '' || filename === 'index.html') return 'home';
        if (filename === 'post.html') return 'post';
        if (filename === 'category.html') return 'category';
        if (filename === 'search.html') return 'search';
        if (filename === 'about.html') return 'about';
        if (filename === 'contact.html') return 'contact';
        if (filename === 'bookmarks.html') return 'bookmarks';
        if (filename === 'privacy.html') return 'privacy';
        if (filename === 'terms.html') return 'terms';
        return 'page';
    }
    
    // Function to add or update meta tag
    function addMetaTag(name, content, property = false) {
        if (!content) return;
        
        let selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
        let meta = document.querySelector(selector);
        
        if (!meta) {
            meta = document.createElement('meta');
            if (property) {
                meta.setAttribute('property', name);
            } else {
                meta.setAttribute('name', name);
            }
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
    }
    
    // Function to add or update link tag (for canonical)
    function addCanonicalLink(href) {
        if (!href) return;
        
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', href);
    }
    
    // Function to add Open Graph tags
    function addOpenGraphTags(title, description, image, url, type = 'website') {
        addMetaTag('og:title', title, true);
        addMetaTag('og:description', description, true);
        addMetaTag('og:image', image, true);
        addMetaTag('og:url', url, true);
        addMetaTag('og:type', type, true);
        addMetaTag('og:site_name', SITE_NAME, true);
        addMetaTag('og:locale', 'en_US', true);
    }
    
    // Function to add Twitter Card tags
    function addTwitterTags(title, description, image) {
        addMetaTag('twitter:card', 'summary_large_image');
        addMetaTag('twitter:site', TWITTER_HANDLE);
        addMetaTag('twitter:title', title);
        addMetaTag('twitter:description', description);
        addMetaTag('twitter:image', image);
    }
    
    // Function to get post data from JSON (async)
    async function getPostData(postId) {
        try {
            // First get index.json to find the filename
            const indexResponse = await fetch('/data/posts/index.json');
            if (!indexResponse.ok) return null;
            
            const filenames = await indexResponse.json();
            
            // Find the correct filename that matches the ID
            let postFilename = null;
            for (const filename of filenames) {
                if (filename.includes(postId) || filename.replace('.json', '') === postId) {
                    postFilename = filename;
                    break;
                }
            }
            
            if (!postFilename) return null;
            
            // Fetch the actual post
            const postResponse = await fetch(`/data/posts/${postFilename}`);
            if (!postResponse.ok) return null;
            
            return await postResponse.json();
        } catch (err) {
            console.warn('[SEO] Could not fetch post data:', err);
            return null;
        }
    }
    
    // ==================== HOMEPAGE SEO ====================
    async function handleHomepage() {
        const canonicalUrl = `${SITE_URL}/`;
        addCanonicalLink(canonicalUrl);
        
        const title = 'ByteBulletin - Breaking News & Headlines | Latest Updates';
        const description = 'Get the latest breaking news, in-depth analysis, and real-time updates from India and around the world. ByteBulletin delivers fast, reliable journalism.';
        
        // Update page title if not already set
        if (document.title === 'ByteBulletin - Breaking News & Headlines') {
            document.title = title;
        }
        
        addMetaTag('description', description);
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
        
        // Add additional meta tags
        addMetaTag('keywords', 'breaking news, India news, world news, latest headlines, current affairs');
        addMetaTag('author', 'ByteBulletin');
        addMetaTag('robots', 'index, follow');
        addMetaTag('googlebot', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    }
    
    // ==================== POST PAGE SEO ====================
    async function handlePostPage() {
        const postId = getUrlParameter('id');
        
        if (!postId) {
            // No ID parameter - redirect to homepage
            console.warn('[SEO] No post ID provided');
            addCanonicalLink(`${SITE_URL}/`);
            return;
        }
        
        const canonicalUrl = `${SITE_URL}/post.html?id=${postId}`;
        addCanonicalLink(canonicalUrl);
        
        // Fetch post data
        const post = await getPostData(postId);
        
        if (post) {
            // Use post data for SEO
            const title = post.seo?.seoTitle || post.title || 'Article - ByteBulletin';
            const description = post.seo?.seoDescription || post.summary || (post.content ? post.content.replace(/<[^>]*>/g, '').substring(0, 160) : 'Read the latest news on ByteBulletin');
            const image = post.image && post.image !== '' ? `${SITE_URL}${post.image}` : DEFAULT_IMAGE;
            const publishedTime = post.date || new Date().toISOString();
            const modifiedTime = post.updatedDate || post.date || new Date().toISOString();
            const author = post.author || 'ByteBulletin Staff';
            
            // Update document title
            document.title = `${title} - ByteBulletin`;
            
            // Add meta tags
            addMetaTag('description', description.substring(0, 160));
            addMetaTag('keywords', post.tags ? post.tags.join(', ') : post.category || 'news');
            addMetaTag('author', author);
            addMetaTag('robots', 'index, follow');
            addMetaTag('article:published_time', publishedTime);
            addMetaTag('article:modified_time', modifiedTime);
            addMetaTag('article:section', post.category || 'News');
            
            if (post.tags && post.tags.length) {
                post.tags.forEach(tag => {
                    addMetaTag('article:tag', tag);
                });
            }
            
            // Open Graph tags
            addOpenGraphTags(title, description, image, canonicalUrl, 'article');
            
            // Additional Open Graph for articles
            addMetaTag('og:article:published_time', publishedTime, true);
            addMetaTag('og:article:modified_time', modifiedTime, true);
            addMetaTag('og:article:author', author, true);
            addMetaTag('og:article:section', post.category || 'News', true);
            
            // Twitter Card
            addTwitterTags(title, description, image);
            
        } else {
            // Post not found - use generic tags
            const title = 'Article Not Found - ByteBulletin';
            const description = 'The requested article could not be found. Browse our latest news.';
            
            document.title = title;
            addMetaTag('description', description);
            addMetaTag('robots', 'noindex, follow');
            addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'article');
            addTwitterTags(title, description, DEFAULT_IMAGE);
        }
    }
    
    // ==================== CATEGORY PAGE SEO ====================
    async function handleCategoryPage() {
        const category = getUrlParameter('cat');
        const canonicalUrl = category ? `${SITE_URL}/category.html?cat=${encodeURIComponent(category)}` : `${SITE_URL}/category.html`;
        
        addCanonicalLink(canonicalUrl);
        
        let title, description;
        
        if (category) {
            title = `${category} News - Latest Updates & Headlines | ByteBulletin`;
            description = `Stay updated with the latest ${category} news, breaking stories, and in-depth analysis. Read trusted ${category} coverage on ByteBulletin.`;
            addMetaTag('keywords', `${category} news, ${category} updates, latest ${category} headlines`);
        } else {
            title = `News Categories - Browse All Topics | ByteBulletin`;
            description = `Browse news by category. Find the latest stories in Technology, Business, Sports, World News, India, and more on ByteBulletin.`;
            addMetaTag('keywords', 'news categories, browse news, topics');
        }
        
        document.title = title;
        addMetaTag('description', description);
        addMetaTag('robots', 'index, follow');
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    // ==================== SEARCH PAGE SEO ====================
    async function handleSearchPage() {
        const query = getUrlParameter('q');
        const canonicalUrl = `${SITE_URL}/search.html`;
        
        addCanonicalLink(canonicalUrl);
        
        let title, description;
        
        if (query) {
            title = `Search Results for "${query}" - ByteBulletin`;
            description = `Search results for "${query}". Find news articles, headlines, and stories matching your search on ByteBulletin.`;
            addMetaTag('robots', 'noindex, follow'); // Don't index search results
        } else {
            title = `Search News Articles - ByteBulletin`;
            description = `Search our news archive for the latest headlines, breaking stories, and in-depth articles.`;
            addMetaTag('robots', 'index, follow');
        }
        
        document.title = title;
        addMetaTag('description', description);
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    // ==================== STATIC PAGES SEO ====================
    function handleAboutPage() {
        const canonicalUrl = `${SITE_URL}/about.html`;
        addCanonicalLink(canonicalUrl);
        
        const title = 'About ByteBulletin - Our Mission & Team | Digital News Platform';
        const description = 'ByteBulletin is a digital news platform committed to delivering accurate, timely, and unbiased journalism from India and around the world.';
        
        document.title = title;
        addMetaTag('description', description);
        addMetaTag('keywords', 'about ByteBulletin, news about us, digital journalism, Indian news media');
        addMetaTag('robots', 'index, follow');
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    function handleContactPage() {
        const canonicalUrl = `${SITE_URL}/contact.html`;
        addCanonicalLink(canonicalUrl);
        
        const title = 'Contact ByteBulletin - News Tips, Feedback & Support';
        const description = 'Contact ByteBulletin newsroom for news tips, feedback, advertising inquiries, or support. Reach our team in Bangalore, India.';
        
        document.title = title;
        addMetaTag('description', description);
        addMetaTag('keywords', 'contact news, news tips, ByteBulletin support, report news');
        addMetaTag('robots', 'index, follow');
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    function handlePrivacyPage() {
        const canonicalUrl = `${SITE_URL}/privacy.html`;
        addCanonicalLink(canonicalUrl);
        
        const title = 'Privacy Policy - ByteBulletin';
        const description = 'ByteBulletin privacy policy outlines how we collect, use, and protect your data when you visit our news website.';
        
        document.title = title;
        addMetaTag('description', description);
        addMetaTag('robots', 'index, follow');
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    function handleTermsPage() {
        const canonicalUrl = `${SITE_URL}/terms.html`;
        addCanonicalLink(canonicalUrl);
        
        const title = 'Terms of Service - ByteBulletin';
        const description = 'ByteBulletin terms of service governing use of our news website, content usage, and user responsibilities.';
        
        document.title = title;
        addMetaTag('description', description);
        addMetaTag('robots', 'index, follow');
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    function handleBookmarksPage() {
        const canonicalUrl = `${SITE_URL}/bookmarks.html`;
        addCanonicalLink(canonicalUrl);
        
        const title = 'My Saved Articles - ByteBulletin';
        const description = 'Your saved news articles from ByteBulletin. Access your bookmarked stories anytime.';
        
        document.title = title;
        addMetaTag('description', description);
        addMetaTag('robots', 'noindex, follow'); // Personal page - don't index
        addOpenGraphTags(title, description, DEFAULT_IMAGE, canonicalUrl, 'website');
        addTwitterTags(title, description, DEFAULT_IMAGE);
    }
    
    // ==================== INITIALIZATION ====================
    async function initSEO() {
        const pageType = getPageType();
        
        switch(pageType) {
            case 'home':
                await handleHomepage();
                break;
            case 'post':
                await handlePostPage();
                break;
            case 'category':
                await handleCategoryPage();
                break;
            case 'search':
                await handleSearchPage();
                break;
            case 'about':
                handleAboutPage();
                break;
            case 'contact':
                handleContactPage();
                break;
            case 'privacy':
                handlePrivacyPage();
                break;
            case 'terms':
                handleTermsPage();
                break;
            case 'bookmarks':
                handleBookmarksPage();
                break;
            default:
                // Fallback for any other pages
                const canonicalUrl = `${SITE_URL}/${window.location.pathname}`;
                addCanonicalLink(canonicalUrl);
        }
        
        // Add viewport meta if missing
        if (!document.querySelector('meta[name="viewport"]')) {
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0';
            document.head.appendChild(viewport);
        }
        
        // Add theme color meta
        if (!document.querySelector('meta[name="theme-color"]')) {
            const themeColor = document.createElement('meta');
            themeColor.name = 'theme-color';
            themeColor.content = '#0a2540';
            document.head.appendChild(themeColor);
        }
        
        console.log('[SEO] SEO enhancements applied for page type:', pageType);
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSEO);
    } else {
        initSEO();
    }
})();