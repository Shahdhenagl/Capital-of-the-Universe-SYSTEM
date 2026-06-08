const fs = require('fs');
let content = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');

// 1. Update updateForm to autofill customer details
content = content.replace(
  'facility_name: client?.name || \\'\\',\\n          },',
  \acility_name: client?.name || '',
          },
          customer: {
            ...next.details.customer,
            customer_name: client?.name || next.details.customer?.customer_name || '',
            organization_name: client?.name || next.details.customer?.organization_name || '',
            mobile: client?.phone || next.details.customer?.mobile || '',
            contact_data: client?.phone || next.details.customer?.contact_data || '',
            address: defaultSite?.address || client?.address || next.details.customer?.address || '',
            identity_number: client?.cr_number || next.details.customer?.identity_number || ''
          },\
);

// 2. Update handleSaveContract to create/update client
content = content.replace(
  /if \(!form\\.client_id \\|\\| !form\\.contract_number \\|\\| !form\\.total_amount \\|\\| !form\\.start_date\) \\{[\\s\\S]*?return;\\n    \\}/,
  \if (!form.contract_number || !form.total_amount || !form.start_date) {
      alert('???? ????? ??? ????? ????? ????? ?????? ???????');
      return;
    }\
);

content = content.replace(
  'setSaving(true);\\n      const uploadedAttachments',
  \setSaving(true);
      
      let finalClientId = form.client_id;
      const custName = form.details?.customer?.customer_name || form.details?.customer?.organization_name;
      const custMobile = form.details?.customer?.mobile || form.details?.customer?.contact_data || '';
      const custIdentity = form.details?.customer?.identity_number || '';
      const custAddress = form.details?.customer?.address || '';

      if (!finalClientId) {
        if (!custName) {
           alert('???? ?????? ???? ?? ????? ??? ?????? ?????? ?? ?????? ??????');
           setSaving(false);
           return;
        }
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
          name: custName,
          phone: custMobile,
          address: custAddress,
          cr_number: custIdentity
        }).select().single();
        if (clientErr) throw clientErr;
        finalClientId = newClient.id;
      } else {
        if (custName) {
           const updatePayload = { name: custName };
           if (custMobile) updatePayload.phone = custMobile;
           if (custAddress) updatePayload.address = custAddress;
           if (custIdentity) updatePayload.cr_number = custIdentity;
           
           await supabase.from('clients').update(updatePayload).eq('id', finalClientId);
        }
      }

      const uploadedAttachments\
);

content = content.replace(
  'client_id: form.client_id,',
  'client_id: finalClientId,'
);

fs.writeFileSync('src/pages/Contracts.jsx', content);
