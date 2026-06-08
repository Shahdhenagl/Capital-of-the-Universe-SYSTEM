const fs = require('fs');
let content = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');

// Fix conflict 1 (lines 66-81)
content = content.replace(
  /<<<<<<< HEAD\r?\n    maintenance: \{\r?\n      preventive: true,\r?\n      corrective: true,\r?\n      emergency_247: true\r?\n    \},\r?\n    visits: \{\},\r?\n    sla: \{\},\r?\n    parts: \{\},\r?\n    links: \{\},\r?\n    alerts: \{\}\r?\n=======\r?\n    alerts: \{\r?\n      payment_status: 'regular'\r?\n    \}\r?\n>>>>>>> 266e2bb.*?\r?\n/g,
  "    maintenance: {\n      preventive: true,\n      corrective: true,\n      emergency_247: true\n    },\n    visits: {},\n    sla: {},\n    parts: {},\n    links: {},\n    alerts: {\n      payment_status: 'regular'\n    }\n"
);

// Fix conflict 2 (lines 87-237)
content = content.replace(
  /<<<<<<< HEAD\r?\nconst INSTALL_SECTIONS = \[\s\S]*?=======\r?\n>>>>>>> 266e2bb.*?\r?\n/g,
  ""
);

// Fix conflict 3 (lines 1541-1546)
content = content.replace(
  /<<<<<<< HEAD\r?\n                            <td><input className="form-input" value=\{row\.label\} onChange=\{e => updatePaymentRow\(index, 'label', e\.target\.value\)\} \/><\/td>\r?\n                            <td><input className="form-input" value=\{row\.description \|\| ''\} onChange=\{e => updatePaymentRow\(index, 'description', e\.target\.value\)\} placeholder="????: ???? ????? ??? ????? ?????" \/><\/td>\r?\n=======\r?\n                            <td><input className="form-input" value=\{row\.label\} onChange=\{e => updatePaymentRow\(index, 'label', e\.target\.value\)\} placeholder="????: ?????" \/><\/td>\r?\n>>>>>>> 266e2bb.*?\r?\n/g,
  "                            <td><input className=\"form-input\" value={row.label} onChange={e => updatePaymentRow(index, 'label', e.target.value)} placeholder=\"????: ?????\" /></td>\n                            <td><input className=\"form-input\" value={row.description || ''} onChange={e => updatePaymentRow(index, 'description', e.target.value)} placeholder=\"????: ???? ????? ??? ????? ?????\" /></td>\n"
);

fs.writeFileSync('src/pages/Contracts.jsx', content);
