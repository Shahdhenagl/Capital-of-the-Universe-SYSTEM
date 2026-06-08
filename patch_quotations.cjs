const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

content = content.replace(
  /function Quotations\(\{ cityFilter: globalCityFilter = 'all' \}\) \{/,
  "function Quotations({ cityFilter = 'all' }) {"
);

content = content.replace(
  /const \[cityFilter, setCityFilter\] = useState\('all'\);\n/g,
  ''
);

// Remove the local city-filter-navbar in Quotations.jsx
content = content.replace(
  /<div className="city-filter-navbar">[\s\S]*?<\/div>/g,
  ''
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
