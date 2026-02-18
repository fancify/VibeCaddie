import type { NavItem } from "@/components/ui/bottom-nav";

export type { NavItem };

export const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "home" },
  { label: "Courses", href: "/courses", icon: "map" },
  { label: "Rounds", href: "/rounds", icon: "clipboard" },
  { label: "Profile", href: "/profile", icon: "user" },
];
