-- 1. Create Maintenance Visits Table
CREATE TABLE IF NOT EXISTS public.maintenance_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES public.collection_schedule(id) ON DELETE SET NULL,
    visit_date DATE,
    scheduled_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, delayed, cancelled
    has_collection BOOLEAN DEFAULT false,
    report_url TEXT,
    notes TEXT,
    branch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable RLS
ALTER TABLE public.maintenance_visits ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
CREATE POLICY "Enable all operations for authenticated users on maintenance_visits" 
ON public.maintenance_visits FOR ALL USING (auth.role() = 'authenticated');

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_maintenance_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_maintenance_visits_updated_at_trigger
    BEFORE UPDATE ON public.maintenance_visits
    FOR EACH ROW
    EXECUTE FUNCTION update_maintenance_visits_updated_at();

-- 5. Storage Bucket for Reports
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance_reports', 'maintenance_reports', true) ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies for maintenance_reports
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'maintenance_reports');
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'maintenance_reports' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (bucket_id = 'maintenance_reports' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (bucket_id = 'maintenance_reports' AND auth.role() = 'authenticated');
