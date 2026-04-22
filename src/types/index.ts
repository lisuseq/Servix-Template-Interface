export type Role = 'mechanic' | 'clerk' | 'manager';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export type WorkOrderStatus = 'pending' | 'in_progress' | 'waiting_parts' | 'completed';

export interface WorkOrder {
  id: string;
  car_make: string;
  car_model: string;
  car_year: number;
  license_plate: string;
  customer_name: string;
  customer_phone: string;
  description: string;
  status: WorkOrderStatus;
  assigned_mechanic_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  mechanic?: Profile;
  tasks?: WorkOrderTask[];
  parts_requests?: PartsRequest[];
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface WorkOrderTask {
  id: string;
  work_order_id: string;
  description: string;
  status: TaskStatus;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  completer?: Profile;
}

export type PartsRequestStatus = 'pending' | 'ordered' | 'received' | 'cancelled';

export interface PartsRequest {
  id: string;
  work_order_id: string;
  mechanic_id: string;
  part_name: string;
  part_number: string;
  quantity: number;
  notes: string;
  status: PartsRequestStatus;
  created_at: string;
  updated_at: string;
  mechanic?: Profile;
  work_order?: WorkOrder;
}
