const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace(
  /<Route path="\/installations" element=\{<ProtectedRoute permission="maintenance\.view"><InstallationPhases \/><\/ProtectedRoute>\} \/>/g,
  '<Route path="/installations" element={<ProtectedRoute permission="maintenance.view"><InstallationPhases cityFilter={cityFilter} /></ProtectedRoute>} />'
);

fs.writeFileSync('src/App.jsx', content);
