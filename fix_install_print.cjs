const fs = require('fs');
let content = fs.readFileSync('src/components/InstallPrintTemplate.jsx', 'utf8');

const fields = [
  { text: 'قاطع نهاية المشوار', key: 'limit_switch' },
  { text: 'البراشوت', key: 'parachute' },
  { text: 'جهاز الريفيزيون', key: 'revision_device' },
  { text: 'المزايت', key: 'oilers' },
  { text: 'الكابل المرن', key: 'flexible_cable' },
  { text: 'مخفف الصدمات', key: 'shock_absorbers' },
  { text: 'جهاز الفرامل في حالة الحريق', key: 'fire_brake_device' }
];

fields.forEach(f => {
  const regex = new RegExp(`(<div className="spec-row"><div className="spec-label">${f.text}</div>[\\s\\S]*?</div></div>)`);
  content = content.replace(regex, `{details?.safety?.${f.key} !== false && $1}`);
});

fs.writeFileSync('src/components/InstallPrintTemplate.jsx', content);
