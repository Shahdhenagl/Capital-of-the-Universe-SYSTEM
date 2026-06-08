const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// 1. Replace constant QUOTATION_DETAIL_SECTIONS
content = content.replace(
  /const QUOTATION_DETAIL_SECTIONS = \[[\s\S]*?\];\n\nfunction createEmptyQuotationDetails\(\) \{[\s\S]*?return acc;\n  \}, \{\}\);\n\}\n/,
  "import { INSTALL_SECTIONS, MAINTENANCE_SECTIONS, createEmptyDetails } from '../lib/formSections';\n\nfunction createEmptyQuotationDetails(type = 'supply_installation') {\n  if (type === 'maintenance') return createEmptyDetails(MAINTENANCE_SECTIONS);\n  return createEmptyDetails(INSTALL_SECTIONS);\n}\n"
);

// 2. Fix the initial form state
content = content.replace(
  /const \[form, setForm\] = useState\(\{\n    client_id: '',\n    service_id: '',\n    title: '',\n    description: '',\n    details: createEmptyQuotationDetails\(\),\n    amount: '',\n    branch: 'mecca',\n    pdf_file: null\n  \}\);/,
  "const [form, setForm] = useState({\n    quotation_type: 'supply_installation',\n    client_id: '',\n    service_id: '',\n    title: '',\n    description: '',\n    details: createEmptyQuotationDetails('supply_installation'),\n    amount: '',\n    branch: 'mecca',\n    pdf_file: null\n  });"
);

// 3. Fix parseQuotationDescription
content = content.replace(
  /function parseQuotationDescription\(description\) \{[\s\S]*?\}\n/g,
  "function parseQuotationDescription(description) {\n  if (!description) return { quotation_type: 'supply_installation', plainDescription: '', details: createEmptyQuotationDetails('supply_installation') };\n  try {\n    const parsed = JSON.parse(description);\n    const qType = parsed.quotation_type || 'supply_installation';\n    return {\n      quotation_type: qType,\n      plainDescription: parsed.plainDescription || '',\n      details: {\n        ...createEmptyQuotationDetails(qType),\n        ...(parsed.details || {})\n      }\n    };\n  } catch {\n    return { quotation_type: 'supply_installation', plainDescription: description, details: createEmptyQuotationDetails('supply_installation') };\n  }\n}\n"
);

// 4. Fix buildQuotationDescription
content = content.replace(
  /function buildQuotationDescription\(\) \{[\s\S]*?return JSON\.stringify\(\{[\s\S]*?plainDescription: form\.description,[\s\S]*?details: form\.details[\s\S]*?\}\);\n  \}/,
  "function buildQuotationDescription() {\n    return JSON.stringify({\n      quotation_type: form.quotation_type || 'supply_installation',\n      plainDescription: form.description,\n      details: form.details\n    });\n  }"
);

// 5. Fix resetForm
content = content.replace(
  /function resetForm\(\) \{[\s\S]*?setForm\(\{[\s\S]*?client_id: '',[\s\S]*?service_id: '',[\s\S]*?title: '',[\s\S]*?description: '',[\s\S]*?details: createEmptyQuotationDetails\(\),[\s\S]*?amount: '',[\s\S]*?branch: 'mecca',[\s\S]*?pdf_file: null[\s\S]*?\}\);[\s\S]*?\}/,
  "function resetForm() {\n    setForm({\n      quotation_type: 'supply_installation',\n      client_id: '',\n      service_id: '',\n      title: '',\n      description: '',\n      details: createEmptyQuotationDetails('supply_installation'),\n      amount: '',\n      branch: 'mecca',\n      pdf_file: null\n    });\n  }"
);

// 6. Fix getQuotationDetailRows mapping
content = content.replace(
  /function getQuotationDetailRows\(quotation\) \{[\s\S]*?const parsed = parseQuotationDescription\(quotation\.description\);[\s\S]*?return QUOTATION_DETAIL_SECTIONS\.flatMap\(section =>[\s\S]*?section\.fields[\s\S]*?\.map\(\(\[field, label\]\) => \(\{[\s\S]*?section: section\.title,[\s\S]*?label,[\s\S]*?value: parsed\.details\?\.\[section\.key\]\?\.\[field\][\s\S]*?\}\)\)[\s\S]*?\.filter\(row => row\.value\)[\s\S]*?\);[\s\S]*?\}/,
  "function getQuotationDetailRows(quotation) {\n    const parsed = parseQuotationDescription(quotation.description);\n    const sections = parsed.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS;\n    return sections.flatMap(section =>\n      section.fields\n        .map(([field, label]) => ({\n          section: section.title,\n          label,\n          value: parsed.details?.[section.key]?.[field]\n        }))\n        .filter(row => row.value !== undefined && row.value !== '' && row.value !== false)\n    );\n  }"
);

// 7. Fix mapping inside form modal (for editing/creating)
content = content.replace(
  /\{QUOTATION_DETAIL_SECTIONS\.map\(section => \(/,
  "<div className=\"form-group\">\n                  <label className=\"form-label\">??? ??? ?????</label>\n                  <select\n                    className=\"form-select\"\n                    value={form.quotation_type || 'supply_installation'}\n                    onChange={(e) => {\n                      const newType = e.target.value;\n                      setForm({ ...form, quotation_type: newType, details: createEmptyQuotationDetails(newType) });\n                    }}\n                  >\n                    <option value=\"supply_installation\">????? ?????? ?????</option>\n                    <option value=\"maintenance\">????? ?????</option>\n                  </select>\n                </div>\n                {(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).map(section => ("
);

// 8. Fix mapping in saveMemory logic
content = content.replace(
  /QUOTATION_DETAIL_SECTIONS\.forEach\(section => \{/g,
  "(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).forEach(section => {"
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
