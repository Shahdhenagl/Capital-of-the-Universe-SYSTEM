const fs = require('fs');

// Patch Contracts.jsx
let contracts = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');
if (!contracts.includes('new URLSearchParams')) {
  contracts = contracts.replace(
    /useEffect\(\(\) => \{\n\s*fetchContracts\(\);\n\s*fetchClients\(\);/,
    "useEffect(() => {\n    fetchContracts();\n    fetchClients();\n    const params = new URLSearchParams(window.location.search);\n    if (params.get('new') === '1') {\n      setShowAddModal(true);\n      if (params.get('client_id')) {\n        setForm(prev => ({ ...prev, client_id: params.get('client_id') }));\n      }\n    }\n"
  );
  fs.writeFileSync('src/pages/Contracts.jsx', contracts);
}

// Patch Quotations.jsx
let quotations = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');
if (!quotations.includes('new URLSearchParams')) {
  quotations = quotations.replace(
    /useEffect\(\(\) => \{\n\s*fetchQuotations\(\);\n\s*fetchClients\(\);/,
    "useEffect(() => {\n    fetchQuotations();\n    fetchClients();\n    const params = new URLSearchParams(window.location.search);\n    if (params.get('new') === '1') {\n      setShowAddModal(true);\n      if (params.get('client_id')) {\n        setForm(prev => ({ ...prev, client_id: params.get('client_id') }));\n      }\n    }\n"
  );
  fs.writeFileSync('src/pages/Quotations.jsx', quotations);
}
