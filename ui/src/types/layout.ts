export interface SidebarItem {
  key:       string;
  label:     string;
  to:        string;
  /* The icon name from primevue (e.g. `pi-home`, `pi-bars`) */
  icon?:     string;
  /* Optional badge count to display (e.g., pending queue count) */
  badge?:    number | string;
  /* Optional children items */
  children?: SidebarItem[];
}
