export interface Pagination {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

export interface WithPagination<TData = unknown> {
  data: TData[];
  pagination: Pagination;
}

export type MonitorStatus =
  | "up"
  | "down"
  | "validating"
  | "paused"
  | "pending"
  | "maintenance";

export type MonitorType =
  | "status"
  | "expected_status_code"
  | "keyword"
  | "keyword_absence"
  | "ping"
  | "tcp"
  | "udp"
  | "smtp"
  | "pop"
  | "imap"
  | "dns"
  | "playwright";

export interface MonitorRequestHeader {
  id: string;
  name: string;
  value: string;
}

export interface MonitorRelationshipRef {
  data: { id: string; type: string } | null;
}

export interface MonitorAttributes {
  url: string;
  pronounceable_name: string;
  auth_username: string;
  auth_password: string;
  monitor_type: MonitorType;
  monitor_group_id: string | null;
  last_checked_at: string | null;
  status: MonitorStatus;
  policy_id: string | null;
  expiration_policy_id: string | null;
  team_name: string;
  required_keyword: string | null;
  verify_ssl: boolean;
  call: boolean;
  sms: boolean;
  email: boolean;
  push: boolean;
  critical_alert: boolean;
  team_wait: number | null;
  http_method: string;
  request_timeout: number;
  recovery_period: number;
  check_frequency: number;
  effective_check_frequency: number;
  effective_check_frequency_reason: string | null;
  request_headers: MonitorRequestHeader[];
  environment_variables: Record<string, string>;
  request_body: string;
  follow_redirects: boolean;
  remember_cookies: boolean;
  created_at: string;
  updated_at: string;
  ssl_expiration: number | null;
  domain_expiration: number | null;
  expected_status_codes: number[];
  port: string | null;
  confirmation_period: number;
  paused_at: string | null;
  proxy_host: string | null;
  proxy_port: number | null;
  regions: string[];
  paused: boolean;
  maintenance_from: string | null;
  maintenance_to: string | null;
  maintenance_timezone: string;
  maintenance_days: string[];
  playwright_script: string | null;
  ip_version: string | null;
  checks_version: string;
}

export interface Monitor {
  id: string;
  type: "monitor";
  attributes: MonitorAttributes;
  relationships: {
    policy: MonitorRelationshipRef;
    expiration_policy: MonitorRelationshipRef;
  };
}

export type Monitors = WithPagination<Monitor>;
