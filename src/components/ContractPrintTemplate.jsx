import { formatCurrency, formatDate } from '../lib/supabase';
import PrintHeader from './PrintHeader';
import PrintFooter from './PrintFooter';

export default function ContractPrintTemplate({ contract }) {
  if (!contract) return null;

  const details = contract.meta?.details?.contract || {};
  const clientName = contract.clients?.name || '....................';
  const phone = contract.clients?.phone || '....................';
  const location = details.project_location || details.facility_location || '....................';
  const buildingName = details.project_name || '....................';
  const crNumber = contract.clients?.cr_number || '....................';
  
  const elevatorsCount = details.elevators_count || 1;
  const stopsCount = details.stops_count || 6;
  const elevatorBrand = details.elevator_brand || '....................';
  
  const startDate = formatDate(contract.start_date || new Date().toISOString());
  const endDate = formatDate(contract.end_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString());

  // Determine contract label dynamically
  let contractLabel = "عقد صيانة مصاعد";
  if (contract.contract_type === 'maintenance') {
    contractLabel = "عقد صيانة مصاعد شامل قطع الغيار";
  } else if (contract.contract_type === 'installation') {
    contractLabel = "عقد تركيب مصاعد";
  } else {
    contractLabel = "عقد " + (contract.contract_type === 'maintenance' ? 'صيانة' : 'تركيب');
  }

  const PageHeader = () => (
    <div style={{ display: 'none' /* We will use the layout headers directly if needed */ }} />
  );

  return (
    <div className="print-only-container print-contract-multi-page">
      {/* ----------------- PAGE 1: العقد (الجزء الأول) ----------------- */}
      <div className="contract-page">
        <PrintHeader />
        
        <div style={{ textAlign: 'center', marginBottom: '20px', marginTop: '10px' }}>
          <h2 style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.4rem', margin: '0 0 10px 0' }}>
            <u>{contractLabel}</u>
          </h2>
          <p style={{ fontWeight: 700, margin: 0, fontSize: '1rem' }}>رقم العقد ( {contract.contract_number} )</p>
        </div>

        <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '15px' }}>
          انه فى يوم الموافق {formatDate(contract.created_at)} - تم الاتفاق والتراضى بين كل من :-
        </p>

        <table style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse', border: 'none' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '10px' }}>
                <p style={{ margin: '0 0 10px 0' }}><u><strong>الطرف الأول:</strong></u> <strong>مؤسسة عاصمة الكون للمصاعد</strong></p>
                <p style={{ margin: '0 0 5px 0' }}>ومقرها مكة المكرمة شارع عبدالله خياط ، العزيزية</p>
                <p style={{ margin: '0 0 5px 0' }}>فرع جده - شارع حراء - امام الفحص الدوري</p>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top', direction: 'ltr', textAlign: 'right' }}>
                <p style={{ margin: '0 0 5px 0' }}>جوال رقم : <strong style={{ color: '#dc2626' }}>0544600116</strong></p>
                <p style={{ margin: '0 0 5px 0' }}>جوال رقم : <strong style={{ color: '#dc2626' }}>0504413330</strong></p>
              </td>
            </tr>
            <tr><td colSpan={2} style={{ height: '20px' }}></td></tr>
            <tr>
              <td colSpan={2} style={{ verticalAlign: 'top' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px 40px' }}>
                  <div style={{ flex: '1 1 45%' }}>
                    <p style={{ margin: '0 0 8px 0' }}><u><strong>الطرف الثانى:</strong></u> <strong>المالك : {clientName}</strong></p>
                    <p style={{ margin: '0 0 8px 0' }}><strong>المستأجر :</strong> ..........................</p>
                    <p style={{ margin: '0 0 8px 0' }}><strong>اسم المبنى:</strong> <strong style={{ color: '#dc2626' }}>{buildingName}</strong></p>
                    <p style={{ margin: '0 0 8px 0' }}><strong>العنوان :</strong> - {location}</p>
                  </div>
                  <div style={{ flex: '1 1 45%' }}>
                    <p style={{ margin: '0 0 8px 0', direction: 'ltr', textAlign: 'right' }}>جوال رقم : <strong style={{ color: '#dc2626' }}>{phone}</strong></p>
                    <p style={{ margin: '0 0 8px 0', direction: 'ltr', textAlign: 'right' }}></p>
                    <p style={{ margin: '0 0 8px 0', direction: 'ltr', textAlign: 'right' }}>رقم السجل التجاري : ( <strong style={{ color: '#dc2626' }}>{crNumber}</strong> )</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '10px' }}>وقد اتفق الطرفين على البنود التالية:</p>

        <ol className="contract-terms" style={{ paddingInlineStart: '20px', margin: 0, fontSize: '0.85rem', lineHeight: '1.8' }}>
          <li>
            وافق الطرف الأول باعمال الفحص والصيانة الدورية <strong style={{ color: '#dc2626' }}>(العدد 12 زيارة كل شهر زيارة - مدته سنة واحدة )</strong> لعدد ( <strong style={{ color: '#dc2626' }}>{elevatorsCount}</strong> ) مصعد للمبنى العائد للطرف الثانى الكائن فى {location}.
          </li>
          <li>
            مواصفات المصاعد كالاتى: -
            <ul style={{ listStyleType: 'disc', margin: '5px 0', paddingInlineStart: '25px' }}>
              <li>عدد المصاعد : ( <strong style={{ color: '#dc2626' }}>{elevatorsCount}</strong> ) مصعد.</li>
              <li>عدد الوقفات: ( <strong style={{ color: '#dc2626' }}>{stopsCount}</strong> ) وقفات.</li>
              <li>نوع الأبواب : ( <strong style={{ color: '#dc2626' }}>اتوماتيك سنتر</strong> )</li>
              <li>نوع المصعد : ( <strong style={{ color: '#dc2626' }}>{elevatorBrand}</strong> )</li>
              <li>الحمولة : ( <strong style={{ color: '#dc2626' }}>800</strong> ) كجم ( <strong style={{ color: '#dc2626' }}>9</strong> ) اشخاص.</li>
            </ul>
          </li>
          <li>يقوم الطرف الأول بفحص وصيانة واصلاح المصاعد بايدى فنية مدربة ومتخصصة فى الصيانة و الفحص و الاصلاح.</li>
          <li>يتحمل الطرف الأول اى اضرار قد تنشأ عن استخدامه لعمالة غير مدربة ومتخصصة فى الصيانة و الفحص و الاصلاح.</li>
          <li>يقوم الطرف الأول بتأمين فنى يكون متواجد فى المؤسسة خلال 24 ساعة لتقديم خدمة الطوارئ واصلاح الاعطال الطارئة التى يبلغ بها الطرف الثانى.</li>
          <li>
            يقوم الطرف الأول باعمال الفحص والصيانة والتنظيف والتزييت والتشحيم الشهرى وتشمل مايلى :-
            <div style={{ marginTop: '5px' }}>
              <u><strong>فى غرفة المحرك :-</strong></u>
              <ol style={{ listStyleType: 'decimal', margin: '5px 0', paddingInlineStart: '25px' }}>
                <li>فحص زيت المحرك والتاكد من سيره الطبيعى.</li>
                <li>فحص قماش الفرامل.</li>
                <li>فحص عمل الفرمل وضبط وتشحيم المحاور.</li>
                <li>فحص السيور والتاكد من سلامتها.</li>
                <li>فحص نظم السرعة وضبطه.</li>
                <li>تنظيف ارضية الغرفة.</li>
                <li>التاكد من سلامة التمديدات الكهربائية بالغرفة.</li>
                <li>التاكد من عدم وجود تهريب مياه بالغرفة.</li>
                <li>التاكد من عدم وجود اى تخزين بالغرفة.</li>
                <li>التاكد من تشغيل التكييف بحالة سليمة.</li>
              </ol>
            </div>
            <div style={{ marginTop: '5px' }}>
              <u><strong>فى بئر المصعد :-</strong></u>
              <ol start="11" style={{ listStyleType: 'decimal', margin: '5px 0', paddingInlineStart: '25px' }}>
                <li>فحص التوصيلات الكهربائية اعلى الصاعدة والتأكد من سلامتها.</li>
                <li>فحص جهاز الريفزيون فى حالة الصعود والهبوط والتوقف.</li>
                <li>فحص حبال الجر وتثبيتات الحبال.</li>
              </ol>
            </div>
          </li>
        </ol>
      </div>

      {/* ----------------- PAGE 2: العقد (الجزء الثاني) ----------------- */}
      <div className="contract-page">
        <ol start="6" className="contract-terms" style={{ paddingInlineStart: '20px', margin: 0, fontSize: '0.85rem', lineHeight: '1.8' }}>
          <li style={{ listStyleType: 'none', marginLeft: '-20px' }}>
            <div>
              <ol start="14" style={{ listStyleType: 'decimal', margin: '0 0 5px 0', paddingInlineStart: '45px' }}>
                <li>فحص بكرات الحبال والتاكد من سلامتها.</li>
                <li>تزييت وتشحيم آلة سير الصاعدة والثقل.</li>
                <li>فحص قواطع نهاية المشوار.</li>
                <li>فحص مغناطيسات الادوار.</li>
                <li>الكشف على مروحة الصاعدة.</li>
              </ol>
            </div>
            <div style={{ marginTop: '5px' }}>
              <u><strong>فى داخل الصاعدة :-</strong></u>
              <ol start="19" style={{ listStyleType: 'decimal', margin: '5px 0', paddingInlineStart: '45px' }}>
                <li>الكشف عن ازرار التحكم والتشغيل.</li>
                <li>الكشف عن الانارة والجرس والانتركم.</li>
              </ol>
            </div>
            <div style={{ marginTop: '5px' }}>
              <u><strong>ابواب الطوابق :-</strong></u>
              <ol start="21" style={{ listStyleType: 'decimal', margin: '5px 0', paddingInlineStart: '45px' }}>
                <li>فحص ابواب الادوار وضبطها.</li>
                <li>فحص محركات الابواب.</li>
                <li>فحص وتنظيف الشوك والكوالين.</li>
                <li>فحص مفصلات الابواب.</li>
              </ol>
              <div style={{ paddingInlineStart: '25px', marginTop: '5px' }}>فحص اى اجزاء اخرى او حسب مايراه احد طرفى العقد.</div>
            </div>
          </li>
          <li>يقوم الطرف الأول بتوفير مواد التنظيف والتشحيم.</li>
          <li>يقوم الطرف الأول باصلاح جميع الاعطال التى تظهر اثناء الفحص.</li>
          <li>يقوم الطرف الأول باصلاح جميع الاعطال التى تحدث للمصعد بمجرد التبليغ من قبل الطرف الثانى فيما لايتجاوز الاربعة وعشرين ساعة.</li>
          <li>يتحمل الطرف الثانى قطع الغيار التى يتم تركيبها فى المصعد / المصاعد نتيجة الاستهلاك او سوء الاستعمال من خلال تقديم فاتورة من الطرف الأول موضحا بها سعر القطع والفترة الزمنية اللازمة ليتم اعتمادها من قبل الطرف الثانى لتوريدها وتركيبها.</li>
          <li>يقوم الطرف الأول بتسليم الطرف الثانى كافة قطع الغيار المستبدلة رسميا.</li>
          <li>يتحمل الطرف الأول جميع الخسائر والاضرار التى قد تحدث فى حال تركيب قطع غيار مقلدة عن طريقه وكذا الحال فى تحمل المسئولية على الطرف الثانى عند تركيبها من خلاله.</li>
          <li>يتعهد الطرف الأول بتدريب الشخص او الحارس المعين من قبل الطرف الثانى عن تحريك الصاعدة يدويا فى حالة الطوارئ وعليه تسليمه مفتاح خاص لابواب المصعد.</li>
          <li>يتعهد الطرف الثانى باتباع الارشادات المقدمة من قبل الطرف الأول بخصوص استعمال المصعد / المصاعد وفى حالة عدم اتباعه هذه الارشادات يخلى مسئولية الطرف الأول تماما من اى اضرار قد تحدث لا سمح الله من جراء ذلك.</li>
          <li>
            اتفق الطرفان على أن تكون قيمة عقد الصيانة للفترة الموفق عليها لكل مصعد مبلغ وقدره ( <strong style={{ color: '#dc2626' }}>{(contract.total_amount / (elevatorsCount || 1)).toFixed(2)}</strong> ريال ) <strong style={{ color: '#dc2626' }}>فقط</strong> 
            <br/>
            لكل مصعد للفترة المتفق عليها، وبإجمالي عدد ( <strong style={{ color: '#dc2626' }}>{elevatorsCount}</strong> ) مصعد تكون القيمة الإجمالية للفترة المتفق عليها: ( <strong style={{ color: '#dc2626' }}>{formatCurrency(contract.total_amount)}</strong> ) <strong style={{ color: '#dc2626' }}>(شاملة ضريبة القيمة المضافة 15%).</strong>
          </li>
          <li>طريقة الدفع : <strong style={{ color: '#dc2626' }}>يسدد المبلغ عند بداية التعاقد ولا يفعل العقد الا بعد دفع كامل المبلغ.</strong></li>
          <li>فى حال انتقال المبنى اثناء سريان العقد فعلى الطرف الثانى اشعار الطرف الأول باسم المالك الجديد وعنوانه كاملا مع اخلاء التزاماته التعاقدية مع الطرف الأول.</li>
          <li>اذا اراد الطرف الثانى الغاء هذا العقد لاى سبب كان فلايحق له المطالبة باية مبالغ يكون قد دفعها مقدما للطرف الأول اذ تصبح هذه المبالغ من حق الطرف الأول.</li>
          <li>فى حالة اخلال الطرف الأول وعدم تجاوبه باعمال الصيانة فى مواعيدها فيتوجب على الطرف الأول دفع قيمة ماتم اخذه من الطرف الثانى وفى حالة عدم وجود مشهد الصيانة الشهرية.</li>
          <li>من المتفق عليه بين الطرفين بان فواتير قطع الغيار المقدمة من الطرف الأول تسدد كاملة فى مدة اقصاها (5) خمسة ايام ويحق للطرف الأول ايقاف الصيانة بعد تبليغ ادارة الدفاع المدنى خطيا بذلك فى حال عدم قيام الطرف الثانى بتسديد المبالغ المستحقة فى اوقاتها واذا قرر الطرفان ايقاف العمل قبل مدته يحتفظ الطرف الأول بكامل حقوقه المالية عن الفترة السابقة لانهاء العقد.</li>
          <li>يعمل بهذا العقد لمدة زمنية تبدأ من تاريخ <strong style={{ color: '#dc2626' }}>{startDate}</strong> وحتى تاريخ <strong style={{ color: '#dc2626' }}>{endDate}</strong>.</li>
          <li>حرر هذا العقد من نسختين وتم توقيع الطرفين على جميع صفحاته وبيد كل طرف نسخة للعمل بموجبها وابرازها عند اللزوم لجهات الاختصاص وفى اى نزاع قد ينشأ بين الطرفين لا سمح الله.</li>
        </ol>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px' }}>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 40px 0', fontWeight: 800 }}>مؤسسة عاصمة الكون للمصاعد</h4>
            <p style={{ margin: '0', fontWeight: 700 }}>التوقيع /</p>
            <p style={{ margin: '40px 0 0 0', fontWeight: 700 }}>التاريخ /</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 40px 0', fontWeight: 800 }}>الطرف الثاني</h4>
            <h4 style={{ margin: '0 0 40px 0', fontWeight: 800 }}>{clientName}</h4>
            <p style={{ margin: '0', fontWeight: 700 }}>التوقيع /</p>
            <p style={{ margin: '40px 0 0 0', fontWeight: 700 }}>التاريخ /</p>
          </div>
        </div>
      </div>

      {/* ----------------- PAGE 3: تقرير فني بسلامة مصعد ----------------- */}
      <div className="contract-page">
        <PrintHeader />
        
        <div style={{ textAlign: 'center', marginBottom: '20px', marginTop: '10px' }}>
          <h2 style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.2rem', margin: '0' }}>
            <u>تقرير فني بسلامه مصعد/مصاعد بتاريخ {formatDate(contract.created_at)}</u>
          </h2>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 800, textDecoration: 'underline', marginBottom: '10px' }}>أولا:- البيانات الأساسية للمنشأه</h3>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: '15px', fontSize: '0.85rem' }}>
          <tbody>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f8fafc', width: '20%', textAlign: 'right' }}>اسم المبنى:</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px', width: '30%' }}>{buildingName}</td>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f8fafc', width: '20%', textAlign: 'right' }}>الموقع:</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px', width: '30%' }}>{location}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f8fafc', textAlign: 'right' }}>نشاط المنشأه:</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>فندقي / سكني</td>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f8fafc', textAlign: 'right' }}>عدد الادوار:</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{stopsCount}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f8fafc', textAlign: 'right' }}>اسم المؤسسة المصاعد:</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}><strong>مؤسسة عاصمة الكون للمصاعد</strong></td>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f8fafc', textAlign: 'right' }}>عدد المصاعد:</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{elevatorsCount}</td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '20px' }}>
          رقم السجل التجاري : ( <strong style={{ color: '#dc2626' }}>{crNumber}</strong> ) عقد صيانه من تاريخ <strong style={{ color: '#dc2626' }}>{startDate}</strong> وإلى تاريخ <strong style={{ color: '#dc2626' }}>{endDate}</strong>.
        </p>

        <h3 style={{ fontSize: '1rem', fontWeight: 800, textDecoration: 'underline', marginBottom: '10px' }}>ثانيا:- متطلبات الأمان فى المصاعد :</h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '0.75rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>م</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>نوع الكشف</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>الحاله</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>م</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>نوع الكشف</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>الحاله</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["التأكد من نوعيه الماكينة وقوتها وتركيبها بشكل صحيح", "أختبار الرفزيون صعودا وهبوطا والتوقف"],
              ["التأكد من منسوب الزيت وعدم وجود تهريب", "أختبار سيفتى البراشوط الكهربائية على فريم الكابينه"],
              ["علامات الحبال", "الكشف على مروحه الشفط"],
              ["حساب ابعادة الصاعدة", "التاكد من سرعه المصعد"],
              ["الحبال الرئيسيه جيده", "الكشف على الكابل المرن"],
              ["وافيه الحبال موجوده ومثبته بشكل جيد", "الفيش بليت مشدوده وعليها كامل البراغى والصواميل"],
              ["زياده حموله التيار الكهربائى او ثرموستات الموتور الرئيسى", "فحص الابواب الخارجيه كهربيا وميكانيكيا وفيش الابواب"],
              ["الكشف على الكاوتش اسفل الكابينه", "التاكد من حسابات ثقل الموازنه ونوعيتها ومحبس الثقل"],
              ["الكشف على جهاز الايماثك عند انقطاع التيار", "كوسينات او شوز الثقل مثبتا ويوجد بها واقى للشوز"],
              ["دائره انقلاب اوجه التيار الكهربى", "الكشف على مخفف الصدمات"],
              ["سويتش منظم السرعه الكهربائية مثبت ويعمل سليم", "الكشف على محبس الموازنه"],
              ["فيوزات الكنترول", "الكشف على زحلقه الكابينه"],
              ["اختبار فرامل الماكينه", "اختبار ميزان الحموله"],
              ["ربط لوحه التحكم بلوحه انذار الحريق", "اختبار اداء الانتركام والجرس ولمبه الطوارئ عند انقطاع التيار"],
              ["اتجاه دوران منظم السرعه بالاتجاه الصحيح", "اختبار مستوى الوقوف"],
              ["منظم السرعه مثبت بشكل جيد ويعمل ميكانيكيا وكهربيا", "اختبار جميع الطلبات الداخليه والخارجيه"]
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{i + 1}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'right' }}>{row[0]}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>✓</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{i + 17}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'right' }}>{row[1]}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>✓</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontWeight: 800, fontSize: '1.1rem' }}>مؤسسة عاصمة الكون للمصاعد</h4>
          <p style={{ margin: 0, fontWeight: 700 }}>قسم الصيانة والأعطال والطوارئ</p>
        </div>
      </div>

      {/* ----------------- PAGE 4: شهادة إنزال مصعد ----------------- */}
      <div className="contract-page">
        <PrintHeader />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '0.9rem', fontWeight: 700 }}>
          <div style={{ textAlign: 'right', direction: 'rtl' }}>
            <p style={{ margin: '0 0 5px 0' }}>التاريخ: {formatDate(contract.created_at)}</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.4rem', margin: '0' }}>شهادة إنزال مصعد</h2>
        </div>

        <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '20px' }}>السادة / المديرية العامة للدفاع المدني بالعاصمة المقدسة المحترمين</p>
        <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '20px', textAlign: 'center' }}>عناية قسم السلامة</p>
        <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '20px', textAlign: 'center' }}>السلام عليكم ورحمه الله وبركاته</p>

        <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '20px' }}>
          نفيدكم نحن <strong>مؤسسة عاصمة الكون للمصاعد</strong> بان المصاعد المركبة في المبنى التالي والمذكور بياناتها ادناه:
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: '20px', fontSize: '0.95rem' }}>
          <tbody>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', width: '25%', textAlign: 'right' }}>المالك</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 700 }}>{clientName}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>المستأجر</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 700 }}>..........................</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>اسم المبنى</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', color: '#dc2626', fontWeight: 700 }}>{buildingName}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>رقم السجل التجاري</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', color: '#dc2626', fontWeight: 700 }}>( {crNumber} )</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>موقع المبنى</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px' }}>{location}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>رقم العقد</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', color: '#dc2626', fontWeight: 700 }}>{contract.contract_number}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>عدد المصاعد</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 700 }}>( <strong style={{ color: '#dc2626' }}>{elevatorsCount}</strong> ) مصعد</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>مدة عقد الصيانة</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 700 }}>
                من تاريخ <strong style={{ color: '#dc2626' }}>{startDate}</strong> وحتى تاريخ <strong style={{ color: '#dc2626' }}>{endDate}</strong>.
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: '1.8', marginBottom: '30px' }}>
          قد تم تجهيزه للعمل في حالة حدوث حريق لا سمح الله للوصول للدور الأرضي حيث تقوم بفتح الأبواب ولا تعمل مرة أخرى الا بعد الانتهاء من الحريق وقد تم تركيب القطع اللازمة لذلك وتقوم الشركة بصيانة تلك القطع المركبة بكونترول المصاعد فقط وذلك من تاريخ ( <strong style={{ color: '#dc2626' }}>{startDate}</strong> وحتى تاريخ <strong style={{ color: '#dc2626' }}>{endDate}</strong> ). هذه شهادة منا بذلك.
          <br />وتقبلوا خالص التحية والتقدير
        </p>

        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontWeight: 800, fontSize: '1.2rem' }}>مؤسسة عاصمة الكون للمصاعد</h4>
          <p style={{ margin: 0, fontWeight: 700 }}>قسم الصيانة والأعطال والطوارئ</p>
        </div>
      </div>

      {/* ----------------- PAGE 5: مشهد التزام ----------------- */}
      <div className="contract-page">
        <PrintHeader />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '0.9rem', fontWeight: 700 }}>
          <div style={{ textAlign: 'right', direction: 'rtl' }}>
            <p style={{ margin: '0 0 5px 0' }}>التاريخ: {formatDate(contract.created_at)}</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.4rem', margin: '0' }}>مشهد التزام</h2>
        </div>

        <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '20px' }}>
          تشهد <strong>مؤسسة عاصمة الكون للمصاعد</strong> بأن مصاعد مبنى:
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: '20px', fontSize: '0.95rem' }}>
          <tbody>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', width: '25%', textAlign: 'right' }}>المالك</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 700 }}>{clientName}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>المستأجر</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 700 }}>..........................</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>اسم المبنى</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', color: '#dc2626', fontWeight: 700 }}>{buildingName}</td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f8fafc', textAlign: 'right' }}>رقم السجل التجاري</th>
              <td style={{ border: '1px solid #cbd5e1', padding: '10px', color: '#dc2626', fontWeight: 700 }}>( {crNumber} )</td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: '1.8', marginBottom: '20px' }}>
          وعددها ( <strong style={{ color: '#dc2626' }}>{elevatorsCount}</strong> ) مصعد، تتوفر فيها عناصر السلامة الميكانيكية والكهربائية اللازمة وجميع متطلبات السلامة بها ( مروحة - باب داخلي - هاتف - جرس الانذار ) وتعمل بشكل جيد والمصاعد سليمة وغير متهالكة طوال مدة العقد المبرم كما نلتزم بالآتي:
        </p>

        <ol style={{ paddingInlineStart: '20px', margin: 0, fontSize: '0.95rem', lineHeight: '1.8', fontWeight: 600 }}>
          <li>تكثيف أعمال الصيانة الدورية بداية موسم الحج وأن يكون ذلك بحضور مالك أو مستأجر أو مسؤول أو حارس المبنى.</li>
          <li>التنفيذ بوضع الإشارات التحذيرية أثناء عمل الصيانة وخاصة عند تواجد الحجاج بالمبنى وعدم المغادرة إلا بعد التأكد من انتهاء أعمال الصيانة وإغلاق جميع الأبواب للمصعد في الأدوار.</li>
        </ol>

        <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: '30px 0' }}>
          وعلى ما تم ذكره أعلاه تم التوقيع....
        </p>

        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontWeight: 800, fontSize: '1.2rem' }}>مؤسسة عاصمة الكون للمصاعد</h4>
          <p style={{ margin: 0, fontWeight: 700 }}>قسم الصيانة والأعطال والطوارئ</p>
        </div>
      </div>

    </div>
  );
}
