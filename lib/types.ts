export type ServiceStatus = 'normal' | 'warning' | 'critical';

export interface Service {
  id: string;
  name: string;
  category: string;
  icon_name: string;
  status: ServiceStatus;
  ping_enabled?: boolean;
  ping_address?: string;
  ping_interval?: number;
}

export interface Report {
  id: string;
  service_id: string;
  region?: string;
  connection_type?: string;
  issue_type?: string;
  device?: string;
  tests_done?: string;
  is_resolved: boolean;
  created_at: string;
  services?: Service;
  custom_fields?: Record<string, string>;
}

export interface ServiceWithCount extends Service {
  report_count: number;
}

export interface ReportOptions {
  regions: string[];
  connection_types: string[];
  issue_types: string[];
  devices: string[];
}

export interface StatusThresholds {
  critical: number;
  warning: number;
  windowMinutes: number;
}

export interface FormField {
  id: string;
  label: string;
  type: 'select' | 'text';
  required: boolean;
  options?: string[]; // Only used if type === 'select'
}

export type FormSchema = FormField[];

export interface PingConfig {
  label: string;
  threshold_green: number;
  threshold_yellow: number;
}

export interface Setting {
  key: string;
  value: ReportOptions | StatusThresholds | FormSchema | PingConfig | any;
  updated_at: string;
}
