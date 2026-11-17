
export interface DashboardStat {
  label: string;
  value: string;
  change: string;
  icon: "explore" | "publish" | "checked" | "flags";
  color: "purple" | "orange" | "green" | "blue";
}

export interface DashboardActivity {
  id: number;
  title: string;
  description: string;
  time: string;
  status: string;
  type: "publish" | "check" | "explore" | "flag";
}

export interface DashboardTemplate {
  id: string;
  name: string;
  category: string;
  badge: string;
  updated: string;
}

export const mockDashboardStats: DashboardStat[];

export const mockRecentActivity: DashboardActivity[];

export const mockTemplates: DashboardTemplate[];
