// ==========================================
// BUILD-INDEX.JS - Markdown to JSON Converter
// Converts .md files from Netlify CMS to .json for frontend
// Runs on every Netlify deploy
// ==========================================

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// ==========================================
// CONFIGURATION
// ==========================================

const POSTS_DIR = path.join(__dirname, 'data', 'posts');
const DEFAULT_IMAGE = '/images/placeholder.jpg';
const SITE_URL = 'https://bookmyads.in';

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function log(message, type = 'info') {
    const prefix = {
        'info': '📘',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'processing': '🔄'
    }[type] || '📘';
    console.log(`${prefix} ${message}`);
}

// Generate slug from title (fallback)
function generateSlug(text) {
    if (!text) return 'untitled';
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
}

// Clean HTML content (ensure it's safe)
function cleanHtmlContent(content) {
    if (!content) return '<p>No content available.</p>';
    
    // Basic cleanup - preserve paragraphs
    let cleaned = content;
    
    // Ensure paragraphs are wrapped properly
    if (!cleaned.includes('<p>') && !cleaned.includes('<div>')) {
        cleaned = cleaned.split('\n\n').map(para => {
            if (para.trim()) {
                return `<p>${para.trim().replace(/\n/g, '<br>')}</p>`;
            }
            return '';
        }).join('');
    }
    
    return cleaned || '<p>No content available.</p>';
}

// Extract plain text for summary
function extractPlainText(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 160);
}

// Format date for JSON
function formatDate(date) {
    if (!date) return new Date().toISOString();
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return new Date().toISOString();
        return d.toISOString();
    } catch {
        return new Date().toISOString();
    }
}

// ==========================================
// MARKDOWN TO JSON CONVERSION
// ==========================================

function convertMarkdownToJson(mdFilePath) {
    try {
        // Read the markdown file
        const fileContent = fs.readFileSync(mdFilePath, 'utf8');
        
        // Parse frontmatter
        const { data: frontmatter, content: markdownContent } = matter(fileContent);
        
        // Extract slug from filename
        const filename = path.basename(mdFilePath, '.md');
        
        // Build the JSON object
        const jsonPost = {
            id: frontmatter.id || frontmatter.slug || filename,
            title: frontmatter.title || 'Untitled',
            slug: frontmatter.slug || filename,
            date: formatDate(frontmatter.date),
            author: frontmatter.author || 'ByteBulletin Staff',
            image: frontmatter.image && frontmatter.image !== '' ? frontmatter.image : DEFAULT_IMAGE,
            category: frontmatter.category || 'News',
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
            featured: frontmatter.featured === true,
            summary: frontmatter.summary || extractPlainText(markdownContent),
            content: cleanHtmlContent(markdownContent),
            readingTime: frontmatter.readingTime || null,
            seoTitle: frontmatter.seo?.seoTitle || frontmatter.seoTitle || null,
            seoDescription: frontmatter.seo?.seoDescription || frontmatter.seoDescription || null
        };
        
        // Ensure tags is always an array
        if (!Array.isArray(jsonPost.tags)) {
            jsonPost.tags = jsonPost.tags ? [jsonPost.tags] : [];
        }
        
        // Clean up empty strings
        if (jsonPost.seoTitle === '') delete jsonPost.seoTitle;
        if (jsonPost.seoDescription === '') delete jsonPost.seoDescription;
        if (jsonPost.readingTime === null) delete jsonPost.readingTime;
        
        return jsonPost;
        
    } catch (err) {
        log(`Failed to convert ${path.basename(mdFilePath)}: ${err.message}`, 'error');
        return null;
    }
}

function saveJsonFile(jsonPost, outputPath) {
    try {
        fs.writeFileSync(outputPath, JSON.stringify(jsonPost, null, 2), 'utf8');
        return true;
    } catch (err) {
        log(`Failed to save ${path.basename(outputPath)}: ${err.message}`, 'error');
        return false;
    }
}

// ==========================================
// INDEX.JSON GENERATION
// ==========================================

function getAllJsonFiles() {
    try {
        const files = fs.readdirSync(POSTS_DIR);
        return files.filter(file => {
            return file.endsWith('.json') && file !== 'index.json';
        });
    } catch (err) {
        log(`Cannot read posts directory: ${err.message}`, 'error');
        return [];
    }
}

function getPostDateFromJson(jsonFilePath) {
    try {
        const filePath = path.join(POSTS_DIR, jsonFilePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const post = JSON.parse(content);
        return post.date ? new Date(post.date) : new Date(0);
    } catch (err) {
        log(`Cannot read date from ${jsonFilePath}: ${err.message}`, 'warning');
        return new Date(0);
    }
}

function sortJsonFilesByDate(jsonFiles) {
    const filesWithDates = jsonFiles.map(filename => {
        const date = getPostDateFromJson(filename);
        return { filename, date };
    });
    
    filesWithDates.sort((a, b) => b.date - a.date);
    return filesWithDates.map(item => item.filename);
}

function generateIndexJson(sortedFilenames) {
    const indexPath = path.join(POSTS_DIR, 'index.json');
    
    try {
        fs.writeFileSync(indexPath, JSON.stringify(sortedFilenames, null, 2), 'utf8');
        log(`index.json generated with ${sortedFilenames.length} posts`, 'success');
        return true;
    } catch (err) {
        log(`Failed to write index.json: ${err.message}`, 'error');
        return false;
    }
}

// ==========================================
// MAIN PROCESSING
// ==========================================

function processMarkdownFiles() {
    let convertedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Ensure posts directory exists
    if (!fs.existsSync(POSTS_DIR)) {
        log(`Creating posts directory: ${POSTS_DIR}`, 'processing');
        fs.mkdirSync(POSTS_DIR, { recursive: true });
        return { convertedCount, errorCount, skippedCount };
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(POSTS_DIR);
    
    // Process only .md files
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    if (mdFiles.length === 0) {
        log('No markdown files found to convert', 'info');
        return { convertedCount, errorCount, skippedCount };
    }
    
    log(`Found ${mdFiles.length} markdown file(s) to process`, 'processing');
    
    for (const mdFile of mdFiles) {
        const mdPath = path.join(POSTS_DIR, mdFile);
        const jsonFilename = mdFile.replace(/\.md$/, '.json');
        const jsonPath = path.join(POSTS_DIR, jsonFilename);
        
        log(`Processing: ${mdFile} → ${jsonFilename}`, 'info');
        
        // Convert markdown to JSON
        const jsonPost = convertMarkdownToJson(mdPath);
        
        if (jsonPost) {
            // Save JSON file
            if (saveJsonFile(jsonPost, jsonPath)) {
                convertedCount++;
                log(`✓ Converted: ${mdFile}`, 'success');
            } else {
                errorCount++;
            }
        } else {
            errorCount++;
        }
    }
    
    return { convertedCount, errorCount, skippedCount };
}

function updateIndexJson() {
    log('Updating index.json...', 'processing');
    
    const jsonFiles = getAllJsonFiles();
    
    if (jsonFiles.length === 0) {
        log('No JSON files found, creating empty index.json', 'warning');
        generateIndexJson([]);
        return false;
    }
    
    const sortedFiles = sortJsonFilesByDate(jsonFiles);
    generateIndexJson(sortedFiles);
    
    // Show preview of sorted files
    if (sortedFiles.length > 0) {
        log(`Newest: ${sortedFiles[0]}`, 'info');
        if (sortedFiles.length > 1) {
            log(`Oldest: ${sortedFiles[sortedFiles.length - 1]}`, 'info');
        }
    }
    
    return true;
}

// ==========================================
// CLEANUP: Remove orphaned JSON files
// (JSON files that no longer have a corresponding .md file)
// ==========================================

function cleanupOrphanedJsonFiles() {
    let removedCount = 0;
    
    try {
        const files = fs.readdirSync(POSTS_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        // Create set of expected JSON filenames (from .md files)
        const expectedJsonFiles = new Set(mdFiles.map(md => md.replace(/\.md$/, '.json')));
        
        for (const jsonFile of jsonFiles) {
            if (!expectedJsonFiles.has(jsonFile)) {
                const jsonPath = path.join(POSTS_DIR, jsonFile);
                fs.unlinkSync(jsonPath);
                log(`Removed orphaned JSON: ${jsonFile}`, 'warning');
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            log(`Cleaned up ${removedCount} orphaned JSON file(s)`, 'success');
        }
        
        return removedCount;
    } catch (err) {
        log(`Cleanup error: ${err.message}`, 'error');
        return 0;
    }
}

// ==========================================
// MAIN FUNCTION
// ==========================================

function main() {
    console.log('\n' + '='.repeat(60));
    log('BYTEBULLETIN MARKDOWN TO JSON CONVERTER', 'processing');
    console.log('='.repeat(60) + '\n');
    
    log(`Posts directory: ${POSTS_DIR}`, 'info');
    
    // Step 1: Convert .md to .json
    const { convertedCount, errorCount, skippedCount } = processMarkdownFiles();
    
    // Step 2: Clean up orphaned JSON files
    const cleanedCount = cleanupOrphanedJsonFiles();
    
    // Step 3: Generate/Update index.json
    const indexUpdated = updateIndexJson();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    log('BUILD SUMMARY', 'processing');
    console.log('='.repeat(60));
    log(`Markdown files converted: ${convertedCount}`, 'success');
    if (errorCount > 0) log(`Conversion errors: ${errorCount}`, 'error');
    if (cleanedCount > 0) log(`Orphaned JSON removed: ${cleanedCount}`, 'warning');
    log(`index.json status: ${indexUpdated ? 'Updated' : 'Failed'}`, indexUpdated ? 'success' : 'error');
    console.log('='.repeat(60) + '\n');
    
    if (errorCount > 0) {
        log('Build completed with errors. Check logs above.', 'warning');
    } else {
        log('Build completed successfully! 🎉', 'success');
    }
    
    // Always exit with 0 to prevent Netlify build failure
    // (errors are logged but don't crash the build)
    process.exit(0);
}

// ==========================================
// RUN THE SCRIPT
// ==========================================

try {
    main();
} catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error('   The build will continue but posts may not be converted.\n');
    // Exit with 0 to prevent Netlify build failure
    process.exit(0);
}
