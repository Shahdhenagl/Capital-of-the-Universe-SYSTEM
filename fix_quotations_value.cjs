const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

content = content.replace(
  'value: parsed.details?.[section.key]?.[field]',
  "value: parsed.details?.[section.key]?.[field] === true ? '?????' : parsed.details?.[section.key]?.[field]"
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
