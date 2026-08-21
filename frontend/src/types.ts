export type RouteKey =
  | 'overview'
  | 'sessions'
  | 'executions'
  | 'reports'
  | 'agents'
  | 'integrations'
  | 'settings';

export interface PageDefinition {
  title: string;
  description: string;
}
