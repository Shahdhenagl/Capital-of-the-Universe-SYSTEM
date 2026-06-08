const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

content = content.replace(
  /function getQuotationDetailRows\(quotation\) \{[\s\S]*?const parsed = parseQuotationDescription\(quotation\.description\);[\s\S]*?return QUOTATION_DETAIL_SECTIONS\.flatMap\(section =>[\s\S]*?section\.fields[\s\S]*?\.map\(\(\[field, label\]\) => \(\{[\s\S]*?section: section\.title,[\s\S]*?label,[\s\S]*?value: parsed\.details\?\.\[section\.key\]\?\.\[field\][\s\S]*?\}\)\)[\s\S]*?\.filter\(row => row\.value\)[\s\S]*?\);[\s\S]*?\}/,
  \unction getQuotationDetailRows(quotation) {
    const parsed = parseQuotationDescription(quotation.description);
    const sections = parsed.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS;
    return sections.flatMap(section =>
      section.fields
        .map(([field, label]) => ({
          section: section.title,
          label,
          value: parsed.details?.[section.key]?.[field]
        }))
        .filter(row => row.value)
    );
  }\
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
