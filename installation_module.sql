-- 1. Create Installation Phases Table
CREATE TABLE IF NOT EXISTS public.installation_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES public.collection_schedule(id) ON DELETE SET NULL,
    phase_number INTEGER NOT NULL,
    phase_name TEXT NOT NULL,
    scheduled_date DATE,
    completion_date DATE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, delayed
    notes TEXT,
    branch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable RLS
ALTER TABLE public.installation_phases ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
CREATE POLICY "Enable all operations for authenticated users on installation_phases" 
ON public.installation_phases FOR ALL USING (auth.role() = 'authenticated');

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_installation_phases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_installation_phases_updated_at_trigger
    BEFORE UPDATE ON public.installation_phases
    FOR EACH ROW
    EXECUTE FUNCTION update_installation_phases_updated_at();
