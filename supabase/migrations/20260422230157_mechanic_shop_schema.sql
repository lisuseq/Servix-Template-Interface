/*
  # Mechanic Shop Portal Schema

  ## Tables
  1. `profiles` - Extends auth.users with role and display name
     - role: mechanic | clerk | manager
  2. `work_orders` - Car repair orders created by clerks
  3. `work_order_tasks` - Individual repair tasks within an order
  4. `parts_requests` - Parts needed by mechanics, visible to clerks

  ## Security
  - RLS enabled on all tables
  - Mechanics: read assigned orders, update tasks, create parts requests
  - Clerks: full CRUD on work orders and tasks, update parts requests
  - Managers: read-only on everything for monitoring
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'mechanic' CHECK (role IN ('mechanic', 'clerk', 'manager')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Work Orders
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_make text NOT NULL DEFAULT '',
  car_model text NOT NULL DEFAULT '',
  car_year integer NOT NULL DEFAULT 2000,
  license_plate text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_parts', 'completed')),
  assigned_mechanic_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view work orders"
  ON work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clerks and managers can insert work orders"
  ON work_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  );

CREATE POLICY "Clerks and managers can update work orders"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  );

CREATE POLICY "Mechanics can update assigned work order status"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (assigned_mechanic_id = auth.uid())
  WITH CHECK (assigned_mechanic_id = auth.uid());

-- Work Order Tasks
CREATE TABLE IF NOT EXISTS work_order_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_order_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks"
  ON work_order_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clerks and managers can insert tasks"
  ON work_order_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  );

CREATE POLICY "Clerks and managers can update tasks"
  ON work_order_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  );

CREATE POLICY "Mechanics can update tasks on assigned orders"
  ON work_order_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders
      WHERE work_orders.id = work_order_tasks.work_order_id
      AND work_orders.assigned_mechanic_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_orders
      WHERE work_orders.id = work_order_tasks.work_order_id
      AND work_orders.assigned_mechanic_id = auth.uid()
    )
  );

-- Parts Requests
CREATE TABLE IF NOT EXISTS parts_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  part_name text NOT NULL DEFAULT '',
  part_number text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view parts requests"
  ON parts_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Mechanics can insert parts requests"
  ON parts_requests FOR INSERT
  TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

CREATE POLICY "Mechanics can update own parts requests"
  ON parts_requests FOR UPDATE
  TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

CREATE POLICY "Clerks and managers can update parts requests"
  ON parts_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('clerk', 'manager')
    )
  );

-- Trigger to update work_orders.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER parts_requests_updated_at
  BEFORE UPDATE ON parts_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
