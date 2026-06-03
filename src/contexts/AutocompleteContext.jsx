import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const AutocompleteContext = createContext({});

export function useAutocomplete() {
  return useContext(AutocompleteContext);
}

export function AutocompleteProvider({ children }) {
  const { user } = useAuth();
  const [memory, setMemory] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMemory();
    } else {
      setMemory({});
      setLoading(false);
    }
  }, [user]);

  async function fetchMemory() {
    try {
      const { data, error } = await supabase
        .from('autocomplete_memory')
        .select('category, value')
        .order('usage_count', { ascending: false });

      if (error) {
        // إذا كان الجدول غير موجود بعد (لم يتم تشغيل السكربت)
        console.warn('Could not fetch autocomplete memory. Please ensure the SQL script is run.', error);
        return;
      }

      // تجميع البيانات في كائن حسب التصنيف (category)
      const newMemory = {};
      data?.forEach(item => {
        if (!newMemory[item.category]) {
          newMemory[item.category] = [];
        }
        newMemory[item.category].push(item.value);
      });

      setMemory(newMemory);
    } catch (err) {
      console.error('Error fetching autocomplete memory:', err);
    } finally {
      setLoading(false);
    }
  }

  // دالة لحفظ المدخلات الجديدة أو تحديث عدد مرات الاستخدام
  async function saveMemory(items) {
    // items عبارة عن مصفوفة من الكائنات [{ category: 'brand', value: 'Fuji' }, ...]
    if (!items || items.length === 0) return;

    // فلترة القيم الفارغة
    const validItems = items.filter(item => item.value && item.value.trim() !== '');
    if (validItems.length === 0) return;

    try {
      // بما أن Supabase لا يدعم زيادة العداد (increment) في upsert مباشرة بدون RPC، 
      // سنستخدم دالة بسيطة للإدراج فقط، والـ upsert سيتعامل مع التكرار
      for (const item of validItems) {
        const { error } = await supabase
          .from('autocomplete_memory')
          .upsert(
            { 
              category: item.category, 
              value: item.value.trim(),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'category,value', ignoreDuplicates: true } // ignoreDuplicates يمنع خطأ التكرار، ولن يزيد العداد، وهذا يكفي للآن لأن هدفنا توفير الذاكرة
          );
        if (error) console.error('Error saving memory for:', item.category, error);
      }
      
      // تحديث الحالة المحلية فوراً لتظهر الكلمات في المرات القادمة بدون إعادة تحميل
      setMemory(prev => {
        const next = { ...prev };
        validItems.forEach(item => {
          const cat = item.category;
          const val = item.value.trim();
          if (!next[cat]) next[cat] = [];
          if (!next[cat].includes(val)) {
            next[cat] = [...next[cat], val];
          }
        });
        return next;
      });

    } catch (err) {
      console.error('Error saving memories:', err);
    }
  }

  const value = {
    memory,
    loading,
    saveMemory
  };

  return (
    <AutocompleteContext.Provider value={value}>
      {children}
    </AutocompleteContext.Provider>
  );
}
