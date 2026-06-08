const fs = require('fs');
let content = fs.readFileSync('src/pages/Quotations.jsx', 'utf8');

// 1. Remove final_approved intercept
const p1 =     if (newStatus === 'final_approved') {
      setSelectedQuotation(quotation);
      setContractForm({
        total_amount: quotation.amount || '',
        payment_frequency: 'monthly',
        payment_method: 'cash',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      });
      setShowContractModal(true);
      return;
    };
content = content.replace(p1, '');

// 2. Add column headers
const p2 = <th>???????</th>;
const r2 = <th>??? ?????</th>\n                <th>???????</th>;
content = content.replace(p2, r2);

// 3. Add column data
const p3 = <td>{q.title || '-'}</td>;
const r3 = <td>{parseQuotationDescription(q.description)?.quotation_type === 'maintenance' ? '?????' : '????? ??????'}</td>\n                  <td>{q.title || '-'}</td>;
content = content.replace(p3, r3);

// 4. Add Create Contract button
const p4 = onClick={() => handleStatusChange(q, 'final_approved')} // Will open contract modal
                            title="?????? ????? (????? ????)";
const r4 = onClick={() => handleStatusChange(q, 'final_approved')}
                            title="?????? ?????";
content = content.replace(p4, r4);

const p5 = {(isAdmin || profile?.role === 'manager') && ['client_accepted', 'client_negotiating', 'client_rejected'].includes(q.status) && (
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
                      )};

const r5 = p5 + \n                      {q.status === 'final_approved' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => navigate('/contracts?quotation_id=' + q.id)}
                          title="????? ??? ?? ?????"
                        >
                          ????? ???
                        </button>
                      )};
content = content.replace(p5, r5);

fs.writeFileSync('src/pages/Quotations.jsx', content);
