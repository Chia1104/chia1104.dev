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

export interface Monitor {
  id: string;
  type: "monitor";
  attributes: {
    url: string;
    pronounceable_name: string;
    monitor_type: string;
    monitor_group_id: string;
    last_checked_at: string;
    status: "up" | "paused" | "pending" | "maintenance" | "validating" | "down";
    policy_id: null;
    expiration_policy_id: null;
    team_name: string;
    required_keyword: string;
    verify_ssl: boolean;
    check_frequency: number;
    call: boolean;
    sms: boolean;
    email: boolean;
    push: boolean;
    team_wait: null;
    http_method: string;
    request_timeout: number;
    recovery_period: number;
    request_headers: { id: string; name: string; value: string }[];
    request_body: string;
    paused_at: null;
    created_at: string;
    updated_at: string;
    ssl_expiration: number;
    domain_expiration: number;
    regions: string[];
    maintenance_from: string;
    maintenance_to: string;
    maintenance_timezone: string;
    maintenance_days: string[];
    port: null;
    confirmation_period: number;
  };
}

export type Monitors = WithPagination<Monitor>;
