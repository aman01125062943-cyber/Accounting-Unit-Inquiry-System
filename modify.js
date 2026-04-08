const fs = require('fs');
let html = fs.readFileSync('wwwroot/index.html', 'utf8');

const navPattern = /<div class="nav-item(?: active)?" data-page="returns" onclick="app\.navigateTo\('returns'\)">[\s\S]*?<\/div>/;
const navMatch = html.match(navPattern);
if (navMatch) {
    let newNav = navMatch[0].replace(/"returns"/g, '"salary-returns"').replace(/'returns'/g, "'salary-returns'");
    newNav = newNav.replace('المرتدات', 'مرتدات المرتب').replace('active', '');
    newNav = newNav.replace('', '');
    
    if (!html.includes('data-page="salary-returns"')) {
        let index = navMatch.index + navMatch[0].length;
        html = html.substring(0, index) + "\n                    " + newNav + html.substring(index);
    }
}

const pagePattern = /<section id="page-returns" class="page-content(?: hidden)?">([\s\S]*?)<\/section>/;
const pageMatch = html.match(pagePattern);
if (pageMatch) {
    let newPage = `<section id="page-salary-returns" class="page-content hidden">\n${pageMatch[1]}\n</section>`;
    // Safely replace IDs
    const idsToReplace = [
        'stat-total-count', 'stat-total-amount', 'stat-pending', 'stat-returned',
        'table-search', 'attachment-status-filter', 'search-stats-overlay',
        'search-count', 'search-amount', 'search-open-count', 'search-open-amount',
        'search-settled-count', 'print-prep-progress', 'returns-table',
        'table-headers', 'table-body', 'empty-state', 'empty-import-btn'
    ];
    
    idsToReplace.forEach(id => {
        let regex = new RegExp(`id="${id}"`, 'g');
        newPage = newPage.replace(regex, `id="${id}-salary"`);
    });
    
    if (!html.includes('id="page-salary-returns"')) {
        let index = pageMatch.index + pageMatch[0].length;
        html = html.substring(0, index) + "\n\n                <!-- ========== Salary Returns Page ========== -->\n                " + newPage + html.substring(index);
    }
}

fs.writeFileSync('wwwroot/index.html', html, 'utf8');

let appJs = fs.readFileSync('wwwroot/js/app.js', 'utf8');
if (!appJs.includes('salary-returns:')) {
    let rpl = "returns: { icon: '', text: 'المرتدات' },\n            'salary-returns': { icon: '', text: 'مرتدات المرتب' },";
    appJs = appJs.replace("returns: { icon: '', text: 'المرتدات' },", rpl);
    fs.writeFileSync('wwwroot/js/app.js', appJs, 'utf8');
}
console.log('done modifying');
