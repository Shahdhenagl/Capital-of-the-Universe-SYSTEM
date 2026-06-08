const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// 1. Remove the intercept for 'final_approved'
content = content.replace(
  /if \(newStatus === 'final_approved'\) \{[\s\S]*?return;\r?\n    \}/,
  ""
);

// 2. Add '??? ?????' column
content = content.replace(
  /<th>???????<\/th>/,
  "<th>??? ?????</th>\n                <th>???????</th>"
);
content = content.replace(
  /<td>\{q\.title \|\| '-'\}<\/td>/,
  "<td>{parseQuotationDescription(q.description)?.quotation_type === 'maintenance' ? '?????' : '????? ??????'}</td>\n                  <td>{q.title || '-'}</td>"
);

// 3. Add "????? ???" button for final_approved quotations
content = content.replace(
  /\{(\/\* Manager Final Decision Actions \*\/|isAdmin \|\| profile\?\.role === 'manager')[\s\S]*?onClick=\{\(\) => handleStatusChange\(q, 'final_approved'\)\} \/\/ Will open contract modal[\s\S]*?title="?????? ????? \(????? ????\)"[\s\S]*?<\/button>[\s\S]*?<\/button>[\s\S]*?<\/?>\r?\n\s*\)\}/,
  {/* Manager Final Decision Actions */}
                      {(isAdmin || profile?.role === 'manager') && ['client_accepted', 'client_negotiating', 'client_rejected'].includes(q.status) && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'final_approved')}
                            title="?????? ?????"
                          >
                            <Check size={16} className="text-success" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'final_rejected')}
                            title="??? ?????"
                          >
                            <X size={16} className="text-danger" />
                          </button>
                        </>
                      )}
                      {q.status === 'final_approved' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => navigate('/contracts?quotation_id=' + q.id)}
                          title="????? ??? ?? ?????"
                        >
                          ????? ???
                        </button>
                      )}
);

fs.writeFileSync('src/pages/Quotations.jsx', content);
