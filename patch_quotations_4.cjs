const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// Replace view modal mapping
content = content.replace(
  /\{QUOTATION_DETAIL_SECTIONS\.map\(section => \(/g,
  "{(selectedQuotation?.parsedDesc?.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).map(section => ("
);

// We also need to fix where parsedDesc is assigned to selectedQuotation if it isn't. Let's see how selectedQuotation is set.
