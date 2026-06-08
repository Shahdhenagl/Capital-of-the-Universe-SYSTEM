const fs = require('fs');
let content = fs.readFileSync('src/pages/InstallationPhases.jsx', 'utf8');

// Replace export default function InstallationPhases() with export default function InstallationPhases({ cityFilter = 'all' })
content = content.replace(
  'export default function InstallationPhases() {',
  'export default function InstallationPhases({ cityFilter = ' + "'all'" + ' }) {'
);

// Replace filterBranch with cityFilter
// Remove the useState line for filterBranch
content = content.replace(
  /const \[filterBranch, setFilterBranch\] = useState\('all'\);\n/g,
  ''
);

// Replace filterBranch usage in matchesBranch
content = content.replace(
  /const matchesBranch = filterBranch === 'all' \|\| phase\.branch === filterBranch;/g,
  "const matchesBranch = cityFilter === 'all' || phase.branch === cityFilter;"
);

// Remove the filterBranch select element
content = content.replace(
  /<select[\s\S]*?value=\{filterBranch\}[\s\S]*?onChange=\{\(e\) => setFilterBranch\(e\.target\.value\)\}[\s\S]*?<\/select>/g,
  ''
);

fs.writeFileSync('src/pages/InstallationPhases.jsx', content);
