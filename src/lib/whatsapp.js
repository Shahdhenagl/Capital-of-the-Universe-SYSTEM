/**
 * Bevatel Business Chat API Integration
 *
 * This service handles sending WhatsApp messages using the Bevatel Developer API.
 */

// Replace these with environment variables in production
const API_ACCOUNT_ID = '40728';
const API_ACCESS_TOKEN = 'eLDaXuwgQ7LpwzxCA2QkN8e8';
const API_BASE_URL = 'https://chat.bevatel.com/developer/api/v1/messages'; // Standard Bevatel API endpoint

/**
 * Sends a WhatsApp template message via Bevatel
 * 
 * @param {string} phone - The recipient's phone number (with country code, e.g. +9665...)
 * @param {string} templateName - The exact name of the template approved in Bevatel
 * @param {Array<string>} variables - List of variables to replace in the template
 */
export async function sendWhatsAppTemplate(phone, templateName, variables = []) {
  try {
    // Ensure phone number has a plus sign and no spaces
    let cleanPhone = phone.replace(/\s+/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('05')) {
        cleanPhone = '+966' + cleanPhone.substring(1); // Convert Saudi 05x to +9665x
      } else if (cleanPhone.startsWith('5')) {
        cleanPhone = '+966' + cleanPhone; // Convert 5x to +9665x
      } else if (!cleanPhone.startsWith('966')) {
        cleanPhone = '+' + cleanPhone;
      } else {
        cleanPhone = '+' + cleanPhone;
      }
    }

    const payload = {
      inbox_id: 107608,
      contact: {
        phone_number: cleanPhone
      },
      message: {
        template: {
          name: templateName,
          language: 'ar',
          parameters: {
            body: variables ? variables.map(v => String(v)) : []
          }
        }
      }
    };

    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error:', data);
      throw new Error(data.error || data.message || 'فشل إرسال رسالة الواتساب');
    }

    console.log('WhatsApp message sent successfully!', data);
    return true;

  } catch (error) {
    console.error('WhatsApp Service Error:', error);
    alert('خطأ من نظام الواتساب (Bevatel):\n' + error.message + '\n\nيرجى التأكد من اسم القالب (Template Name) في بيفاتيل.');
    return false;
  }
}

/**
 * Pre-defined Event Triggers
 * These functions simplify calling the API from components
 */

// 1. Contract Created
export async function notifyContractCreated(phone, contractNumber, amount) {
  // Replace 'contract_created' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'contract_created', [contractNumber, amount]);
}

// 2. Collection Received
export async function notifyCollectionReceived(phone, amount, receiptNumber, remainingBalance) {
  // Replace 'payment_received' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'payment_received', [amount, receiptNumber, remainingBalance]);
}

// 3. Maintenance Reminder (For Technicians)
export async function notifyMaintenanceReminder(phone, taskTitle, clientName, location, time) {
  // Replace 'maintenance_reminder' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'maintenance_reminder', [taskTitle, clientName, location, time]);
}

// 4. Installation Start (For Clients)
export async function notifyInstallationStart(phone, phaseName, date) {
  // Replace 'installation_start' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'installation_start', [phaseName, date]);
}

// 4. Quotation Sent
export async function notifyQuotationSent(phone, title, amount, date, link) {
  // Matches 'send_quotation' template in Meta
  return sendWhatsAppTemplate(phone, 'send_quotation', [title, amount, date, link]);
}

// 5. Salary Paid (For Employees)
export async function notifySalaryPaid(phone, employeeName, month, netSalary) {
  // Replace 'salary_paid' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'salary_paid', [employeeName, month, netSalary]);
}

// 6. Loan/Advance Issued (For Employees)
export async function notifyLoanIssued(phone, employeeName, amount, date) {
  // Replace 'loan_issued' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'loan_issued', [employeeName, amount, date]);
}

// 7. Absence/Vacation Recorded (For Employees)
export async function notifyAbsenceRecorded(phone, employeeName, days, startDate) {
  // Replace 'absence_recorded' with your actual template name in Bevatel
  return sendWhatsAppTemplate(phone, 'absence_recorded', [employeeName, days, startDate]);
}

// 8. Quotation Sent
export async function notifyQuotationSent(phone, title, amount, date, link) {
  return sendWhatsAppTemplate(phone, 'quotation_sent', [title, amount, date, link]);
}
