// ==========================================
// SITEMAP GENERATOR FOR BYTEBULLETIN
// Run this script to update sitemap.xml with all posts
// ==========================================

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://bookmyads.in';
const POSTS_DIR = path.join(__dirname, 'data', 'posts');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

// Format date for sitemap
function formatDate(dateString) {
    if (!dateString) return getCurrentDate();
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return getCurrentDate();
        return date.toISOString().split('T')[0];
    } catch {
        return getCurrentDate();
    }
}

// Get all post files
function getPostFiles() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.error('❌ Posts directory not found:', POSTS_DIR);
        return [];
    }
    
    const files = fs.readdirSync(POSTS_DIR);
    return files.filter(file => file.endsWith('.json') && file !== 'index.json');
}

// Get post data from file
function getPostData(filename) {
    try {
        const filePath = path.join(POSTS_DIR, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`⚠️ Error reading ${filename}:`, err.message);
        return null;
    }
}

// Generate sitemap XML
function generateSitemap(posts) {
    const currentDate = getCurrentDate();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

    <!-- ==================== STATIC PAGES ==================== -->
    
    <url>
        <loc>${SITE_URL}/</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/about.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/contact.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/privacy.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>yearly</changefreq>
        <priority>0.4</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/terms.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>yearly</changefreq>
        <priority>0.4</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/bookmarks.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.5</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/category.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    
    <url>
        <loc>${SITE_URL}/search.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.5</priority>
    </url>

    <!-- ==================== DYNAMIC POST PAGES ==================== -->
`;
    
    // Add each post
    for (const post of posts) {
        const postId = post.id || post.slug || path.basename(post.filename, '.json');
        const lastmod = formatDate(post.date);
        const priority = post.featured ? '0.9' : '0.7';
        
        xml += `
    <url>
        <loc>${SITE_URL}/post.html?id=${postId}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>${priority}</priority>
    </url>
`;
    }
    
    xml += `
</urlset>`;
    
    return xml;
}

// Main function
function main() {
    console.log('🔍 Generating sitemap.xml...');
    
    const postFiles = getPostFiles();
    console.log(`📄 Found ${postFiles.length} post files`);
    
    const posts = [];
    for (const filename of postFiles) {
        const postData = getPostData(filename);
        if (postData) {
            posts.push({
                ...postData,
                filename: filename
            });
        }
    }
    
    // Sort posts by date (newest first for sitemap order)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const sitemapXml = generateSitemap(posts);
    
    fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');
    console.log(`✅ Sitemap generated successfully at ${SITEMAP_PATH}`);
    console.log(`📋 Total URLs: ${posts.length + 8} (${posts.length} posts + 8 static pages)`);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { generateSitemap, getPostFiles, getPostData };