import React from 'react';

export default function PrintHeader() {
  return (
    <div className="company-print-header print-only-element">
      <div className="header-top-row">
        <div className="header-logo-box">
          <div className="logo-text-area">
            <div className="text-line-1"><span className="line-deco"></span>مؤسسة<span className="line-deco"></span></div>
            <div className="text-line-2">عاصمة الكون</div>
            <div className="text-line-3"><span className="line-deco"></span>للمصاعد<span className="line-deco"></span></div>
          </div>
          <svg className="company-diamond" width="70" height="70" viewBox="0 0 100 100">
            <polygon points="50,0 100,48 0,48" fill="#4ea5c4" />
            <polygon points="0,52 100,52 50,100" fill="#586861" />
          </svg>
        </div>
        <div className="header-tax-info">
          الرقم الضريبي : 300298564600003
        </div>
      </div>
      <div className="header-bottom-row">
        <div className="header-services">
          صيانة - تركيب - تحديث
        </div>
      </div>
    </div>
  );
}
