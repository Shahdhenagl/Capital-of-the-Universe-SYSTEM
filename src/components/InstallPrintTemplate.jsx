import React from 'react';
import { formatCurrency, formatDate } from '../lib/supabase';

export default function InstallPrintTemplate({ contract }) {
  const details = contract?.meta?.details || {};
  const paymentSchedule = contract?.payment_schedule || [];
  
  const getField = (section, field) => details[section]?.[field] || '............';

  return (
    <div className="print-only-container print-contract-multi-page install-contract" style={{ direction: 'rtl', fontFamily: 'Arial, sans-serif' }}>
      
      <style>{`
        .install-contract .red-text { color: #dc2626 !important; font-weight: bold; }
        .install-contract .blue-text { color: #2563eb !important; font-weight: bold; }
        .install-contract .boxed-title { border: 2px solid #000; border-radius: 8px; padding: 5px 20px; font-weight: bold; text-align: center; margin: 20px auto; width: max-content; font-size: 1.2rem; }
        .install-contract .spec-row { display: flex; margin-bottom: 8px; font-size: 1rem; }
        .install-contract .spec-label { width: 220px; font-weight: bold; }
        .install-contract .spec-value { flex: 1; color: #dc2626; font-weight: bold; }
        .install-contract .contract-page { padding: 40px; position: relative; height: 100vh; page-break-after: always; box-sizing: border-box; display: flex; flex-direction: column; }
        .install-contract .contract-page:last-child { page-break-after: auto; }
        .install-contract .page-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 30px; text-align: center; font-weight: bold; }
        .install-contract .page-footer-party { width: 45%; }
        .install-contract .page-footer-party .party-title { color: #dc2626; margin-bottom: 10px; }
        .install-contract .list-item { margin-bottom: 8px; line-height: 1.6; }
      `}</style>

      {/* PAGE 1 */}
      <div className="contract-page">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: '#dc2626', textDecoration: 'underline', marginBottom: '15px' }}>عقد لتوريد وتركيب مصعد كهربائي</h2>
          <p>صادر برقم ( <span className="red-text">{contract.contract_number}</span> )</p>
          <p style={{ marginTop: '15px' }}>
            انه في يوم <span className="red-text">{formatDate(contract.start_date)}</span> - حرر هذا العقد بين كل من :
          </p>
        </div>

        <div style={{ marginBottom: '30px', lineHeight: '1.8' }}>
          <div>
            <strong>السادة / <span className="red-text">مؤسسة عاصمة الكون للمصاعد</span> - الطرف الأول (بائع)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ومقرها: مكة المكرمة شارع عبدالله خياط ، العزيزية</span>
            <span>جوال رقم : <span className="red-text">0544600116</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>فرع جدة - شارع حراء - امام الفحص الدوري</span>
            <span>جوال رقم : <span className="red-text">0504413330</span></span>
          </div>
        </div>

        <div style={{ marginBottom: '40px', lineHeight: '1.8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>السيد / <span className="red-text">{contract.clients?.name}</span> - الطرف الثاني (مشتري)</strong>
            <span>جوال رقم : <span className="red-text">{contract.clients?.phone}</span></span>
          </div>
          <div>
            <strong>هوية العميل:</strong> ( <span className="red-text">{getField('customer', 'identity_number')}</span> )
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }}>
          وقد اتفق الطرفين على ما يلي:
        </div>

        <div className="boxed-title" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          البند الأول : الغرض من العقد
        </div>

        <div style={{ lineHeight: '2' }}>
          <div className="list-item">1. يقوم الطرف الأول بتوريد وتركيب عدد ( <span className="red-text">{getField('elevator', 'elevator_count') || '1'}</span> ) مصعد كهربائي.</div>
          <div className="list-item">2. مدة الضمان والصيانة لكامل المصعد ( <span className="red-text">عام واحد</span> ) <span className="red-text">شامل قطع الغيار</span> .</div>
          <div className="list-item">3. الماكينة ( <span className="red-text">عشر أعوام</span> ) <span className="red-text">ضد عيوب التصنيع</span> .</div>
          <div className="list-item">4. لمبنى <strong>سكني</strong> الكائن في مدينة <span className="red-text">{getField('contract', 'project_location')}</span> ، وذلك لحساب الطرف الثاني طبقاً للشروط الموضحة في بنود هذا العقد.</div>
        </div>

        <div className="page-footer">
          <div className="page-footer-party">
            <div className="party-title">الطرف الثاني (المشتري)</div>
            <div>{contract.clients?.name}</div>
          </div>
          <div className="page-footer-party">
            <div className="party-title">الطرف الأول (البائع)</div>
            <div>مؤسسة عاصمة الكون للمصاعد</div>
          </div>
        </div>
      </div>

      {/* PAGE 2 */}
      <div className="contract-page">
        <div className="boxed-title" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          البند الثاني: السعر ونظام الدفع
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>قيمة العطاء المتفق عليه من قبل الطرفين هو:</div>
        
        <div style={{ marginBottom: '20px', lineHeight: '1.8' }}>
          مبلغ وقدره <span className="red-text">{formatCurrency(contract.total_amount)}</span> ، لعدد مصاعد ( <span className="red-text">{getField('elevator', 'elevator_count') || '1'}</span> ) ، وتضاف ضريبة القيمة المضافة على قيمة المصعد ويتم إحتسابها حسب النظام المتبع للهيئة العامة للزكاة والدخل في حين موعد سداد الدفعات
        </div>

        <div style={{ marginBottom: '15px' }}>يقوم الطرف الثاني بسدادها للطرف الأول على النحو التالي:</div>
        
        <div style={{ marginBottom: '30px', marginRight: '20px', lineHeight: '2' }}>
          {paymentSchedule.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>•</span>
              <span>دفعة مقدارها <span className="red-text">{p.percentage}%</span> {p.label} ، وقيمة الدفعة ( <span className="red-text">{formatCurrency(p.amount)}</span> ) .</span>
            </div>
          ))}
        </div>

        <div className="boxed-title" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          البند الثالث: المواصفات الفنية
        </div>

        <p style={{ marginBottom: '20px' }}>يلتزم الطرف الأول بالتقيد بمتطلبات السلامة في المصعد ، موضوع هذا العقد والمعمول بها في المملكة العربية السعودية وتشمل تحديد الآتي:</p>

        <div style={{ marginBottom: '15px' }}>
          <div className="spec-row"><div className="spec-label">نوع المصعد</div><div className="spec-value">{getField('elevator', 'elevator_type')}</div></div>
          <div className="spec-row"><div className="spec-label">عدد المداخل</div><div className="spec-value">{getField('elevator', 'entrances')}</div></div>
          <div className="spec-row"><div className="spec-label">سرعة المصعد</div><div className="spec-value">{getField('elevator', 'speed')} م/ث</div></div>
          <div className="spec-row"><div className="spec-label">عدد الوقفات</div><div className="spec-value">{getField('elevator', 'stops')}</div></div>
          <div className="spec-row"><div className="spec-label">مشوار الصاعدة</div><div className="spec-value">{getField('elevator', 'travel_distance')}</div></div>
          <div className="spec-row"><div className="spec-label">الماكينة</div><div className="spec-value">{getField('elevator', 'machine_type')}</div></div>
          <div className="spec-row"><div className="spec-label">نوع البئر</div><div className="spec-value">{getField('elevator', 'shaft_type')}</div></div>
          <div className="spec-row"><div className="spec-label">موضع الماكينة</div><div className="spec-value">{getField('elevator', 'machine_position')}</div></div>
          <div className="spec-row"><div className="spec-label">أبعاد البئر</div><div className="spec-value">عرضاً {getField('elevator', 'shaft_dimensions')} طعلاً تقريباً.</div></div>
          <div className="spec-row"><div className="spec-label">عدد الأشخاص</div><div className="spec-value">{getField('elevator', 'capacity_persons')}</div></div>
          <div className="spec-row"><div className="spec-label">مقاس الباب</div><div className="spec-value">{getField('elevator', 'door_dimensions')} سم ارتفاع.</div></div>
          <div className="spec-row"><div className="spec-label">نوع الباب الخارجي</div><div className="spec-value">{getField('elevator', 'outer_door_type')} <strong>الباب الداخلي:</strong> {getField('elevator', 'inner_door_type')}</div></div>
          <div className="spec-row"><div className="spec-label">الكامة</div><div style={{ flex: 1 }}>أقفال كهربائية ميكانيكية لا تسمح بسير الصاعدة إلا إذا كانت الأبواب مقفلة ولا تسمح بفتح الباب إلا في حالة وجود الصاعدة على نفس منسوب الباب..</div></div>
          <div className="spec-row"><div className="spec-label">التمديدات الكهربائية:</div><div style={{ flex: 1 }}>جميع التوصيلات الكهربائية من النحاس المعزول ويتم توصيلها داخل قنوات من البلاستيك المقوى لضمان عزلها عن أي مؤثرات خارجية حسب المواصفات الفنية ..</div></div>
        </div>

        <div className="page-footer">
          <div className="page-footer-party">
            <div className="party-title">الطرف الثاني (المشتري)</div>
            <div>{contract.clients?.name}</div>
          </div>
          <div className="page-footer-party">
            <div className="party-title">الطرف الأول (البائع)</div>
            <div>مؤسسة عاصمة الكون للمصاعد</div>
          </div>
        </div>
      </div>

      {/* PAGE 3 */}
      <div className="contract-page">
        
        <div style={{ marginBottom: '15px' }}>
          <div className="spec-row"><div className="spec-label">سكك الكابينة</div><div className="spec-value">{getField('mechanical', 'cabin_rails')}</div></div>
          <div className="spec-row"><div className="spec-label">سكك الثقل</div><div className="spec-value">{getField('mechanical', 'counterweight_rails')}</div></div>
          <div className="spec-row"><div className="spec-label"></div><div style={{ flex: 1, color: '#dc2626', fontWeight: 'bold' }}>يتم تحديدها بما يتلائم مع الحمولة القصوى للصاعدة وإرتفاع المبنى وتكون كوابيل التثبيت على مسافة لا تزيد عن (1.5م) بين كل كابولي وآخر.</div></div>
          
          <div className="spec-row"><div className="spec-label">ثقل الموازنة</div><div style={{ flex: 1 }}>شاسيه من الحديد معبأ بأوزان بالحمل المطلوبة للحفاظ على توازن الصاعدة مع محبس في نهايته ..</div></div>
          <div className="spec-row"><div className="spec-label">حبال الجر</div><div className="spec-value">{getField('mechanical', 'traction_ropes')}</div></div>
          
          <div className="spec-row" style={{ marginTop: '20px' }}><div className="spec-label">مبين الأدوار</div><div className="spec-value red-text">يتم تركيب مبين في كل الدور .</div></div>
          <div className="spec-row"><div className="spec-label">الصاعدة</div><div style={{ flex: 1 }}>مصنوعة من الصاج المجلفن وتلبس من الداخلي على حسب اتفاق الطرفين - وتحتوي من الداخل على:</div></div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', textAlign: 'center' }} border="1">
          <tbody>
            <tr>
              <td style={{ padding: '8px' }}>جهاز إنتركم -هاتف- يعمل على بطارية</td>
              <td style={{ padding: '8px' }}>جرس إنذار يعمل على بطارية</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>إضاءة طوارئ تعمل على بطارية</td>
              <td style={{ padding: '8px' }}>سقف ديكور استانلس ستيل</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>مروحة تهوية (شفط)</td>
              <td style={{ padding: '8px' }}>ماسك جوانب</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>باب داخلي <span className="red-text">( {getField('elevator', 'inner_door_type')} )</span></td>
              <td style={{ padding: '8px' }}>لوحة ارتيادية</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>لوحة التشغيل والتحكم</td>
              <td style={{ padding: '8px' }}>كرسي الكابينة</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: '15px' }}>
          <div className="spec-row"><div className="spec-label">لوحة التحكم (الكنترول):</div><div style={{ flex: 1 }}>يقوم بتلبية كافة الطلبات عن طريق معالج Microprocessor <span className="red-text">{getField('cabin_control', 'control_panel')}</span>.</div></div>
          <div className="spec-row"><div className="spec-label">قاطع نهاية المشوار</div><div style={{ flex: 1 }}>يقوم بإيقاف مؤكد عند تجاوز الصاعدة لنهاية المشوار العلوي والسفلي <span className="red-text">FUJI YEM</span>.</div></div>
          <div className="spec-row"><div className="spec-label">البراشوت</div><div style={{ flex: 1 }}>يعمل مع الصاعدة ويتم إيقافها اتوماتيكياً عند حدوث ارتخاء أو قطع في أي من حبال الجر أو هبوط الصاعدة بأكثر من السرعة العادية - <span className="red-text">فوجي FUJI YEM</span>.</div></div>
          <div className="spec-row"><div className="spec-label">جهاز الريفيزيون</div><div style={{ flex: 1 }}>خاص بتشغيل وإيقاف المصعد أثناء عمل الصيانة. <span className="red-text">فوجي FUJI YEM</span>.</div></div>
          <div className="spec-row"><div className="spec-label">المزايت</div><div style={{ flex: 1 }}>اتوماتيكية لتزييت السكك صعوداً وهبوطاً لتحفظ لزوجة وانسياب حركة المصعد. <span className="red-text">فوجي FUJI YEM</span>.</div></div>
          <div className="spec-row"><div className="spec-label">الكابل المرن</div><div style={{ flex: 1 }}>لتوصيل الدوائر الكهربائية بين الصاعدة ولوحة التحكم (الكنترول) <span className="red-text">فوجي FUJI YEM</span>.</div></div>
          <div className="spec-row"><div className="spec-label">مخفف الصدمات</div><div style={{ flex: 1 }}>سوست لمنع إصطدام الصاعدة وثقل الموازنة بأرضية البئر الخرسانية بحيث يتناسب حجمها مع حمولة الصاعدة وارتفاع المبنى. <span className="red-text">فوجي FUJI YEM</span>.</div></div>
          <div className="spec-row"><div className="spec-label">جهاز الفرامل في حالة الحريق</div><div style={{ flex: 1 }}>للتحكم اليدوي في حالات الطوارئ أو انقطاع التيار الكهربائي موجودة في الماكينة <span className="red-text">فوجي FUJI YEM</span>.<br/>ربط المصعد مع لوحة إنذار الحريق (في حالة وجودها) بحيث يتم انزال الصاعدة إلى الدور الأرضي وإيقافها عن العمل مع فتح الباب، ويعود المصعد لحالة التشغيل عند إعادة إيقاف الإنذار.</div></div>
        </div>

        <div className="page-footer">
          <div className="page-footer-party">
            <div className="party-title">الطرف الثاني (المشتري)</div>
            <div>{contract.clients?.name}</div>
          </div>
          <div className="page-footer-party">
            <div className="party-title">الطرف الأول (البائع)</div>
            <div>مؤسسة عاصمة الكون للمصاعد</div>
          </div>
        </div>
      </div>

      {/* PAGE 4 */}
      <div className="contract-page">
        <div className="boxed-title" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          البند الرابع: الأعمال التحضيرية
        </div>

        <div style={{ lineHeight: '1.8', marginBottom: '30px' }}>
          <div>1. تجهيز البئر حسب التعليمات الواردة من الإدارة الفنية وتزويده بالإنارة الكافية وذلك قبل بدء العمل في الموقع.</div>
          <div>2. بناء غرفة الماكينة أعلى البئر بمنسوب لا يقل عن أربعة أمتار من منسوب بلاط آخر وقفة وتزويدها.</div>
          <div>3. تعيين وتحديد المنسوب النهائي للبلاط لكل دور قبل بدء التركيب وتحت مسؤولية الطرف الثاني.</div>
          <div>4. تأمين الحفرة أسفل البئر على أن لا يقل منسوب الحفرة عن 100 سم ولا يزيد عن 120 سم من منسوب البلاط.</div>
          <div>5. تأمين فتحات المدخل لتتلائم مع الأبواب طبقاً لرسوماتنا وإذا لزم الامر احضار الكمرات الحديدية لتثبيت الكوابيل وتركيبها .</div>
          <div>6. تأمين التيار الكهربائي بالموقع لأعمال التركيب.</div>
          <div>7. تأمين غرفة إضافية جافة تقفل بمفتاح لأجل استدعاء المعدات ومواد التركيب طيلة مدة التركيب.</div>
          <div>8. تأمين تيار كهربائي مثلث 380 فولت لتشغيل المصعد إلى القاطع الرئيسي في غرفة الماكينة.</div>
          <div>9. تركيب سلم ثابت يؤدي إلى غرفة الماكينة لتسهيل عملية التركيب والصيانة.</div>
          <div>10. أرضية غرفة الماكينة خرسانة سماكة 25 سم على الأقل مع حديد تسليح 16 مم وفي حالة عدم تطابق المواصفات في الموقع يتكفل العميل بتكاليف كمرات حديد داعمة لارضية غرفة الماكينة.</div>
          <div>11. في حالة وجود ميول أو بروز بالبئر أثناء العمل يتم تحديد أماكنها ويتحمل الطرف الثاني مسؤولية تكسيرها.</div>
          <div>12. جميع أعمال التشطيب من لياسه وتقطيب على الأبواب على الطرف الثاني</div>
          <div>13. جميع الأعمال التحضيرية على مسؤولية الطرف الثاني ونفقته .</div>
        </div>

        <div className="boxed-title" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          البند الخامس: الشروط القانونية
        </div>

        <div style={{ lineHeight: '1.8' }}>
          <div>1. يبدأ سريان هذا العقد من تاريخ سداد الدفعة الأولى بموجب سند قبض أو تحويل بنكي على حساب الشركة.</div>
          <div>2. يلتزم الطرف الأول بمراعاة وتنفيذ التعليمات العامة للسلامة في المصاعد طبقاً لتعليمات المديرية العامة للدفاع المدني، ويتحمل مسؤولية الإخلال بأي من تلك التعليمات.</div>
          <div>3. يلتزم الطرف الأول بتركيب سقالة لبئر المصعد للأعمال الخاصة بتركيب وتشغيل المصعد.</div>
          <div>4. يلتزم الطرف الأول بمعاينة الموقع وإعطاء الإرشادات اللازمة لتجهيزه وكذلك إعداد الرسومات والبيانات الفنية الخاصة لموقع المصعد موضوع هذا العقد.</div>
          <div>5. يتم تركيب المصعد خلال ( <span className="red-text">0.0</span> )أشهر تبدأ من تاريخ توقيع العقد بشرط الالتزام بالأعمال التحضيرية وشروط الدفعات.</div>
          <div>6. لا يلتزم الطرف الأول بإنهاء العمل في المواعيد المحددة بالبند في حالة عدم تنفيذ الأعمال التحضيرية الملزم بها الطرف الثاني.</div>
          <div style={{ paddingRight: '20px' }}>• إذا لم تراع شروط الدفع المبينة أدناه</div>
          <div style={{ paddingRight: '20px' }}>• إذا كان التأخير عائد لأي ظروف خارجة عن إرادة الطرف الأول مثل الكوارث الطبيعية.</div>
          <div>7. يحظر على الطرف الثاني نقل المصعد موضوع هذا العقد أو التصرف فيه بالبيع أو التنازل أو الرهن أو الإعارة أو خلاف ذلك قبل سداد كامل الثمن المحدد بالبند، ويحق للطرف الأول إبطال هذه التصرفات حتى يستوفي حقه كاملاً عن طريق الجهات الرسمية.</div>
        </div>

        <div className="page-footer">
          <div className="page-footer-party">
            <div className="party-title">الطرف الثاني (المشتري)</div>
            <div>{contract.clients?.name}</div>
          </div>
          <div className="page-footer-party">
            <div className="party-title">الطرف الأول (البائع)</div>
            <div>مؤسسة عاصمة الكون للمصاعد</div>
          </div>
        </div>
      </div>

      {/* PAGE 5 */}
      <div className="contract-page">
        
        <div style={{ lineHeight: '1.8', marginBottom: '20px' }}>
          <div>9. في حالة الإنتهاء يتم احتساب اول سند صيانة بمثابة التوقيع على الاستلام .</div>
          <div>10. في حالة التعاقد مع شركة أخرى لعمل الصيانة بعد فترة الضمان، يكون الضمان على الماكينة لاغي.</div>
          <div>11. في حالة إدخال تعديل على المواصفات، تمد مدة التسليم ويحددها الطرف الأول مع إعادة النظر في الأسعار.</div>
          <div>12. في حالة طلب أحد الطرفين الغاء العقد قبل البدء في التركيب، يتغرم صاحب الطلب 5% من قيمة العقد.</div>
          <div>13. يعد العقد ملزماً لطرفيه بمجرد التوقيع عليه، ولا يحق لأحد الطرفين إلغاؤه بصفة منفردة لأي سبب كان.</div>
          <div>14. يعتبر العنوان المبين قرين اسم كل طرف في هذا العرض موطناً مختاراً يتعلق بكافة الإشعارات والإخطارات الخاصة بأي شأن من شؤون العقد.</div>
          <div>15. أي خلاف ينشأ عن تطبيق أو تفسير العقد يتم حله بالطرق الودية بين الطرفين، فإن تعذر ذلك يتم حله بالطرق الرسمية.</div>
          <div>16. يحرر العقد من نسختين ببنوده كاملة موقعة صفحاته من كلا الطرفين، بيد كل طرف نسخة للعمل بموجبها</div>
          <div>17. مدة العقد للمصعد 6 أشهر من تاريخ التوقيع، وبعد ذلك يعاد النظر في الأسعار.</div>
        </div>

        <div className="boxed-title" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          البند السادس: شروط أخرى
        </div>

        <div style={{ lineHeight: '1.8', fontWeight: 'bold' }}>
          <div className="red-text">الشركة لديها شهادة مزاولة نشاط من الدفاع المدني لاستخراج التصاريح</div>
          <div className="red-text">الشركة لديها شهادة الايزو 9001 في مجال المصاعد</div>
          <div className="blue-text">• في حالة بيع المبنى، يتم نقل العقد من المالك السابق إلى المالك الجديد.</div>
          
          <div>• مراحل التركيب كالتالي :</div>
          <ul style={{ listStyleType: 'circle', paddingRight: '40px', fontWeight: 'normal' }}>
            <li><strong>المرحلة الأولى</strong> ( عند التعاقد لتوريد وتركيب السكة والابواب ) : ثلاثين يوم من تاريخ استلام الدفعة</li>
            <li><strong>المرحلة الثانية</strong> ( بعد الانهاء من تركيب السكك والابواب ) : ثلاثين يوم من تاريخ استلام الدفعة</li>
            <li><strong>المرحلة الثالثة</strong> ( لتوريد وتركيب الكنترول وتشغيل المصعد ) : ثلاثين يوم من تاريخ استلام الدفعة</li>
          </ul>

          <div className="red-text" style={{ marginTop: '15px' }}>• عرض خاص يشمل :</div>
          <ul className="red-text" style={{ listStyleType: 'circle', paddingRight: '40px', fontWeight: 'normal' }}>
            <li>السعر يشمل تركيب جهاز vvvf لتنعيم حركة المصعد ( مونارش Monarch )</li>
            <li>السعر شامل تركيب مبين في كل دور</li>
            <li>ضمان على الماكينة ( عشر أعوام ) ضد عيوب التصنيع .</li>
            <li>الصيانة المجانية لمدة ( عام واحد ) ميلادي شامل قطع الغيار - تبدأ من تاريخ تشغيل المصعد واستلام الضمان</li>
            <li>السعر شامل تركيب كابينة ستيل حسب اختيار العميل - استيل فضي</li>
            <li>مواصفات الدفاع المدني - والعرض الموحد من الدفاع المدني</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', color: '#dc2626', fontWeight: 'bold', marginTop: '20px', fontSize: '1.2rem' }}>
          والله الموفق ،،،
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontWeight: 'bold', lineHeight: '1.8' }}>
          <div>تحرر الشيكات أو الحوالات بإسم / مؤسسة عاصمة الكون للمصاعد</div>
          <div>حساب بنك الرياض SA0320000001871652459940 / حساب بنك البلاد SA8215000900131070920002</div>
          <div>حساب بنك الراجحي SA3280000201608016391622</div>
        </div>

        <div className="page-footer" style={{ marginTop: '40px' }}>
          <div className="page-footer-party">
            <div className="party-title">الطرف الثاني (المشتري)</div>
            <div>{contract.clients?.name}</div>
          </div>
          <div className="page-footer-party">
            <div className="party-title">الطرف الأول (البائع)</div>
            <div>مؤسسة عاصمة الكون للمصاعد</div>
          </div>
        </div>
      </div>

    </div>
  );
}
