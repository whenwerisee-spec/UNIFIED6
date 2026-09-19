const fs = require('fs');
const path = require('path');

function checkBalance(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tags = ['div', 'section', 'main'];
    const results = {};

    tags.forEach(tag => {
        const openRegex = new RegExp(`<${tag}(\\s|>)`, 'g');
        const closeRegex = new RegExp(`</${tag}>`, 'g');
        const opens = (content.match(openRegex) || []).length;
        const closes = (content.match(closeRegex) || []).length;
        results[tag] = { opens, closes, balanced: opens === closes };
    });

    return results;
}

const projectRoot = path.join(__dirname, '..');
const files = [
    path.join(projectRoot, 'src/App.tsx'),
    path.join(projectRoot, 'src/components/SovereignIntelligenceView.tsx')
];

let allFilesBalanced = true;

files.forEach(f => {
    console.log(`Auditing ${path.relative(projectRoot, f)}:`);
    try {
        const balance = checkBalance(f);
        console.log(JSON.stringify(balance, null, 2));
        const balanced = Object.values(balance).every(r => r.balanced);
        if (!balanced) {
            console.error(`ERROR: ${path.relative(projectRoot, f)} is NOT balanced!`);
            allFilesBalanced = false;
        }
    } catch (e) {
        console.error(`Failed to audit ${f}: ${e.message}`);
        allFilesBalanced = false;
    }
});

if (!allFilesBalanced) {
    process.exit(1);
} else {
    console.log('All files are balanced.');
}
