const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(filePath));
    } else { 
      if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('c:/Users/jhona/RimMET/src');

files.forEach(file => {
  if (file.includes('fix_storage.cjs') || file.includes('fix_storage.js') || file.includes('storage.js')) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('localStorage.')) {
    if (!content.includes('safeStorage')) {
      let relativePath = path.relative(path.dirname(file), 'c:/Users/jhona/RimMET/src/shared/utils/storage.js').replace(/\\/g, '/');
      let importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      importPath = importPath.replace('.js', '');
      const importStmt = "import { safeStorage } from '" + importPath + "';\n";
      
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLine = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLine + 1) + importStmt + content.slice(endOfLine + 1);
      } else {
        content = importStmt + content;
      }
    }
    
    content = content.replace(/localStorage\./g, 'safeStorage.');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
  }
});
