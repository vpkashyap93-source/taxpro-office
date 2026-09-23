import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileStack,
  FileText,
  Gauge,
  KeyRound,
  ListChecks,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Module } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: Module;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, module: "dashboard" },
  { href: "/clients", label: "Clients", icon: Users, module: "clients" },
  { href: "/billing", label: "Billing & Invoices", icon: FileText, module: "billing" },
  { href: "/payments", label: "Payments", icon: CreditCard, module: "payments" },
  { href: "/compliance", label: "Compliance", icon: ClipboardCheck, module: "compliance" },
  { href: "/documents", label: "Documents", icon: FileStack, module: "documents" },
  { href: "/cma", label: "CMA", icon: Briefcase, module: "cma" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, module: "calendar" },
  { href: "/notices", label: "Notices", icon: Bell, module: "notices" },
  { href: "/dsc", label: "DSC Tracker", icon: KeyRound, module: "dsc" },
  { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { href: "/team", label: "Team Management", icon: UserRound, module: "team" },
  { href: "/client-portal", label: "Client Portal", icon: FileSignature, module: "portal" },
  { href: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

export const NAV_GROUPS: { label: string; items: string[] }[] = [
  { label: "Overview", items: ["/dashboard"] },
  { label: "Practice", items: ["/clients", "/compliance", "/documents", "/cma", "/notices", "/dsc"] },
  { label: "Finance", items: ["/billing", "/payments"] },
  { label: "Work", items: ["/tasks", "/calendar", "/reports"] },
  { label: "Firm", items: ["/team", "/client-portal", "/settings"] },
];

export const QUICK_ACTIONS: { label: string; href: string; module: Module }[] = [
  { label: "Add Client", href: "/clients?new=1", module: "clients" },
  { label: "Create Bill", href: "/billing/invoices/new", module: "billing" },
  { label: "Add Task", href: "/tasks?new=1", module: "tasks" },
  { label: "Add Payment", href: "/payments?new=1", module: "payments" },
  { label: "Upload Document", href: "/documents?upload=1", module: "documents" },
  { label: "New Compliance", href: "/compliance?new=1", module: "compliance" },
];
