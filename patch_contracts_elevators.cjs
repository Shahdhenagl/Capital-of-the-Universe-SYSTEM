const fs = require('fs');

let content = fs.readFileSync('src/pages/Contracts.jsx', 'utf8');

// 1. Add state variables
content = content.replace(
  'const [form, setForm] = useState(cloneForm);',
  `const [showElevatorModal, setShowElevatorModal] = useState(false);
  const [elevatorCount, setElevatorCount] = useState(1);
  const [form, setForm] = useState(cloneForm);`
);

// 2. Add trigger function
const triggerFunc = `
  const triggerSaveFlow = (e) => {
    e.preventDefault();
    if (!form.client_id && !form.details?.customer?.customer_name && !form.details?.customer?.organization_name) {
      alert('يرجى اختيار عميل أو إدخال اسم العميل الجديد في بيانات العميل');
      return;
    }
    // Only show modal for new contracts, or if they explicitly want to code.
    // We can just show it if it's not editing, or if editing and they want to add more.
    if (!editingContract) {
      setShowElevatorModal(true);
    } else {
      handleSaveContract();
    }
  };

  async function handleSaveContract() {`;

content = content.replace('  async function handleSaveContract(e) {', triggerFunc);
content = content.replace('    e.preventDefault();', '');

// 3. Add logic inside handleSaveContract
const elevatorLogic = `
      // --- Elevator logic ---
      if (!editingContract && elevatorCount > 0) {
        const prefix = (CITY_PREFIXES && CITY_PREFIXES[form.branch]) ? CITY_PREFIXES[form.branch] : 'E';
        const { data: highestElevators } = await supabase
          .from('elevators')
          .select('code')
          .eq('branch', form.branch)
          .order('code', { ascending: false })
          .limit(1);

        let startNum = 10000;
        if (highestElevators && highestElevators.length > 0) {
          const lastCode = highestElevators[0].code;
          const numPart = parseInt(lastCode.replace(/\\D/g, ''));
          if (!isNaN(numPart)) startNum = numPart;
        }

        const elevatorsToInsert = [];
        for (let i = 1; i <= elevatorCount; i++) {
          elevatorsToInsert.push({
            contract_id: contractData.id,
            client_id: finalClientId,
            branch: form.branch,
            code: \`\${prefix}\${startNum + i}\`
          });
        }
        if (elevatorsToInsert.length > 0) {
          const { error: elErr } = await supabase.from('elevators').insert(elevatorsToInsert);
          if (elErr) console.error('Error inserting elevators:', elErr);
        }
      }
      
      let insertedCollections = [];`;

content = content.replace('      let insertedCollections = [];', elevatorLogic);

// 4. Update the form onSubmit
content = content.replace('<form onSubmit={handleSaveContract}>', '<form onSubmit={triggerSaveFlow}>');

// 5. Add Elevator Modal
const elevatorModal = `
      {/* Elevator Coding Modal */}
      {showElevatorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>تكويد المصاعد</h3>
              <button className="icon-btn" onClick={() => setShowElevatorModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">كم عدد المصاعد في هذا العقد؟</label>
                <input 
                  type="number" 
                  min="1" 
                  max="50" 
                  className="form-input" 
                  value={elevatorCount} 
                  onChange={e => setElevatorCount(parseInt(e.target.value) || 1)} 
                />
                <p className="text-secondary mt-8" style={{fontSize: '0.8rem'}}>
                  سيتم إنشاء أرقام تسلسلية تلقائية للمصاعد استناداً إلى الفرع المختار ({form.branch === 'mecca' ? 'مكة' : form.branch === 'jeddah' ? 'جدة' : form.branch}).
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowElevatorModal(false)} disabled={saving}>
                إلغاء
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleSaveContract()} 
                disabled={saving}
              >
                {saving ? 'جاري الحفظ...' : 'توليد وتأكيد الحفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (`;

content = content.replace('{showFormModal && (', elevatorModal);

content = content.replace('CITIES, PAYMENT_METHODS', 'CITIES, CITY_PREFIXES, PAYMENT_METHODS');

fs.writeFileSync('src/pages/Contracts.jsx', content);
