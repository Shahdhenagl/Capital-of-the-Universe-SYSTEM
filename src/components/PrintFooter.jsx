import React from 'react';

export default function PrintFooter() {
  return (
    <div className="company-print-footer print-only-element">
      <div className="footer-banks">
        <div className="bank-item">
          <div className="bank-name">رقم حساب بنك البلاد</div>
          <div className="bank-acc">SA8215000900131070920002</div>
        </div>
        <div className="bank-item">
          <div className="bank-name">رقم حساب مصرف الراجحي</div>
          <div className="bank-acc">SA3280000201608016391622</div>
        </div>
        <div className="bank-item">
          <div className="bank-name">رقم حساب بنك الرياض</div>
          <div className="bank-acc">SA0320000001871652459940</div>
        </div>
      </div>
      <div className="footer-contacts">
        <div className="contact-line">
          المكتب الرئيسي / مكة المكرمة - العزيزية - شارع عبد الله خياط : 0125215000 - 0544600116 - 0544113161
        </div>
        <div className="contact-line">
          فرع جدة / حي المروة - شارع حراء : 0126215001 - 0504413330 - 0544113161
        </div>
      </div>
    </div>
  );
}
