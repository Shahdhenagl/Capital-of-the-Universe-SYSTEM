const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// Normalize line endings to \n for easier manipulation
content = content.replace(/\r\n/g, '\n');

// 1. Replace everything between const QUOTATION_DETAIL_SECTIONS = [ and  }, {});\n}
const startStr = 'const QUOTATION_DETAIL_SECTIONS = [';
const endStr = '  }, {});\n}';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr) + endStr.length;

if (startIdx !== -1 && content.indexOf(endStr) !== -1) {
  content = content.substring(0, startIdx) + 
"import { INSTALL_SECTIONS, MAINTENANCE_SECTIONS, createEmptyDetails } from '../lib/formSections';\n\nfunction createEmptyQuotationDetails(type = 'supply_installation') {\n  if (type === 'maintenance') return createEmptyDetails(MAINTENANCE_SECTIONS);\n  return createEmptyDetails(INSTALL_SECTIONS);\n}" + 
  content.substring(endIdx);
} else {
  console.log("Failed to find block 1");
}

// 2. Replace the form initialization
const formInitTarget = `const [form, setForm] = useState({
    client_id: '',
    service_id: '',
    title: '',
    description: '',
    details: createEmptyQuotationDetails(),
    amount: '',
    branch: 'mecca',
    pdf_file: null
  });`;
content = content.replace(formInitTarget, `const [form, setForm] = useState({
    quotation_type: 'supply_installation',
    client_id: '',
    service_id: '',
    title: '',
    description: '',
    details: createEmptyQuotationDetails('supply_installation'),
    amount: '',
    branch: 'mecca',
    pdf_file: null
  });`);

// 3. Replace parseQuotationDescription
const parseDescTarget = `function parseQuotationDescription(description) {
  if (!description) return { plainDescription: '', details: createEmptyQuotationDetails() };
  try {
    const parsed = JSON.parse(description);
    return {
      plainDescription: parsed.plainDescription || '',
      details: {
        ...createEmptyQuotationDetails(),
        ...(parsed.details || {})
      }
    };
  } catch {
    return { plainDescription: description, details: createEmptyQuotationDetails() };
  }
}`;
if(content.includes(parseDescTarget)) {
content = content.replace(parseDescTarget, `function parseQuotationDescription(description) {
  if (!description) return { quotation_type: 'supply_installation', plainDescription: '', details: createEmptyQuotationDetails('supply_installation') };
  try {
    const parsed = JSON.parse(description);
    const qType = parsed.quotation_type || 'supply_installation';
    return {
      quotation_type: qType,
      plainDescription: parsed.plainDescription || '',
      details: {
        ...createEmptyQuotationDetails(qType),
        ...(parsed.details || {})
      }
    };
  } catch {
    return { quotation_type: 'supply_installation', plainDescription: description, details: createEmptyQuotationDetails('supply_installation') };
  }
}`);
} else {
  console.log("Failed to find parseQuotationDescription");
}

// 4. Replace buildQuotationDescription
const buildDescTarget = `function buildQuotationDescription() {
    return JSON.stringify({
      plainDescription: form.description,
      details: form.details
    });
  }`;
if(content.includes(buildDescTarget)) {
content = content.replace(buildDescTarget, `function buildQuotationDescription() {
    return JSON.stringify({
      quotation_type: form.quotation_type || 'supply_installation',
      plainDescription: form.description,
      details: form.details
    });
  }`);
} else { console.log("Failed to find buildQuotationDescription"); }

// 5. Replace resetForm
const resetFormTarget = `function resetForm() {
    setForm({
      client_id: '',
      service_id: '',
      title: '',
      description: '',
      details: createEmptyQuotationDetails(),
      amount: '',
      branch: 'mecca',
      pdf_file: null
    });
  }`;
content = content.replace(resetFormTarget, `function resetForm() {
    setForm({
      quotation_type: 'supply_installation',
      client_id: '',
      service_id: '',
      title: '',
      description: '',
      details: createEmptyQuotationDetails('supply_installation'),
      amount: '',
      branch: 'mecca',
      pdf_file: null
    });
  }`);

// 6. Replace getQuotationDetailRows
const getRowsTarget = `function getQuotationDetailRows(quotation) {
    const parsed = parseQuotationDescription(quotation.description);
    return QUOTATION_DETAIL_SECTIONS.flatMap(section =>
      section.fields
        .map(([field, label]) => ({
          section: section.title,
          label,
          value: parsed.details?.[section.key]?.[field]
        }))
        .filter(row => row.value)
    );
  }`;
content = content.replace(getRowsTarget, `function getQuotationDetailRows(quotation) {
    const parsed = parseQuotationDescription(quotation.description);
    const sections = parsed.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS;
    return sections.flatMap(section =>
      section.fields
        .map(([field, label]) => ({
          section: section.title,
          label,
          value: parsed.details?.[section.key]?.[field]
        }))
        .filter(row => row.value !== undefined && row.value !== '' && row.value !== false)
    );
  }`);

// 7. Replace the map mapping
const mapTarget = `{QUOTATION_DETAIL_SECTIONS.map(section => (`;
content = content.replace(mapTarget, `<div className="form-group">
                  <label className="form-label">نوع عرض السعر</label>
                  <select
                    className="form-select"
                    value={form.quotation_type || 'supply_installation'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setForm({ ...form, quotation_type: newType, details: createEmptyQuotationDetails(newType) });
                    }}
                  >
                    <option value="supply_installation">توريد وتركيب مصاعد</option>
                    <option value="maintenance">صيانة مصاعد</option>
                  </select>
                </div>
                {(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).map(section => (`);

// 8. Replace saveMemory loop
const memoryLoopTarget = `QUOTATION_DETAIL_SECTIONS.forEach(section => {`;
content = content.replace(memoryLoopTarget, `(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).forEach(section => {`);

// Convert back to \r\n if we want or let Node do it, usually \n is fine for React.
fs.writeFileSync('src/pages/Quotations.jsx', content);
console.log("Successfully patched Quotations.jsx");
