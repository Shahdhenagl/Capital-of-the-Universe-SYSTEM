import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { notifyTransaction } from '../lib/integrations';
import { notifySalaryPaid, notifyLoanIssued, notifyAbsenceRecorded } from '../lib/whatsapp';
import { 
  Coins, Plus, Search, Calendar, Check, X, Users, 
  TrendingDown, TrendingUp, AlertCircle, DollarSign, Clock, FileText
} from 'lucide-react';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

function PayrollPage({ cityFilter }) {
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll', 'advances', 'history'
  const [employees, setEmployees] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [history, setHistory] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Categories cache
  const [salaryCategoryId, setSalaryCategoryId] = useState(null);
  const [advanceCategoryId, setAdvanceCategoryId] = useState(null);

  // Month & Year Filter for Payroll
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Advances filters
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('');

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyMonth, setHistoryMonth] = useState('');
  const [historyYear, setHistoryYear] = useState('');

  // Absences filters
  const [absenceMonth, setAbsenceMonth] = useState('');
  const [absenceYear, setAbsenceYear] = useState('');

  // Modals state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  
  // New Advance form state
  const [newAdvance, setNewAdvance] = useState({
    employee_id: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // New Absence form state
  const [newAbsence, setNewAbsence] = useState({
    employee_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    days_count: 1,
    reason: ''
  });

  // Disburse Payroll state
  const [disburseEmployee, setDisburseEmployee] = useState(null);
  const [disburseData, setDisburseData] = useState({
    allowanceType: 'amount', // 'amount' or 'days'
    allowanceValue: '',
    deductionType: 'amount', // 'amount' or 'days'
    deductionValue: '',
    deductAdvance: true,
    advancesToDeduct: [],
    notes: '',
    payment_method: 'cash'
  });

  useEffect(() => {
    fetchInitialData();
  }, [cityFilter]);

  async function fetchInitialData() {
    try {
      setLoading(true);
      await Promise.all([
        fetchEmployees(),
        fetchAdvances(),
        fetchHistory(),
        fetchAbsences(),
        fetchCategories()
      ]);
    } catch (err) {
      console.error('Error fetching payroll data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const { data } = await supabase
        .from('expense_categories')
        .select('id, name');
      
      const salaryCat = data?.find(c => c.name === 'رواتب');
      const advanceCat = data?.find(c => c.name === 'سلف موظفين');

      if (salaryCat) setSalaryCategoryId(salaryCat.id);
      if (advanceCat) setAdvanceCategoryId(advanceCat.id);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchEmployees() {
    try {
      let query = supabase
        .from('employees')
        .select('*')
        .eq('status', 'active');
      
      if (cityFilter && cityFilter !== 'all') {
        query = query.eq('branch', cityFilter);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  }

  async function fetchAdvances() {
    try {
      let query = supabase
        .from('employee_advances')
        .select('*, employees(name, branch, position)');
      
      if (cityFilter && cityFilter !== 'all') {
        query = query.eq('employees.branch', cityFilter);
      }

      const { data, error } = await query.order('advance_date', { ascending: false });
      if (error) throw error;
      setAdvances(data || []);
    } catch (err) {
      console.error('Error fetching advances:', err);
    }
  }

  async function fetchHistory() {
    try {
      let query = supabase
        .from('salaries_payments')
        .select('*, employees(name, position, branch, salary)');
      
      if (cityFilter && cityFilter !== 'all') {
        query = query.eq('employees.branch', cityFilter);
      }

      const { data, error } = await query.order('payment_date', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }

  async function fetchAbsences() {
    try {
      let query = supabase
        .from('employee_absences')
        .select('*, employees(name, branch)');
      
      if (cityFilter && cityFilter !== 'all') {
        query = query.eq('employees.branch', cityFilter);
      }

      const { data, error } = await query.order('start_date', { ascending: false });
      if (error) throw error;
      setAbsences(data || []);
    } catch (err) {
      console.error('Error fetching absences:', err);
    }
  }

  // Check if salary is already disbursed for this employee in selected month & year
  function isSalaryPaid(employeeId) {
    return history.some(h => 
      h.employee_id === employeeId && 
      h.period_month === parseInt(selectedMonth) && 
      h.period_year === parseInt(selectedYear)
    );
  }

  // Get active pending advances for an employee
  function getPendingAdvancesForEmployee(employeeId) {
    return advances.filter(adv => adv.employee_id === employeeId && adv.status === 'pending');
  }

  // Calculate day rate for employee
  function calculateDayRate(basicSalary) {
    return (parseFloat(basicSalary) || 0) / 30;
  }

  // Open disburse modal for employee
  function openDisburseModal(employee) {
    const employeePendingAdvances = getPendingAdvancesForEmployee(employee.id);
    setDisburseEmployee(employee);
    setDisburseData({
      allowanceType: 'amount',
      allowanceValue: '',
      deductionType: 'amount',
      deductionValue: '',
      deductAdvance: employeePendingAdvances.length > 0,
      advancesToDeduct: employeePendingAdvances,
      notes: '',
      payment_method: 'cash'
    });
    setShowDisburseModal(true);
  }

  // Calculate disburse summary
  function getDisburseSummary() {
    if (!disburseEmployee) return { base: 0, allowance: 0, deduction: 0, advancesDeducted: 0, net: 0 };
    
    const base = parseFloat(disburseEmployee.salary) || 0;
    const dayRate = calculateDayRate(base);
    
    let allowance = 0;
    if (disburseData.allowanceValue) {
      const val = parseFloat(disburseData.allowanceValue) || 0;
      allowance = disburseData.allowanceType === 'days' ? val * dayRate : val;
    }

    let deduction = 0;
    if (disburseData.deductionValue) {
      const val = parseFloat(disburseData.deductionValue) || 0;
      deduction = disburseData.deductionType === 'days' ? val * dayRate : val;
    }

    let advancesDeducted = 0;
    if (disburseData.deductAdvance && disburseData.advancesToDeduct.length > 0) {
      advancesDeducted = disburseData.advancesToDeduct.reduce((sum, adv) => sum + (parseFloat(adv.amount) || 0), 0);
    }

    // Absence Deductions Logic
    let absenceDeductionDays = 0;
    let absenceDeductionAmount = 0;
    if (disburseEmployee) {
      const L = disburseEmployee.annual_leave_days || 0;
      const yearAbsences = absences.filter(a => a.employee_id === disburseEmployee.id && new Date(a.start_date).getFullYear() === selectedYear);
      
      const prevAbsences = yearAbsences.filter(a => new Date(a.start_date).getMonth() + 1 < selectedMonth);
      const A_prev = prevAbsences.reduce((sum, a) => sum + a.days_count, 0);
      
      const currAbsences = yearAbsences.filter(a => new Date(a.start_date).getMonth() + 1 === selectedMonth);
      const A_curr = currAbsences.reduce((sum, a) => sum + a.days_count, 0);
      
      const E_prev = Math.max(0, A_prev - L);
      const E_curr = Math.max(0, A_prev + A_curr - L);
      
      absenceDeductionDays = E_curr - E_prev;
      absenceDeductionAmount = absenceDeductionDays * dayRate;
    }

    const net = base + allowance - deduction - advancesDeducted - absenceDeductionAmount;

    return {
      base,
      allowance,
      deduction,
      advancesDeducted,
      absenceDeductionDays,
      absenceDeductionAmount,
      net: net < 0 ? 0 : net
    };
  }

  // Handle salary disbursement save
  async function handleDisburseSubmit(e) {
    e.preventDefault();
    if (!disburseEmployee || saving) return;

    setSaving(true);
    try {
      const summary = getDisburseSummary();
      const monthLabel = MONTHS_AR[selectedMonth - 1];

      // 1. Insert into salaries_payments
      const payload = {
        employee_id: disburseEmployee.id,
        payment_date: new Date().toISOString().split('T')[0],
        period_month: parseInt(selectedMonth),
        period_year: parseInt(selectedYear),
        base_salary: summary.base,
        allowances: summary.allowance,
        allowance_days: disburseData.allowanceType === 'days' ? parseFloat(disburseData.allowanceValue) || 0 : 0,
        deductions: summary.deduction,
        deduction_days: disburseData.deductionType === 'days' ? parseFloat(disburseData.deductionValue) || 0 : 0,
        advances_deducted: summary.advancesDeducted,
        net_salary: summary.net,
        payment_method: disburseData.payment_method,
        notes: disburseData.notes,
        created_by: profile?.id
      };

      const { data: salaryRecord, error: salaryError } = await supabase
        .from('salaries_payments')
        .insert(payload)
        .select()
        .single();

      if (salaryError) throw salaryError;

      // 2. Insert into expenses
      const expensePayload = {
        category_id: salaryCategoryId,
        amount: summary.net,
        description: `صرف راتب الموظف ${disburseEmployee.name} لشهر ${monthLabel} / ${selectedYear}`,
        expense_date: new Date().toISOString().split('T')[0],
        branch: disburseEmployee.branch,
        created_by: profile?.id
      };

      const { error: expenseError } = await supabase
        .from('expenses')
        .insert(expensePayload);

      if (expenseError) throw expenseError;

      // 3. Update deducted advances (if any)
      if (disburseData.deductAdvance && disburseData.advancesToDeduct.length > 0) {
        const advanceIds = disburseData.advancesToDeduct.map(adv => adv.id);
        const { error: advanceUpdateError } = await supabase
          .from('employee_advances')
          .update({ status: 'deducted' })
          .in('id', advanceIds);

        if (advanceUpdateError) throw advanceUpdateError;
      }

      // 4. Update Cash Register closing balance (deduct amount)
      // Check if there is an active cash register for this branch today
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: activeCash } = await supabase
        .from('cash_register')
        .select('*')
        .eq('date', todayDate)
        .eq('branch', disburseEmployee.branch)
        .limit(1);

      if (activeCash && activeCash.length > 0) {
        const cashObj = activeCash[0];
        const newExpenseTotal = (parseFloat(cashObj.total_expense) || 0) + summary.net;
        const newClosing = (parseFloat(cashObj.opening_balance) || 0) + (parseFloat(cashObj.total_income) || 0) - newExpenseTotal;

        await supabase
          .from('cash_register')
          .update({
            total_expense: newExpenseTotal,
            closing_balance: newClosing
          })
          .eq('id', cashObj.id);
      } else {
        // Fetch yesterday closing balance
        const { data: prevCash } = await supabase
          .from('cash_register')
          .select('closing_balance')
          .eq('branch', disburseEmployee.branch)
          .order('date', { ascending: false })
          .limit(1);

        const opening = prevCash?.[0]?.closing_balance || 0;
        await supabase
          .from('cash_register')
          .insert({
            date: todayDate,
            opening_balance: opening,
            total_income: 0,
            total_expense: summary.net,
            closing_balance: opening - summary.net,
            branch: disburseEmployee.branch,
            notes: 'صرف راتب موظف تلقائي'
          });
      }

      // 5. Log activity
      await logActivity(
        profile?.id,
        profile?.full_name,
        'صرف راتب',
        'salaries_payments',
        salaryRecord.id,
        `تم صرف راتب الموظف ${disburseEmployee.name} بمبلغ ${formatCurrency(summary.net)} لشهر ${monthLabel} / ${selectedYear}`,
        disburseEmployee.branch
      );

      await notifyTransaction({
        type: 'صرف راتب',
        action: 'اعتماد',
        amount: formatCurrency(summary.net),
        actor: profile?.full_name || profile?.email,
        branch: CITIES[disburseEmployee.branch] || disburseEmployee.branch,
        employee: disburseEmployee.name,
        date: formatDate(new Date()),
        reference: salaryRecord.id,
        description: `راتب شهر ${monthLabel} / ${selectedYear} - الأساسي ${formatCurrency(summary.base)} - الحوافز ${formatCurrency(summary.allowance)} - الخصومات ${formatCurrency(summary.deduction)} - السلف المستقطعة ${formatCurrency(summary.advancesDeducted)}`,
        link: '/payroll'
      });

      // Send WhatsApp Notification to Employee
      if (disburseEmployee.phone) {
        await notifySalaryPaid(
          disburseEmployee.phone,
          disburseEmployee.name,
          `${monthLabel} / ${selectedYear}`,
          formatCurrency(summary.net)
        );
      }

      // Refresh and close
      setShowDisburseModal(false);
      await fetchInitialData();
    } catch (err) {
      console.error('Error disbursing payroll:', err);
      alert('حدث خطأ أثناء صرف الراتب: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Advance Submission
  async function handleAdvanceSubmit(e) {
    e.preventDefault();
    if (!newAdvance.employee_id || !newAdvance.amount || saving) return;

    setSaving(true);
    try {
      const selectedEmp = employees.find(emp => emp.id === newAdvance.employee_id);
      if (!selectedEmp) throw new Error('الموظف غير موجود');

      const amountVal = parseFloat(newAdvance.amount);

      // 1. Insert into employee_advances
      const payload = {
        employee_id: newAdvance.employee_id,
        amount: amountVal,
        advance_date: newAdvance.advance_date,
        status: 'pending',
        notes: newAdvance.notes,
        created_by: profile?.id
      };

      const { data: advanceRecord, error: advError } = await supabase
        .from('employee_advances')
        .insert(payload)
        .select()
        .single();

      if (advError) throw advError;

      // 2. Insert into expenses under category 'سلف موظفين'
      const expensePayload = {
        category_id: advanceCategoryId,
        amount: amountVal,
        description: `تقديم سلفة للموظف ${selectedEmp.name} - ملاحظات: ${newAdvance.notes || 'لا يوجد'}`,
        expense_date: newAdvance.advance_date,
        branch: selectedEmp.branch,
        created_by: profile?.id
      };

      const { error: expError } = await supabase
        .from('expenses')
        .insert(expensePayload);

      if (expError) throw expError;

      // 3. Update Cash Register
      const { data: activeCash } = await supabase
        .from('cash_register')
        .select('*')
        .eq('date', newAdvance.advance_date)
        .eq('branch', selectedEmp.branch)
        .limit(1);

      if (activeCash && activeCash.length > 0) {
        const cashObj = activeCash[0];
        const newExpenseTotal = (parseFloat(cashObj.total_expense) || 0) + amountVal;
        const newClosing = (parseFloat(cashObj.opening_balance) || 0) + (parseFloat(cashObj.total_income) || 0) - newExpenseTotal;

        await supabase
          .from('cash_register')
          .update({
            total_expense: newExpenseTotal,
            closing_balance: newClosing
          })
          .eq('id', cashObj.id);
      } else {
        const { data: prevCash } = await supabase
          .from('cash_register')
          .select('closing_balance')
          .eq('branch', selectedEmp.branch)
          .order('date', { ascending: false })
          .limit(1);

        const opening = prevCash?.[0]?.closing_balance || 0;
        await supabase
          .from('cash_register')
          .insert({
            date: newAdvance.advance_date,
            opening_balance: opening,
            total_income: 0,
            total_expense: amountVal,
            closing_balance: opening - amountVal,
            branch: selectedEmp.branch,
            notes: 'سلفة موظف تلقائي'
          });
      }

      await logActivity(
        profile?.id,
        profile?.full_name,
        'تسجيل سلفة',
        'employee_advances',
        advanceRecord.id,
        `تقديم سلفة للموظف ${selectedEmp.name} بقيمة ${formatCurrency(amountVal)}`,
        selectedEmp.branch
      );

      await notifyTransaction({
        type: 'سلفة موظف',
        action: 'صرف',
        amount: formatCurrency(amountVal),
        actor: profile?.full_name || profile?.email,
        branch: CITIES[selectedEmp.branch] || selectedEmp.branch,
        employee: selectedEmp.name,
        date: formatDate(newAdvance.advance_date),
        reference: advanceRecord.id,
        description: newAdvance.notes || 'بدون ملاحظات',
        link: '/payroll'
      });

      // Send WhatsApp Notification to Employee
      if (selectedEmp.phone) {
        await notifyLoanIssued(
          selectedEmp.phone,
          selectedEmp.name,
          formatCurrency(amountVal),
          newAdvance.advance_date
        );
      }

      setShowAdvanceModal(false);
      setNewAdvance({
        employee_id: '',
        amount: '',
        advance_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await fetchInitialData();
    } catch (err) {
      console.error('Error saving advance:', err);
      alert('حدث خطأ أثناء حفظ السلفة: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Mark Advance as Repaid Cash
  async function handleRepayAdvance(adv) {
    if (!window.confirm(`هل أنت متأكد من تسديد هذه السلفة نقداً بقيمة ${formatCurrency(adv.amount)} للموظف ${adv.employees?.name}؟`)) return;

    try {
      // 1. Update advance status
      const { error } = await supabase
        .from('employee_advances')
        .update({ status: 'repaid' })
        .eq('id', adv.id);

      if (error) throw error;

      // 2. Insert into revenues (incoming cash) under category 'أخرى'
      const { data: revCats } = await supabase.from('revenue_categories').select('id, name');
      const otherRevCat = revCats?.find(c => c.name === 'أخرى');

      const revenuePayload = {
        category_id: otherRevCat?.id,
        amount: parseFloat(adv.amount),
        description: `استرداد نقدي لسلفة الموظف ${adv.employees?.name}`,
        revenue_date: new Date().toISOString().split('T')[0],
        branch: adv.employees?.branch || 'mecca',
        created_by: profile?.id
      };

      await supabase.from('revenues').insert(revenuePayload);

      // 3. Update Cash Register
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: activeCash } = await supabase
        .from('cash_register')
        .select('*')
        .eq('date', todayDate)
        .eq('branch', adv.employees?.branch || 'mecca')
        .limit(1);

      if (activeCash && activeCash.length > 0) {
        const cashObj = activeCash[0];
        const newIncomeTotal = (parseFloat(cashObj.total_income) || 0) + parseFloat(adv.amount);
        const newClosing = (parseFloat(cashObj.opening_balance) || 0) + newIncomeTotal - (parseFloat(cashObj.total_expense) || 0);

        await supabase
          .from('cash_register')
          .update({
            total_income: newIncomeTotal,
            closing_balance: newClosing
          })
          .eq('id', cashObj.id);
      }

      // 4. Log activity
      await logActivity(
        profile?.id,
        profile?.full_name,
        'تسديد سلفة نقداً',
        'employee_advances',
        adv.id,
        `تسديد سلفة الموظف ${adv.employees?.name} نقداً بقيمة ${formatCurrency(adv.amount)}`,
        adv.employees?.branch
      );

      await notifyTransaction({
        type: 'سداد سلفة',
        action: 'تحصيل',
        amount: formatCurrency(adv.amount),
        actor: profile?.full_name || profile?.email,
        branch: CITIES[adv.employees?.branch] || adv.employees?.branch,
        employee: adv.employees?.name,
        date: formatDate(new Date()),
        reference: adv.id,
        description: 'سداد نقدي لسلفة موظف',
        link: '/payroll'
      });

      await fetchInitialData();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تسديد السلفة');
    }
  }

  // Handle Absence Submission
  async function handleAbsenceSubmit(e) {
    e.preventDefault();
    if (!newAbsence.employee_id || saving) return;

    setSaving(true);
    try {
      const selectedEmp = employees.find(emp => emp.id === newAbsence.employee_id);
      if (!selectedEmp) throw new Error('الموظف غير موجود');

      const payload = {
        employee_id: newAbsence.employee_id,
        start_date: newAbsence.start_date,
        end_date: newAbsence.end_date,
        days_count: parseInt(newAbsence.days_count) || 1,
        reason: newAbsence.reason,
        created_by: profile?.id
      };

      const { error } = await supabase.from('employee_absences').insert(payload);
      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'تسجيل غياب',
        'employee_absences',
        null,
        `تم تسجيل غياب للموظف ${selectedEmp.name} لمدة ${payload.days_count} أيام`,
        selectedEmp.branch
      );

      // Send WhatsApp Notification to Employee
      if (selectedEmp.phone) {
        await notifyAbsenceRecorded(
          selectedEmp.phone,
          selectedEmp.name,
          payload.days_count,
          payload.start_date
        );
      }

      setShowAbsenceModal(false);
      setNewAbsence({
        employee_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        days_count: 1,
        reason: ''
      });
      await fetchInitialData();
    } catch (err) {
      console.error('Error saving absence:', err);
      alert('حدث خطأ أثناء حفظ الغياب: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filtered advances
  const filteredAdvances = advances.filter(adv => {
    if (advanceStatusFilter && adv.status !== advanceStatusFilter) return false;
    if (advanceSearch) {
      const term = advanceSearch.toLowerCase();
      const empName = (adv.employees?.name || '').toLowerCase();
      const noteStr = (adv.notes || '').toLowerCase();
      if (!empName.includes(term) && !noteStr.includes(term)) return false;
    }
    return true;
  });

  // Filtered history
  const filteredHistory = history.filter(h => {
    if (historyMonth && h.period_month !== parseInt(historyMonth)) return false;
    if (historyYear && h.period_year !== parseInt(historyYear)) return false;
    if (historySearch) {
      const term = historySearch.toLowerCase();
      const empName = (h.employees?.name || '').toLowerCase();
      if (!empName.includes(term)) return false;
    }
    return true;
  });

  // Filtered absences
  const filteredAbsences = absences.filter(a => {
    if (absenceMonth && new Date(a.start_date).getMonth() + 1 !== parseInt(absenceMonth)) return false;
    if (absenceYear && new Date(a.start_date).getFullYear() !== parseInt(absenceYear)) return false;
    return true;
  });

  // Quick stats for advances
  const activeAdvancesTotal = advances
    .filter(a => a.status === 'pending')
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  const repaidAdvancesTotal = advances
    .filter(a => a.status === 'repaid' || a.status === 'deducted')
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Coins size={28} />
          </span>
          إدارة الرواتب والأجور
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowAdvanceModal(true)}>
            <Plus size={18} />
            تسجيل سلفة جديدة
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-24" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'payroll' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('payroll')}
        >
          <Coins size={16} style={{ marginLeft: '6px' }} />
          مسير الرواتب الشهري
        </button>
        <button
          className={`btn ${activeTab === 'advances' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('advances')}
        >
          <DollarSign size={16} style={{ marginLeft: '6px' }} />
          سلف الموظفين
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('history')}
        >
          <FileText size={16} style={{ marginLeft: '6px' }} />
          سجل الرواتب المصروفة
        </button>
        <button
          className={`btn ${activeTab === 'absences' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('absences')}
        >
          <Clock size={16} style={{ marginLeft: '6px' }} />
          الغيابات والإجازات
        </button>
      </div>

      {/* ======================= TAB 1: PAYROLL ======================= */}
      {activeTab === 'payroll' && (
        <div>
          {/* Filters for Month & Year */}
          <div className="filter-bar mb-24">
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>شهر الصرف</label>
              <select
                className="form-select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
              >
                {MONTHS_AR.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>سنة الصرف</label>
              <select
                className="form-select"
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
              >
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
              </select>
            </div>
            <div style={{ flex: 1 }}></div>
            <div className="page-actions">
              <span className="badge badge-info">
                رواتب شهر: {MONTHS_AR[selectedMonth - 1]} / {selectedYear}
              </span>
            </div>
          </div>

          {/* Employees List */}
          <div className="table-container">
            {employees.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>لا يوجد موظفين مسجلين</h3>
                <p>قم بإضافة موظفين في قسم شؤون الموظفين أولاً</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم الموظف</th>
                    <th>الوظيفة</th>
                    <th>الفرع</th>
                    <th>الراتب الأساسي</th>
                    <th>السلف المعلقة</th>
                    <th>حالة صرف الشهر</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const isPaid = isSalaryPaid(emp.id);
                    const pendingAdvs = getPendingAdvancesForEmployee(emp.id);
                    const advSum = pendingAdvs.reduce((sum, a) => sum + parseFloat(a.amount), 0);

                    return (
                      <tr key={emp.id}>
                        <td>
                          <strong>{emp.name}</strong>
                        </td>
                        <td>{emp.position === 'technician' ? 'فني' : emp.position === 'accountant' ? 'محاسب' : emp.position === 'manager' ? 'مدير' : 'إداري'}</td>
                        <td>{CITIES[emp.branch] || emp.branch}</td>
                        <td>
                          <strong>{formatCurrency(emp.salary)}</strong>
                        </td>
                        <td>
                          {advSum > 0 ? (
                            <span className="badge badge-warning">
                              {formatCurrency(advSum)}
                            </span>
                          ) : (
                            <span className="text-muted">لا يوجد</span>
                          )}
                        </td>
                        <td>
                          {isPaid ? (
                            <span className="badge badge-success">تم الصرف ✓</span>
                          ) : (
                            <span className="badge badge-danger">بانتظار الصرف</span>
                          )}
                        </td>
                        <td>
                          {isPaid ? (
                            <button className="btn btn-secondary btn-sm" disabled>
                              تم الصرف
                            </button>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => openDisburseModal(emp)}>
                              صرف الراتب الشهري
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: ADVANCES ======================= */}
      {activeTab === 'advances' && (
        <div>
          {/* Stats for Advances */}
          <div className="stats-grid mb-24">
            <div className="stat-card warning">
              <div className="stat-info">
                <div className="stat-label">سلف قائمة معلقة</div>
                <div className="stat-value">{formatCurrency(activeAdvancesTotal)}</div>
              </div>
              <div className="stat-icon warning">
                <AlertCircle size={24} />
              </div>
            </div>

            <div className="stat-card success">
              <div className="stat-info">
                <div className="stat-label">سلف مستردة / مسددة</div>
                <div className="stat-value">{formatCurrency(repaidAdvancesTotal)}</div>
              </div>
              <div className="stat-icon success">
                <Check size={24} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <select
                className="form-select"
                value={advanceStatusFilter}
                onChange={e => setAdvanceStatusFilter(e.target.value)}
              >
                <option value="">كل الحالات</option>
                <option value="pending">نشطة معلقة</option>
                <option value="deducted">مستقطعة من الراتب</option>
                <option value="repaid">مسددة نقداً</option>
              </select>
            </div>
            <div className="filter-group search-wrapper" style={{ flex: 1 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="بحث باسم الموظف أو الملاحظات..."
                value={advanceSearch}
                onChange={e => setAdvanceSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Advances Table */}
          <div className="table-container">
            {filteredAdvances.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💸</div>
                <h3>لا توجد سلف موثقة</h3>
                <p>لم يتم تسجيل أي سلف مطابقة للبحث</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>تاريخ السلفة</th>
                    <th>اسم الموظف</th>
                    <th>المبلغ</th>
                    <th>ملاحظات</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvances.map(adv => (
                    <tr key={adv.id}>
                      <td>{formatDate(adv.advance_date)}</td>
                      <td>
                        <strong>{adv.employees?.name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {adv.employees?.position === 'technician' ? 'فني' : 'إداري'} - {CITIES[adv.employees?.branch]}
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(adv.amount)}</strong>
                      </td>
                      <td>{adv.notes || '-'}</td>
                      <td>
                        {adv.status === 'pending' && <span className="badge badge-warning">نشطة (معلقة)</span>}
                        {adv.status === 'deducted' && <span className="badge badge-success">استقطعت من الراتب</span>}
                        {adv.status === 'repaid' && <span className="badge badge-info">سددت نقداً</span>}
                      </td>
                      <td>
                        {adv.status === 'pending' && (
                          <button
                            className="btn btn-ghost btn-sm text-success"
                            onClick={() => handleRepayAdvance(adv)}
                            title="تسديد نقدي مباشر للمصرف"
                            style={{ padding: '4px 8px', border: '1px solid var(--success)', borderRadius: '4px' }}
                          >
                            تسديد نقدي
                          </button>
                        )}
                        {adv.status !== 'pending' && (
                          <span className="text-muted" style={{ fontSize: '0.85rem' }}>لا توجد إجراءات</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 3: HISTORY ======================= */}
      {activeTab === 'history' && (
        <div>
          {/* Filters */}
          <div className="filter-bar">
            <div className="filter-group">
              <select
                className="form-select"
                value={historyMonth}
                onChange={e => setHistoryMonth(e.target.value)}
              >
                <option value="">كل الأشهر</option>
                {MONTHS_AR.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <select
                className="form-select"
                value={historyYear}
                onChange={e => setHistoryYear(e.target.value)}
              >
                <option value="">كل السنوات</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
              </select>
            </div>

            <div className="filter-group search-wrapper" style={{ flex: 1 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="بحث باسم الموظف..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {/* History Table */}
          <div className="table-container">
            {filteredHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📜</div>
                <h3>لا توجد رواتب مصروفة مسجلة</h3>
                <p>لم يتم العثور على أي عمليات صرف مطابقة للبحث</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>تاريخ الصرف</th>
                    <th>شهر الصرف</th>
                    <th>الموظف</th>
                    <th>الأساسي</th>
                    <th>حوافز</th>
                    <th>خصومات</th>
                    <th>استقطاع سلف</th>
                    <th>الصافي المستلم</th>
                    <th>طريقة الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(h => (
                    <tr key={h.id}>
                      <td>{formatDate(h.payment_date)}</td>
                      <td>
                        <strong>{MONTHS_AR[h.period_month - 1]} / {h.period_year}</strong>
                      </td>
                      <td>
                        <strong>{h.employees?.name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {CITIES[h.employees?.branch]}
                        </div>
                      </td>
                      <td>{formatCurrency(h.base_salary)}</td>
                      <td>
                        {parseFloat(h.allowances) > 0 ? (
                          <span className="text-success">+{formatCurrency(h.allowances)} {h.allowance_days > 0 && `(${h.allowance_days} يوم)`}</span>
                        ) : '٠'}
                      </td>
                      <td>
                        {parseFloat(h.deductions) > 0 ? (
                          <span className="text-danger">-{formatCurrency(h.deductions)} {h.deduction_days > 0 && `(${h.deduction_days} يوم)`}</span>
                        ) : '٠'}
                      </td>
                      <td>
                        {parseFloat(h.advances_deducted) > 0 ? (
                          <span className="text-warning">-{formatCurrency(h.advances_deducted)}</span>
                        ) : '٠'}
                      </td>
                      <td>
                        <strong className="text-success">{formatCurrency(h.net_salary)}</strong>
                      </td>
                      <td>{h.payment_method === 'cash' ? 'نقداً (كاش)' : h.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'أخرى'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 4: ABSENCES ======================= */}
      {activeTab === 'absences' && (
        <div>
          <div className="filter-bar mb-24">
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>الشهر</label>
              <select
                className="form-select"
                value={absenceMonth}
                onChange={e => setAbsenceMonth(e.target.value)}
              >
                <option value="">كل الأشهر</option>
                {MONTHS_AR.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>السنة</label>
              <select
                className="form-select"
                value={absenceYear}
                onChange={e => setAbsenceYear(e.target.value)}
              >
                <option value="">كل السنوات</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
              </select>
            </div>
            <div style={{ flex: 1 }}></div>
            <div className="page-actions">
              <button className="btn btn-primary" onClick={() => setShowAbsenceModal(true)}>
                <Plus size={18} />
                تسجيل غياب أو إجازة
              </button>
            </div>
          </div>

          <div className="table-container">
            {filteredAbsences.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏖️</div>
                <h3>لا يوجد سجلات غياب</h3>
                <p>لم يتم تسجيل أي غياب للموظفين في هذه الفترة</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>تاريخ التسجيل</th>
                    <th>اسم الموظف</th>
                    <th>الفرع</th>
                    <th>من تاريخ</th>
                    <th>إلى تاريخ</th>
                    <th>عدد الأيام</th>
                    <th>السبب / ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsences.map(abs => (
                    <tr key={abs.id}>
                      <td>{formatDate(abs.created_at)}</td>
                      <td>
                        <strong>{abs.employees?.name}</strong>
                      </td>
                      <td>{CITIES[abs.employees?.branch] || abs.employees?.branch}</td>
                      <td>{formatDate(abs.start_date)}</td>
                      <td>{formatDate(abs.end_date)}</td>
                      <td>
                        <span className="badge badge-danger">{abs.days_count} أيام</span>
                      </td>
                      <td>{abs.reason || 'بدون سبب'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================= MODAL: RECORD NEW ADVANCE ======================= */}
      {showAdvanceModal && (
        <div className="modal-overlay" onClick={() => setShowAdvanceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">تسجيل سلفة جديدة لموظف</h2>
              <button className="modal-close" onClick={() => setShowAdvanceModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAdvanceSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">الموظف المستلم *</label>
                  <select
                    className="form-select"
                    value={newAdvance.employee_id}
                    onChange={e => setNewAdvance({ ...newAdvance, employee_id: e.target.value })}
                    required
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position === 'technician' ? 'فني' : 'إداري'}) - {CITIES[emp.branch]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">مبلغ السلفة (ر.س) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newAdvance.amount}
                      onChange={e => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                      placeholder="0.00"
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">تاريخ تقديم السلفة *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newAdvance.advance_date}
                      onChange={e => setNewAdvance({ ...newAdvance, advance_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات / سبب السلفة</label>
                  <textarea
                    className="form-textarea"
                    value={newAdvance.notes}
                    onChange={e => setNewAdvance({ ...newAdvance, notes: e.target.value })}
                    placeholder="اكتب ملاحظاتك هنا..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ والخصم من الخزنة...' : 'حفظ السلفة وصرف النقد'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdvanceModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: DISBURSE SALARY ======================= */}
      {showDisburseModal && disburseEmployee && (
        <div className="modal-overlay" onClick={() => setShowDisburseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2 className="modal-title">مسير رواتب الموظف: {disburseEmployee.name}</h2>
              <button className="modal-close" onClick={() => setShowDisburseModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDisburseSubmit}>
              <div className="modal-body">
                {/* Employee details summary */}
                <div style={{ background: 'var(--border)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                  <div className="grid-3" style={{ gap: '12px' }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>الراتب الأساسي</div>
                      <div className="font-bold">{formatCurrency(disburseEmployee.salary)}</div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>يومية الموظف (الأساسي / 30)</div>
                      <div className="font-bold">{formatCurrency(calculateDayRate(disburseEmployee.salary))}</div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>شهر الصرف المطلوب</div>
                      <div className="font-bold text-success">{MONTHS_AR[selectedMonth - 1]} / {selectedYear}</div>
                    </div>
                  </div>
                </div>

                {/* 1. Bonuses (حوافز) */}
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold' }}> الحوافز والمكافآت (حافز إضافي)</label>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={disburseData.allowanceType}
                      onChange={e => setDisburseData({ ...disburseData, allowanceType: e.target.value, allowanceValue: '' })}
                    >
                      <option value="amount">مبلغ ثابت (ر.س)</option>
                      <option value="days">أيام إضافية</option>
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder={disburseData.allowanceType === 'days' ? 'عدد الأيام (مثال: 3)' : 'المبلغ بالريال (مثال: 500)'}
                      value={disburseData.allowanceValue}
                      onChange={e => setDisburseData({ ...disburseData, allowanceValue: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* 2. Deductions (خصومات) */}
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold' }}> الخصومات والاستقطاعات (غياب / جزاءات)</label>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={disburseData.deductionType}
                      onChange={e => setDisburseData({ ...disburseData, deductionType: e.target.value, deductionValue: '' })}
                    >
                      <option value="amount">مبلغ ثابت (ر.س)</option>
                      <option value="days">أيام خصم</option>
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder={disburseData.deductionType === 'days' ? 'عدد الأيام (مثال: 2)' : 'المبلغ بالريال (مثال: 150)'}
                      value={disburseData.deductionValue}
                      onChange={e => setDisburseData({ ...disburseData, deductionValue: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* 3. Advances deduction (السلف القائمة) */}
                {getPendingAdvancesForEmployee(disburseEmployee.id).length > 0 && (
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="deductAdvanceCheck"
                        checked={disburseData.deductAdvance}
                        onChange={e => setDisburseData({ ...disburseData, deductAdvance: e.target.checked })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <label htmlFor="deductAdvanceCheck" style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                        استقطاع السلف المستحقة للموظف من الراتب تلقائياً؟
                      </label>
                    </div>
                    {disburseData.deductAdvance && (
                      <div style={{ marginTop: '10px', background: 'var(--warning-bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.85rem' }}>عدد السلف المعلقة:</span>
                          <span style={{ fontWeight: 'bold' }}>{disburseData.advancesToDeduct.length} سلفة</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.85rem' }}>إجمالي المبلغ المستقطع:</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--warning-light)' }}>
                            {formatCurrency(disburseData.advancesToDeduct.reduce((sum, a) => sum + parseFloat(a.amount), 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Payment method and Notes */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">طريقة الدفع *</label>
                    <select
                      className="form-select"
                      value={disburseData.payment_method}
                      onChange={e => setDisburseData({ ...disburseData, payment_method: e.target.value })}
                      required
                    >
                      <option value="cash">نقداً (كاش)</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">تاريخ اليوم (صرف فوري)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formatDate(new Date())}
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات على راتب هذا الشهر</label>
                  <input
                    type="text"
                    className="form-input"
                    value={disburseData.notes}
                    onChange={e => setDisburseData({ ...disburseData, notes: e.target.value })}
                    placeholder="مثال: خصم بسبب تأخر، أو مكافأة التميز لتركيب مصعد"
                  />
                </div>

                {/* Net Payment Summary display */}
                <div style={{ background: 'var(--success-bg)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>إجمالي الصافي المستحق للصرف:</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--success-light)' }}>
                      {formatCurrency(getDisburseSummary().net)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '6px', opacity: 0.8, display: 'flex', gap: '12px' }}>
                    <span>الأساسي: {formatCurrency(getDisburseSummary().base)}</span>
                    <span>+ حوافز: {formatCurrency(getDisburseSummary().allowance)}</span>
                    <span>- خصم: {formatCurrency(getDisburseSummary().deduction)}</span>
                    <span>- سلف: {formatCurrency(getDisburseSummary().advancesDeducted)}</span>
                    {getDisburseSummary().absenceDeductionAmount > 0 && (
                      <span className="text-danger">- غياب: {formatCurrency(getDisburseSummary().absenceDeductionAmount)} ({getDisburseSummary().absenceDeductionDays} أيام)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري التسجيل والصرف المالي...' : 'اعتماد الصرف الفوري وإصدار السند'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDisburseModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: RECORD ABSENCE ======================= */}
      {showAbsenceModal && (
        <div className="modal-overlay" onClick={() => setShowAbsenceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">تسجيل غياب أو إجازة للموظف</h2>
              <button className="modal-close" onClick={() => setShowAbsenceModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAbsenceSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">الموظف *</label>
                  <select
                    className="form-select"
                    value={newAbsence.employee_id}
                    onChange={e => {
                      setNewAbsence({ ...newAbsence, employee_id: e.target.value });
                    }}
                    required
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map(emp => {
                      // Calculate how many absence days they have so far this year
                      const yearAbs = absences.filter(a => a.employee_id === emp.id && new Date(a.start_date).getFullYear() === new Date().getFullYear());
                      const totalDays = yearAbs.reduce((s, a) => s + a.days_count, 0);
                      const maxDays = emp.annual_leave_days || 0;
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - (الرصيد: مسموح {maxDays} / استنفد {totalDays})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">تاريخ البداية *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newAbsence.start_date}
                      onChange={e => {
                        const start = e.target.value;
                        const end = newAbsence.end_date;
                        let days = 1;
                        if (start && end) {
                          const diff = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
                          days = diff >= 0 ? diff + 1 : 1;
                        }
                        setNewAbsence({ ...newAbsence, start_date: start, days_count: days });
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تاريخ النهاية *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newAbsence.end_date}
                      onChange={e => {
                        const end = e.target.value;
                        const start = newAbsence.start_date;
                        let days = 1;
                        if (start && end) {
                          const diff = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
                          days = diff >= 0 ? diff + 1 : 1;
                        }
                        setNewAbsence({ ...newAbsence, end_date: end, days_count: days });
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">عدد الأيام المحتسبة للغياب *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newAbsence.days_count}
                    onChange={e => setNewAbsence({ ...newAbsence, days_count: e.target.value })}
                    min="1"
                    required
                  />
                  <small className="text-muted">يمكنك تعديل عدد الأيام إذا كانت هناك إجازات رسمية تتخلل هذه الفترة</small>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات / السبب</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newAbsence.reason}
                    onChange={e => setNewAbsence({ ...newAbsence, reason: e.target.value })}
                    placeholder="مثال: ظرف صحي، غياب بدون عذر، إلخ..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ الغياب'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAbsenceModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollPage;
