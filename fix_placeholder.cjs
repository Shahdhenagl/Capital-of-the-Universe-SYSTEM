const fs = require('fs');
let content = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');

content = content.replace(
  '<input className="form-input" value={row.label} onChange={e => updatePaymentRow(index, \\'label\\', e.target.value)} />',
  '<input className="form-input" value={row.label} onChange={e => updatePaymentRow(index, \\'label\\', e.target.value)} placeholder="????: ?????" />'
);

fs.writeFileSync('src/pages/Contracts.jsx', content);
