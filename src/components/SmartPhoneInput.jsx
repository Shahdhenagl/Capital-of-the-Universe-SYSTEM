import React from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css'; // Requires the CSS

export default function SmartPhoneInput({ value, onChange, disabled, placeholder = 'أدخل رقم الهاتف...', required = false }) {
  // Saudi Arabia is 'SA'
  
  const handleChange = (val) => {
    onChange(val || '');
  };

  const handleBlur = (e) => {
    // If we want validation feedback, we can do it here, but it's usually better to rely on form submission or a parent component
  };

  return (
    <div className="phone-input-wrapper" dir="ltr">
      <PhoneInput
        international
        defaultCountry="SA"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="form-input"
        style={{ width: '100%' }}
        onBlur={handleBlur}
      />
    </div>
  );
}
