export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface List {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  reminder_enabled: boolean;
  reminder_interval_days: number | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DueReminder {
  id: string;
  title: string;
  description: string | null;
  reminder_interval_days: number;
  last_used_at: string;
  days_since: number;
}

export interface ListItem {
  id: string;
  list_id: string;
  item_id: string;
  position: number;
  created_at: string;
}

export interface ListItemWithDetail extends ListItem {
  item: Item;
}

export interface ListMember {
  list_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
}

export interface ListMemberWithProfile extends ListMember {
  profile: Pick<Profile, 'id' | 'email'>;
}
