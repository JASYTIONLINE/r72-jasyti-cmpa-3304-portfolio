/**
 * ==============================================================================
 * DigiPort Project Tree Exporter
 * ------------------------------------------------------------------------------
 * This script scans the entire Project Directory from the root, detects every 
 * file and folder, and creates a flat list describing the full structure of 
 * the project. This includes both metadata (e.g. title, size, extension, sitemap 
 * inclusion) and classification (e.g. type, category).
 *
 * The script is intended to serve as a source of truth ("master data file")
 * for downstream tools: site maps, content audits, UIs, dashboards, etc.
 *
 * It outputs a single JSON file at: /assets/data/tree.json
 * ==============================================================================
 */

const fs = require('fs');           // Core Node module for reading and writing files
const path = require('path');       // Core module for handling file and folder paths

// ----------------------------------------------------------------------------
// Define the "Project Root"
// This tells the script where to begin scanning from.
// Since this script is run via a .bat file in the root, we use process.cwd()
// to dynamically detect the correct starting point. This ensures the script 
// always runs relative to where it’s executed, not where it's located.
// ----------------------------------------------------------------------------
const projectRoot = process.cwd();

// ----------------------------------------------------------------------------
// Define the output location
// We are hardcoding the path to write the final tree.json output into the 
// /assets/data/ subfolder inside the project directory.
// This ensures all exports are centralized in a known location.
// ----------------------------------------------------------------------------
const OUTPUT_PATH = path.join(projectRoot, 'assets', 'data', 'tree.json');

// ----------------------------------------------------------------------------
// Category Mapping
// This dictionary maps file extensions to general content types such as 
// 'image', 'audio', 'markup', etc. These labels can be used for filtering,
// icons, or grouping purposes in future tools.
// ----------------------------------------------------------------------------
const CATEGORY_MAP = {
  '.html': 'markup',
  '.css': 'stylesheet',
  '.js': 'script',
  '.json': 'data',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.ico': 'image',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.mp4': 'video',
  '.txt': 'document',
  '.md': 'document',
  '.bat': 'script',
  '.sh': 'script'
};

// ----------------------------------------------------------------------------
// Initialize the array to store the final output
// This array will contain a flat list of all files and folders in the project.
// Each entry will be a consistent object with keys like name, path, type, etc.
// ----------------------------------------------------------------------------
const output = [];

// ----------------------------------------------------------------------------
// Initialize counters for statistics
// These counters will be incremented during the scan to report summary stats
// at the end of the run. This helps confirm that the script processed the
// expected number of files and folders.
// ----------------------------------------------------------------------------
let folderCount = 0;
let fileCount = 0;
let parseWarnings = 0;

/**
 * ------------------------------------------------------------------------------
 * Recursively walk through the project directory
 * ------------------------------------------------------------------------------
 * This function takes a directory path, reads its contents, and processes
 * everything inside it. If it finds a folder, it adds it to the output and 
 * then recurses into it. If it finds a file, it collects metadata and stores 
 * the result in the output array.
 *
 * The use of path.relative() ensures that every recorded path in the output
 * is relative to the root of the project, not to this script’s location.
 */
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      folderCount++;

      output.push({
        name: entry.name,       // folder name
        path: relativePath,     // relative path from root
        type: 'folder',
        ext: null,
        size: null,
        title: null,
        sitemap: null,
        category: null
      });

      walk(fullPath); // recursively scan the folder’s contents
    } else {
      fileCount++;

      const ext = path.extname(entry.name).toLowerCase(); // file extension like .html
      const stats = fs.statSync(fullPath);                // get file size in bytes
      const category = CATEGORY_MAP[ext] || 'unknown';    // assign category label

      let title = null;
      let sitemap = null;

      // For HTML files, we attempt to read and parse additional metadata:
      //  - <title> tag content
      //  - <meta name="sitemap" content="..."> inclusion or exclusion status
      // These values will be used to help sitemap rendering or page auditing.
      if (ext === '.html') {
        try {
          const contents = fs.readFileSync(fullPath, 'utf8');

          const titleMatch = contents.match(/<title>(.*?)<\/title>/i);
          const sitemapMatch = contents.match(/<meta\s+name=["']sitemap["']\s+content=["'](.*?)["']/i);

          if (titleMatch) title = titleMatch[1].trim();
          sitemap = sitemapMatch ? sitemapMatch[1].toLowerCase() : 'none';

        } catch (err) {
          parseWarnings++;
          console.warn(`⚠️  Failed to parse HTML metadata in: ${relativePath}`);
        }
      }

      // Push the file metadata object into the output array
      output.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        ext,
        size: stats.size,
        title,
        sitemap,
        category
      });
    }
  }
}

// ----------------------------------------------------------------------------
// Begin scan from the project root
// This starts the recursive walk and logs which directory was detected
// as the root of the project directory.
// ----------------------------------------------------------------------------
console.log(`🔍 Scanning project directory: ${projectRoot}`);
console.log('----------------------------------------');

// Begin walking through the file tree
walk(projectRoot);

// ----------------------------------------------------------------------------
// Ensure output folder exists
// This creates the parent directory for the output file if it doesn’t exist yet.
// The call to fs.mkdirSync() uses { recursive: true } to create any needed
// parent folders in one step without error if they already exist.
// ----------------------------------------------------------------------------
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

// ----------------------------------------------------------------------------
// Write the JSON file
// Here we serialize the `output` array to disk as a readable JSON file.
// The call to JSON.stringify(..., null, 2) ensures the result is nicely formatted
// with 2-space indentation, making it easy to read in text editors or viewers.
// ----------------------------------------------------------------------------
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

// ----------------------------------------------------------------------------
// Final console summary
// This section outputs a report to the terminal summarizing what the script did.
// It includes total file and folder counts, and any warnings encountered while
// parsing HTML. This helps validate correct operation and makes the tool
// self-auditing for every run.
// ----------------------------------------------------------------------------
console.log(`✅ JSON export complete.`);
console.log(`📦 Output written to: ${OUTPUT_PATH}`);
console.log('----------------------------------------');
console.log(`📁 Folders found: ${folderCount}`);
console.log(`📄 Files found:   ${fileCount}`);
console.log(`⚠️  Parse warnings: ${parseWarnings}`);
