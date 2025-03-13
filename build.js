// build.js - Custom build script for Vercel deployment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting custom build process for GitLab CI Analytics');

// Check if we're in a Vercel environment
const isVercel = process.env.VERCEL === '1';
console.log(`Build environment: ${isVercel ? 'Vercel' : 'Local'}`);

try {
  // Run the Vite build
  console.log('📦 Building the frontend with Vite...');
  execSync('vite build', { stdio: 'inherit' });
  console.log('✅ Frontend build successful!');
  
  // Create a build info file to help with debugging
  const buildInfo = {
    timestamp: new Date().toISOString(),
    environment: isVercel ? 'Vercel' : 'Local',
    node_version: process.version,
    npm_version: execSync('npm -v').toString().trim(),
  };
  
  // Check if dist directory exists
  if (!fs.existsSync('./dist')) {
    console.log('⚠️ Warning: dist directory not found, creating it...');
    fs.mkdirSync('./dist', { recursive: true });
  }
  
  // Write build info to a file in the dist directory
  fs.writeFileSync(
    path.join('./dist', 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
  );
  console.log('📝 Created build-info.json for debugging');
  
  // Copy public files to dist if not automatically handled
  if (fs.existsSync('./public')) {
    console.log('📁 Copying public files to dist directory...');
    const publicFiles = fs.readdirSync('./public');
    
    publicFiles.forEach(file => {
      const sourcePath = path.join('./public', file);
      const destPath = path.join('./dist', file);
      
      // Only copy files, not directories
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`  - Copied ${file}`);
      }
    });
  }
  
  // Ensure index.html is in the dist directory
  if (!fs.existsSync('./dist/index.html')) {
    console.log('⚠️ Warning: index.html not found in dist directory');
    if (fs.existsSync('./index.html')) {
      console.log('  - Copying index.html from root directory...');
      fs.copyFileSync('./index.html', './dist/index.html');
    }
  } else {
    console.log('✅ index.html found in dist directory');
  }
  
  // Check for JS assets
  const distContents = fs.readdirSync('./dist');
  const jsAssets = distContents.filter(file => file.endsWith('.js'));
  console.log(`📊 Found ${jsAssets.length} JavaScript files in dist directory`);
  
  if (jsAssets.length > 0) {
    jsAssets.forEach(file => {
      console.log(`  - ${file}`);
    });
  } else {
    console.log('⚠️ Warning: No JavaScript files found in dist directory');
  }
  
  console.log('🎉 Build process completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
