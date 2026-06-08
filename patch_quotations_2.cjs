const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// Add quotation_type select in the form modal
content = content.replace(
  /<div className="form-group">\s*<label className="form-label">??????? \*<\/label>/,
  "<div className=\"form-group\">\n                    <label className=\"form-label\">??? ??? ?????</label>\n                    <select\n                      className=\"form-select\"\n                      value={form.quotation_type || 'supply_installation'}\n                      onChange={(e) => {\n                        const newType = e.target.value;\n                        setForm({ ...form, quotation_type: newType, details: createEmptyQuotationDetails(newType) });\n                      }}\n                    >\n                      <option value=\"supply_installation\">????? ?????? ?????</option>\n                      <option value=\"maintenance\">????? ?????</option>\n                    </select>\n                  </div>\n                  <div className=\"form-group\">\n                    <label className=\"form-label\">??????? *</label>"
);

// Replace mapping for sections inside the modal
content = content.replace(
  /\{QUOTATION_DETAIL_SECTIONS\.map\(section => \(/g,
  "{(form.quotation_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS).map(section => ("
);

// We need to also patch the View modal mapping where it displays sections
// First let's check what variable it uses for the type in the view modal.
// The selectedQuotation object might need to store quotation_type. Let's make sure quotation_type is saved in the DB description.
// Wait, parseQuotationDescription handles details but doesn't handle quotation_type from the DB directly since it wasn't saved before. 
// However, the selectedQuotation has \quotation_type\ if we store it.
// Wait, the DB column for quotations doesn't have \quotation_type\. Let's store it inside the description JSON!
