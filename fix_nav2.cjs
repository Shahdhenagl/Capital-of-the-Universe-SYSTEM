const fs = require('fs');
let content = fs.readFileSync('src/pages/ClientProfile.jsx', 'utf8');

content = content.replace(
  'onClick={() => navigate(/quotations?new=1&client_id=)}',
  'onClick={() => navigate(/quotations?new=1&client_id=\)}'
);

content = content.replace(
  'onClick={() => navigate(/contracts?new=1&client_id=)}',
  'onClick={() => navigate(/contracts?new=1&client_id=\)}'
);

fs.writeFileSync('src/pages/ClientProfile.jsx', content);
