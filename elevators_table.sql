-- Create elevators table
CREATE TABLE elevators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    branch VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE elevators ENABLE ROW LEVEL SECURITY;

-- Create policies for elevators
CREATE POLICY "Enable read access for all users" ON elevators FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON elevators FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON elevators FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON elevators FOR DELETE USING (auth.role() = 'authenticated');
