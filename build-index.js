// ==========================================
// BUILD-INDEX.JS - Automatic index.json generator
// Runs on every Netlify deploy
// ==========================================

const fs = require('fs');
const path = require('path');

// Configuration
const POSTS_DIR = path.join(__dirname, 'data', 'posts');
const INDEX_PATH = path.join(POSTS_DIR, 'index.json');

console.log('\n🚀 ===== BYTEBULLETIN INDEX GENERATOR =====\n');

// Function to get all post files
function getPostFiles() {
    // Check if posts directory exists
    if (!fs.existsSync(POSTS_DIR)) {
        console.log(`📁 Creating posts directory: ${POSTS_DIR}`);
        fs.mkdirSync(POSTS_DIR, { recursive: true });
        return [];
    }
    
    // Read all files in directory
    const files = fs.readdirSync(POSTS_DIR);
    
    // Filter for JSON files, exclude index.json
    const postFiles = files.filter(file => {
        return file.endsWith('.json') && file !== 'index.json';
    });
    
    return postFiles;
}

// Function to extract date from a post file
function getPostDate(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const post = JSON.parse(content);
        
        // Try multiple date fields
        if (post.date) return new Date(post.date);
        if (post.publishDate) return new Date(post.publishDate);
        if (post.publishedDate) return new Date(post.publishedDate);
        
        // Fallback to file modification time
        const stats = fs.statSync(filePath);
        return stats.mtime;
    } catch (err) {
        console.warn(`⚠️  Warning: Could not read date from ${path.basename(filePath)}`);
        // Return very old date as fallback
        return new Date(0);
    }
}

// Function to sort posts by date (newest first)
function sortPostsByDate(postFiles) {
    const postsWithDates = postFiles.map(filename => {
        const filePath = path.join(POSTS_DIR, filename);
        const date = getPostDate(filePath);
        return { filename, date };
    });
    
    // Sort by date descending (newest first)
    postsWithDates.sort((a, b) => b.date - a.date);
    
    // Return just the filenames in sorted order
    return postsWithDates.map(item => item.filename);
}

// Function to write index.json
function writeIndexFile(postFiles) {
    // Write as formatted JSON with 2-space indentation
    const jsonContent = JSON.stringify(postFiles, null, 2);
    fs.writeFileSync(INDEX_PATH, jsonContent, 'utf8');
}

// Function to check if index.json needs updating
function needsUpdate(currentPostFiles) {
    if (!fs.existsSync(INDEX_PATH)) {
        console.log('📝 index.json does not exist - will create it');
        return true;
    }
    
    try {
        const existingIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
        
        // Compare arrays (length and content)
        if (existingIndex.length !== currentPostFiles.length) {
            console.log('📝 Post count changed - updating index.json');
            return true;
        }
        
        // Check if any filenames are different
        for (let i = 0; i < existingIndex.length; i++) {
            if (existingIndex[i] !== currentPostFiles[i]) {
                console.log('📝 Post order or content changed - updating index.json');
                return true;
            }
        }
        
        console.log('✅ index.json is already up to date');
        return false;
    } catch (err) {
        console.log('📝 Existing index.json is invalid - will regenerate');
        return true;
    }
}

// Main function
function main() {
    console.log('🔍 Scanning posts directory...');
    console.log(`📂 Path: ${POSTS_DIR}\n`);
    
    // Get all post files
    const postFiles = getPostFiles();
    
    console.log(`📄 Found ${postFiles.length} post(s):`);
    if (postFiles.length > 0) {
        postFiles.forEach((file, i) => {
            console.log(`   ${i + 1}. ${file}`);
        });
    } else {
        console.log('   (No posts found yet)');
    }
    console.log('');
    
    // Sort by date (newest first)
    const sortedFiles = sortPostsByDate(postFiles);
    
    // Check if update is needed
    if (!needsUpdate(sortedFiles)) {
        console.log('\n✨ Done! No changes needed.\n');
        return;
    }
    
    // Write the new index.json
    writeIndexFile(sortedFiles);
    
    console.log('✅ SUCCESS: index.json has been generated!');
    console.log(`📍 Location: ${INDEX_PATH}`);
    console.log(`📋 Contains ${sortedFiles.length} post(s)`);
    
    if (sortedFiles.length > 0) {
        console.log(`\n📌 Newest post: ${sortedFiles[0]}`);
        if (sortedFiles.length > 1) {
            console.log(`📌 Oldest post: ${sortedFiles[sortedFiles.length - 1]}`);
        }
    }
    
    console.log('\n🎉 Ready for deployment!\n');
}

// Run the script
try {
    main();
} catch (error) {
    console.error('\n❌ ERROR: Failed to generate index.json');
    console.error(`   ${error.message}`);
    console.error('\n   Check that:');
    console.error('   1. The data/posts/ directory exists');
    console.error('   2. Your JSON files are valid');
    console.error('   3. You have write permissions\n');
    process.exit(1);
}