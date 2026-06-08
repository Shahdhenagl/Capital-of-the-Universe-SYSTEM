const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// Fix quotationType error in resetForm
content = content.replace(
  /createEmptyQuotationDetails\(quotationType\)/g,
  "createEmptyQuotationDetails(form.quotation_type || 'supply_installation')"
);

// Add quotation_type to buildQuotationDescription
content = content.replace(
  /function buildQuotationDescription\(\) \{[\s\S]*?return JSON\.stringify\(\{[\s\S]*?plainDescription: form\.description,[\s\S]*?details: form\.details[\s\S]*?\}\);[\s\S]*?\}/,
  "function buildQuotationDescription() {\n    return JSON.stringify({\n      quotation_type: form.quotation_type || 'supply_installation',\n      plainDescription: form.description,\n      details: form.details\n    });\n  }"
);

// We need to parse quotation_type when editing/viewing.
content = content.replace(
  /function parseQuotationDescription\(description, quotationType = 'supply_installation'\) \{[\s\S]*?if \(!description\) return \{ plainDescription: '', details: createEmptyQuotationDetails\(form\.quotation_type \|\| 'supply_installation'\) \};[\s\S]*?try \{[\s\S]*?const parsed = JSON\.parse\(description\);[\s\S]*?return \{[\s\S]*?plainDescription: parsed\.plainDescription \|\| '',[\s\S]*?details: \{[\s\S]*?\.\.\.createEmptyQuotationDetails\(form\.quotation_type \|\| 'supply_installation'\),[\s\S]*?\.\.\.\(parsed\.details \|\| \{\}\)[\s\S]*?\}[\s\S]*?\};/,
  "function parseQuotationDescription(description) {\n  if (!description) return { quotation_type: 'supply_installation', plainDescription: '', details: createEmptyQuotationDetails('supply_installation') };\n  try {\n    const parsed = JSON.parse(description);\n    const qType = parsed.quotation_type || 'supply_installation';\n    return {\n      quotation_type: qType,\n      plainDescription: parsed.plainDescription || '',\n      details: {\n        ...createEmptyQuotationDetails(qType),\n        ...(parsed.details || {})\n      }\n    };\n"
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
