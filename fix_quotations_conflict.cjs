const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// Fix conflict 1
content = content.replace(
  /<<<<<<< HEAD\r?\nconst QUOTATION_DETAIL_SECTIONS[\s\S]*?=======\r?\nimport \{ INSTALL_SECTIONS, MAINTENANCE_SECTIONS, createEmptyDetails \} from '\.\.\/lib\/formSections';\r?\n>>>>>>> 266e2bb.*?\r?\n/g,
  "import { INSTALL_SECTIONS, MAINTENANCE_SECTIONS, createEmptyDetails } from '../lib/formSections';\n"
);

// Fix conflict 2
content = content.replace(
  /<<<<<<< HEAD\r?\n        \.filter\(row => hasDetailValue\(row\.value\)\)\r?\n=======\r?\n        \.filter\(row => row\.value !== undefined && row\.value !== '' && row\.value !== false\)\r?\n>>>>>>> 266e2bb.*?\r?\n/g,
  "        .filter(row => hasDetailValue(row.value))\n"
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
