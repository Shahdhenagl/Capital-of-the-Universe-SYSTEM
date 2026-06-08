const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// 1. Replace QUOTATION_DETAIL_SECTIONS and createEmptyQuotationDetails
content = content.replace(
  /const QUOTATION_DETAIL_SECTIONS = \[[\s\S]*?\];\s*function createEmptyQuotationDetails\(\) \{[\s\S]*?return acc;\n\s*\}, \{\}\);\n\}/,
  "function createEmptyQuotationDetails(type = 'supply_installation') {\n  if (type === 'maintenance') return createEmptyDetails(MAINTENANCE_SECTIONS);\n  return createEmptyDetails(INSTALL_SECTIONS);\n}"
);

// 2. Fix the initial form state
content = content.replace(
  /const \[form, setForm\] = useState\(\{\s*client_id: '',\s*service_id: '',\s*title: '',\s*description: '',\s*details: createEmptyQuotationDetails\(\),\s*amount: '',\s*branch: 'mecca',\s*pdf_file: null\s*\}\);/,
  "const [form, setForm] = useState({\n    quotation_type: 'supply_installation',\n    client_id: '',\n    service_id: '',\n    title: '',\n    description: '',\n    details: createEmptyQuotationDetails('supply_installation'),\n    amount: '',\n    branch: 'mecca',\n    pdf_file: null\n  });"
);

// 3. Fix parseQuotationDescription
content = content.replace(
  /function parseQuotationDescription\(description\) \{\s*if \(!description\) return \{ plainDescription: '', details: createEmptyQuotationDetails\(\) \};\s*try \{\s*const parsed = JSON\.parse\(description\);\s*return \{\s*plainDescription: parsed\.plainDescription \|\| '',\s*details: \{\s*\.\.\.createEmptyQuotationDetails\(\),\s*\.\.\.\(parsed\.details \|\| \{\}\)\s*\}\s*\};\s*\} catch \{\s*return \{ plainDescription: description \};\s*\}\s*\}/,
  "function parseQuotationDescription(description) {\n  if (!description) return { quotation_type: 'supply_installation', plainDescription: '', details: createEmptyQuotationDetails('supply_installation') };\n  try {\n    const parsed = JSON.parse(description);\n    const qType = parsed.quotation_type || 'supply_installation';\n    return {\n      quotation_type: qType,\n      plainDescription: parsed.plainDescription || '',\n      details: {\n        ...createEmptyQuotationDetails(qType),\n        ...(parsed.details || {})\n      }\n    };\n  } catch {\n    return { quotation_type: 'supply_installation', plainDescription: description, details: createEmptyQuotationDetails('supply_installation') };\n  }\n}"
);

// 4. Fix buildQuotationDescription
content = content.replace(
  /function buildQuotationDescription\(\) \{\s*return JSON\.stringify\(\{\s*plainDescription: form\.description,\s*details: form\.details\s*\}\);\s*\}/,
  "function buildQuotationDescription() {\n    return JSON.stringify({\n      quotation_type: form.quotation_type || 'supply_installation',\n      plainDescription: form.description,\n      details: form.details\n    });\n  }"
);

// 5. Fix resetForm
content = content.replace(
  /function resetForm\(\) \{\s*setForm\(\{\s*client_id: '',\s*service_id: '',\s*title: '',\s*description: '',\s*details: createEmptyQuotationDetails\(\),\s*amount: '',\s*branch: 'mecca',\s*pdf_file: null\s*\}\);\s*\}/,
  "function resetForm() {\n    setForm({\n      quotation_type: 'supply_installation',\n      client_id: '',\n      service_id: '',\n      title: '',\n      description: '',\n      details: createEmptyQuotationDetails('supply_installation'),\n      amount: '',\n      branch: 'mecca',\n      pdf_file: null\n    });\n  }"
);

// 6. Fix getQuotationDetailRows
content = content.replace(
  /function getQuotationDetailRows\(quotation\) \{\s*const parsed = parseQuotationDescription\(quotation\.description\);\s*return QUOTATION_DETAIL_SECTIONS\.flatMap\(section =>\s*section\.fields\s*\.map\(\(\[field, label\]\) => \(\{\s*section: section\.title,\s*label,\s*value: parsed\.details\?\.\[section\.key\]\?\.\[field\]\s*\}\)\)\s*\.filter\(row => row\.value\)\s*\);\s*\}/,
  "function getQuotationDetailRows(quotation) {\n    const parsed = parseQuotationDescription(quotation.description);\n    const sections = parsed.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS;\n    return sections.flatMap(section =>\n      section.fields\n        .map(([field, label]) => ({\n          section: section.title,\n          label,\n          value: parsed.details?.[section.key]?.[field]\n        }))\n        .filter(row => row.value !== undefined && row.value !== '' && row.value !== false)\n    );\n  }"
);

// 7. Fix mapping inside form modal
content = content.replace(
  /\{QUOTATION_DETAIL_SECTIONS\.map\(section => \(/,
  "<div className=\"form-group\">\n                  <label className=\"form-label\">??? ??? ?????</label>\n                  <select\n                    className=\"form-select\"\n                    value={form.quotation_type || 'supply_installation'}\n                    onChange={(e) => {\n                      const newType = e.target.value;\n                      setForm({ ...form, quotation_type: newType, details: createEmptyQuotationDetails(newType) });\n                    }}\n                  >\n                    <option value=\"supply_installation\">????? ?????? ?????</option>\n                    <option value=\"maintenance\">????? ?????</option>\n                  </select>\n                </div>\n                {(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).map(section => ("
);

// 8. Fix saveMemory loop
content = content.replace(
  /QUOTATION_DETAIL_SECTIONS\.forEach\(section => \{/g,
  "(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).forEach(section => {"
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
