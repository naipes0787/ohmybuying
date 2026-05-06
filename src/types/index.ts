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
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
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
