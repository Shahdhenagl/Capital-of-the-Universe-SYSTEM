const fs = require('fs');
let content = fs.readFileSync('src/pages/ClientProfile.jsx', 'utf8');

// Update openQuickModal buttons
content = content.replace(
  /onClick=\{\(\) => openQuickModal\('quotation'\)\}/g,
  "onClick={() => navigate(/quotations?new=1&client_id=\)}"
);
content = content.replace(
  /onClick=\{\(\) => openQuickModal\('contract'\)\}/g,
  "onClick={() => navigate(/contracts?new=1&client_id=\)}"
);

fs.writeFileSync('src/pages/ClientProfile.jsx', content);
