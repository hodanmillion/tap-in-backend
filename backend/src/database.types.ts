export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          latitude: number | null;
          longitude: number | null;
          location: unknown | null;
          last_seen: string | null;
          bio: string | null;
          website: string | null;
          location_name: string | null;
          occupation: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location?: unknown | null;
          last_seen?: string | null;
          bio?: string | null;
          website?: string | null;
          location_name?: string | null;
          occupation?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location?: unknown | null;
          last_seen?: string | null;
          bio?: string | null;
          website?: string | null;
          location_name?: string | null;
          occupation?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          room_id: string | null;
          sender_id: string | null;
          content: string | null;
          type: string | null;
          created_at: string | null;
          client_msg_id: string | null;
        };
        Insert: {
          id?: string;
          room_id?: string | null;
          sender_id?: string | null;
          content?: string | null;
          type?: string | null;
          created_at?: string | null;
          client_msg_id?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string | null;
          sender_id?: string | null;
          content?: string | null;
          type?: string | null;
          created_at?: string | null;
          client_msg_id?: string | null;
        };
        Relationships: [];
      };
      chat_rooms: {
        Row: {
          id: string;
          name: string | null;
          type: string | null;
          latitude: number | null;
          longitude: number | null;
          radius: number | null;
          created_at: string | null;
          expires_at: string | null;
          location: unknown | null;
        };
        Insert: {
          id?: string;
          name?: string | null;
          type?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          radius?: number | null;
          created_at?: string | null;
          expires_at?: string | null;
          location?: unknown | null;
        };
        Update: {
          id?: string;
          name?: string | null;
          type?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          radius?: number | null;
          created_at?: string | null;
          expires_at?: string | null;
          location?: unknown | null;
        };
        Relationships: [];
      };
      room_participants: {
        Row: {
          id: string;
          room_id: string | null;
          user_id: string | null;
          joined_at: string | null;
        };
        Insert: {
          id?: string;
          room_id?: string | null;
          user_id?: string | null;
          joined_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string | null;
          user_id?: string | null;
          joined_at?: string | null;
        };
        Relationships: [];
      };
      friend_requests: {
        Row: {
          id: string;
          sender_id: string | null;
          receiver_id: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id?: string | null;
          receiver_id?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string | null;
          receiver_id?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      friends: {
        Row: {
          id: string;
          user_id_1: string | null;
          user_id_2: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id_1?: string | null;
          user_id_2?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id_1?: string | null;
          user_id_2?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
        notifications: {
          Row: {
            id: string;
            user_id: string;
            type: string;
            title: string;
            content: string;
            data: Json | null;
            is_read: boolean | null;
            created_at: string | null;
          };
          Insert: {
            id?: string;
            user_id: string;
            type: string;
            title: string;
            content: string;
            data?: Json | null;
            is_read?: boolean | null;
            created_at?: string | null;
          };
          Update: {
            id?: string;
            user_id?: string;
            type?: string;
            title?: string;
            content?: string;
            data?: Json | null;
            is_read?: boolean | null;
            created_at?: string | null;
          };
          Relationships: [];
        };
          tapins: {
            Row: {
              id: string;
              sender_id: string;
              receiver_id: string;
              image_url: string;
              caption: string | null;
              viewed_at: string | null;
              created_at: string | null;
              expires_at: string | null;
            };
            Insert: {
              id?: string;
              sender_id: string;
              receiver_id: string;
              image_url: string;
              caption?: string | null;
              viewed_at?: string | null;
              created_at?: string | null;
              expires_at?: string | null;
            };
            Update: {
              id?: string;
              sender_id?: string;
              receiver_id?: string;
              image_url?: string;
              caption?: string | null;
              viewed_at?: string | null;
              created_at?: string | null;
              expires_at?: string | null;
            };
            Relationships: [];
          };
      };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cleanup_expired_rooms: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      find_nearby_rooms: {
        Args: {
          lat: number;
          lng: number;
          max_dist_meters: number;
        };
        Returns: {
          id: string;
          name: string | null;
          type: string | null;
          latitude: number | null;
          longitude: number | null;
          radius: number | null;
          created_at: string | null;
          expires_at: string | null;
          location: unknown | null;
          distance: number;
        }[];
      };
      find_nearby_users: {
        Args: {
          lat: number;
          lng: number;
          max_dist_meters: number;
        };
        Returns: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          latitude: number | null;
          longitude: number | null;
          location: unknown | null;
          last_seen: string | null;
          bio: string | null;
          website: string | null;
          location_name: string | null;
          occupation: string | null;
          created_at: string;
          distance: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
