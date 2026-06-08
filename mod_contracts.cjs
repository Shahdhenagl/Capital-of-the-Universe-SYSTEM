const fs = require('fs');
let content = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');

// Update quotation parameter parsing logic to use quotation_id and perfectly parse the details.
const oldLogic =     const qid = params.get('new_from_quotation');
    if (!qid) return;
    // wait until clients are loaded
    if (!clients || clients.length === 0) return;

    (async () => {
      try {
        const { data: quotation, error } = await supabase.from('quotations').select('*').eq('id', qid).single();
        if (error || !quotation) return;

        // Prepare a contract form prefilled from the quotation
        resetForm('supply_installation');
        setForm(prev => ({
          ...prev,
          client_id: quotation.client_id || prev.client_id,
          title: quotation.title || prev.title,
          total_amount: quotation.amount || prev.total_amount,
          start_date: new Date().toISOString().split('T')[0],
          end_date: ''
        }));
        setPlainNotes(prev => (quotation.description || prev));
        setShowFormModal(true);
      } catch (e) {
        console.error('??? ?? ??? ?????? ????? ?????? ????? ?????:', e);
      }
    })();;

const newLogic =     const qid = params.get('quotation_id') || params.get('new_from_quotation');
    if (!qid) return;
    // wait until clients are loaded
    if (!clients || clients.length === 0) return;

    (async () => {
      try {
        const { data: quotation, error } = await supabase.from('quotations').select('*').eq('id', qid).single();
        if (error || !quotation) return;

        // Parse quotation description
        let parsed = { plainDescription: '', details: {}, quotation_type: 'supply_installation' };
        try {
          parsed = JSON.parse(quotation.description);
        } catch {
          parsed.plainDescription = quotation.description;
        }

        const contractType = parsed.quotation_type || 'supply_installation';
        
        // Prepare a contract form prefilled from the quotation
        resetForm(contractType);
        
        setForm(prev => ({
          ...prev,
          contract_type: contractType,
          client_id: quotation.client_id || prev.client_id,
          title: quotation.title || prev.title,
          total_amount: quotation.amount || prev.total_amount,
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          branch: quotation.branch || prev.branch,
          details: {
            ...prev.details,
            ...parsed.details,
            links: {
              ...(prev.details?.links || {}),
              ...(parsed.details?.links || {}),
            }
          }
        }));
        
        setPlainNotes(parsed.plainDescription || '');
        
        // Remove parameter from URL to avoid re-triggering
        window.history.replaceState({}, '', '/contracts');
        
        setShowFormModal(true);
      } catch (e) {
        console.error('??? ?? ??? ?????? ????? ?????? ????? ?????:', e);
      }
    })();;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/pages/Contracts.jsx', content);
