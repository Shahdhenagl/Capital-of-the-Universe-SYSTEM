const fs = require('fs');
let content = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');

// The replacement chunk failed because of string mismatch. Let's just remove everything between <<<<<<< HEAD and >>>>>>> 266e2bb.*?\r?\n
content = content.replace(/<<<<<<< HEAD\r?\nconst INSTALL_SECTIONS[\s\S]*?>>>>>>> 266e2bb.*?\r?\n/g, '');

fs.writeFileSync('src/pages/Contracts.jsx', content);
