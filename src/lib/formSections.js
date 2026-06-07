export const INSTALL_SECTIONS = [
  {
    key: 'contract',
    title: 'البيانات الأساسية',
    fields: [
      ['project_name', 'اسم المشروع'],
      ['project_location', 'موقع المشروع (المدينة والحي)'],
      ['contract_date', 'التاريخ', 'date'],
      ['elevator_brand', 'ماركة المصعد']
    ]
  },
  {
    key: 'customer',
    title: 'بيانات العميل',
    fields: [
      ['customer_name', 'اسم العميل / المؤسسة'],
      ['identity_number', 'رقم الهوية / السجل التجاري'],
      ['address', 'العنوان'],
      ['mobile', 'رقم الجوال']
    ]
  },
  {
    key: 'elevator',
    title: 'المواصفات الفنية الرئيسية',
    fields: [
      ['elevator_type', 'نوع المصعد'],
      ['entrances', 'عدد المداخل', 'number'],
      ['speed', 'سرعة المصعد'],
      ['stops', 'عدد الوقفات', 'number'],
      ['travel_distance', 'مشوار الصاعدة'],
      ['machine_type', 'الماكينة'],
      ['shaft_type', 'نوع البئر'],
      ['machine_position', 'موضع الماكينة'],
      ['shaft_dimensions', 'أبعاد البئر'],
      ['capacity_persons', 'عدد الأشخاص / الحمولة'],
      ['door_dimensions', 'مقاس الباب'],
      ['outer_door_type', 'نوع الباب الخارجي'],
      ['inner_door_type', 'الباب الداخلي'],
      ['cam_type', 'الكامة']
    ]
  },
  {
    key: 'mechanical',
    title: 'المواصفات الميكانيكية والسكك',
    fields: [
      ['cabin_rails', 'سكك الكابينة'],
      ['counterweight_rails', 'سكك الثقل'],
      ['counterweight', 'ثقل الموازنة'],
      ['traction_ropes', 'حبال الجر'],
      ['electrical_wiring', 'التمديدات الكهربائية']
    ]
  },
  {
    key: 'cabin_control',
    title: 'الصاعدة ولوحة التحكم',
    fields: [
      ['floor_indicator', 'مبين الأدوار'],
      ['cabin_details', 'مواصفات الصاعدة (الكابينة)'],
      ['control_panel', 'لوحة التحكم (الكنترول)']
    ]
  },
  {
    key: 'safety',
    title: 'مواصفات الأمان',
    fields: [
      ['limit_switch', 'قاطع نهاية المشوار', 'checkbox'],
      ['parachute', 'البراشوت', 'checkbox'],
      ['revision_device', 'جهاز الريفيزيون', 'checkbox'],
      ['oilers', 'المزايت', 'checkbox'],
      ['flexible_cable', 'الكابل المرن', 'checkbox'],
      ['shock_absorbers', 'مخفف الصدمات', 'checkbox'],
      ['fire_brake_device', 'جهاز الفرامل في حالة الحريق', 'checkbox']
    ]
  }
];

export const MAINTENANCE_SECTIONS = [
  {
    key: 'contract',
    title: 'البيانات الأساسية',
    fields: [
      ['facility_name', 'اسم العميل / المنشأة'],
      ['facility_location', 'موقع المنشأة'],
      ['covered_elevators_count', 'عدد المصاعد المشمولة', 'number'],
      ['contract_duration', 'مدة العقد']
    ]
  },
  {
    key: 'customer',
    title: 'بيانات العميل',
    fields: [
      ['organization_name', 'اسم المؤسسة'],
      ['identity_number', 'السجل التجاري أو الهوية'],
      ['tax_number', 'الرقم الضريبي'],
      ['contact_data', 'بيانات التواصل'],
      ['responsible_person', 'الشخص المسؤول']
    ]
  },
  {
    key: 'elevator',
    title: 'المصاعد المشمولة بالصيانة',
    fields: [
      ['elevator_reference', 'مرجع المصعد'],
      ['brand', 'الماركة'],
      ['capacity', 'الحمولة'],
      ['stops', 'عدد الوقفات', 'number'],
      ['serial_number', 'الرقم التسلسلي']
    ]
  },
  {
    key: 'maintenance',
    title: 'نوع الصيانة',
    fields: [
      ['preventive', 'صيانة وقائية'],
      ['corrective', 'صيانة تصحيحية'],
      ['emergency_247', 'طوارئ 24/7']
    ]
  },
  {
    key: 'visits',
    title: 'خطة الزيارات',
    fields: [
      ['monthly_visits', 'عدد الزيارات الشهرية', 'number'],
      ['quarterly_visits', 'الزيارات الربع سنوية'],
      ['annual_visit', 'الزيارة السنوية الشاملة']
    ]
  },
  {
    key: 'sla',
    title: 'مستوى الخدمة (SLA)',
    fields: [
      ['failure_response_time', 'زمن الاستجابة للأعطال'],
      ['emergency_response_time', 'زمن الاستجابة للطوارئ'],
      ['working_hours', 'أوقات العمل'],
      ['emergency_numbers', 'أرقام الطوارئ']
    ]
  },
  {
    key: 'parts',
    title: 'القطع والمواد',
    fields: [
      ['included_parts', 'القطع المشمولة بالعقد'],
      ['excluded_parts', 'القطع غير المشمولة'],
      ['client_responsibility', 'مسؤولية العميل'],
      ['company_responsibility', 'مسؤولية الشركة']
    ]
  }
];

export function createEmptyDetails(sections) {
  return sections.reduce((acc, section) => {
    acc[section.key] = {};
    section.fields.forEach(([field, , type]) => {
      if (type === 'checkbox') acc[section.key][field] = true;
    });
    return acc;
  }, {});
}
