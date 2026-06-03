import React from 'react';
import { useAutocomplete } from '../contexts/AutocompleteContext';

export default function SmartInput({ category, id, ...props }) {
  const { memory } = useAutocomplete();
  
  // نستخدم تصنيف الحقل (category) لاستخراج الاقتراحات المخزنة
  const suggestions = memory?.[category] || [];
  
  // إنشاء معرّف فريد للـ datalist
  const listId = `datalist-${category}-${id || Math.random().toString(36).substr(2, 9)}`;

  return (
    <>
      <input 
        list={listId} 
        id={id}
        autoComplete="off" // نوقف الاقتراحات الافتراضية للمتصفح ليظهر الـ datalist بشكل نظيف
        {...props} 
      />
      
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion, index) => (
            <option key={`${suggestion}-${index}`} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  );
}
