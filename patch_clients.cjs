const fs = require('fs');
let content = fs.readFileSync('src/pages/Clients.jsx', 'utf8');

content = content.replace(
  /function Clients\(\{ cityFilter: globalCityFilter = 'all' \}\) \{/,
  "function Clients({ cityFilter = 'all' }) {"
);

content = content.replace(
  /const \[cityFilter, setCityFilter\] = useState\('all'\);\n/g,
  ''
);

// Remove the local city-filter-navbar in Clients.jsx
content = content.replace(
  /<div className="city-filter-navbar">[\s\S]*?<\/div>/g,
  ''
);

fs.writeFileSync('src/pages/Clients.jsx', content);
