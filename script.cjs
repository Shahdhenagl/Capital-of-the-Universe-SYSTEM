const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// 1. Remove the intercept for 'final_approved' in handleStatusChange
content = content.replace(
  /if \(newStatus === 'final_approved'\) \{[\s\S]*?return;\r?\n    \}/,
  ""
);

// 2. We need to add 'quotation_type' or 'service_type' column to the table. Let's see if there is quotation_type in the data.
// Wait, the state form has 'quotation_type', let's check what it uses. It actually uses 'service_type' in insert? Let's check handleAddQuotation.
