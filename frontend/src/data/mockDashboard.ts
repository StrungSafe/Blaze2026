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
  badge: "Auto-checked" | "Reviewed" | "Unchecked";
  updated: string;
}

export const mockDashboardStats: DashboardStat[] = [
  {
    label: "Templates explored",
    value: "24",
    change: "+4 this week",
    icon: "explore",
    color: "purple",
  },
  {
    label: "Published templates",
    value: "06",
    change: "Your contributions",
    icon: "publish",
    color: "orange",
  },
  {
    label: "Auto-checked",
    value: "04",
    change: "Latest audit passed",
    icon: "checked",
    color: "green",
  },
  {
    label: "Community flags",
    value: "02",
    change: "Across your activity",
    icon: "flags",
    color: "blue",
  },
];

export const mockRecentActivity: DashboardActivity[] = [
  {
    id: 1,
    title: "Template published",
    description: "BCH Payment Template",
    time: "Today · 10:42 AM",
    status: "Published",
    type: "publish",
  },
  {
    id: 2,
    title: "Automated check completed",
    description: "Multi-signature Wallet Template",
    time: "Yesterday · 4:18 PM",
    status: "Auto-checked",
    type: "check",
  },
  {
    id: 3,
    title: "Template explored",
    description: "Recurring Payment Template",
    time: "Yesterday · 1:30 PM",
    status: "Viewed",
    type: "explore",
  },
  {
    id: 4,
    title: "Community flag submitted",
    description: "Legacy Payment Template",
    time: "Nov 12 · 11:05 AM",
    status: "Submitted",
    type: "flag",
  },
];

export const mockTemplates: DashboardTemplate[] = [
  {
    id: "XO-8F21A9",
    name: "BCH Payment Template",
    category: "Payments",
    badge: "Auto-checked",
    updated: "Today",
  },
  {
    id: "XO-4C72B1",
    name: "Multi-signature Wallet",
    category: "Wallet",
    badge: "Reviewed",
    updated: "Yesterday",
  },
  {
    id: "XO-9D31F5",
    name: "Recurring Payment Template",
    category: "Payments",
    badge: "Unchecked",
    updated: "Nov 12",
  },
];