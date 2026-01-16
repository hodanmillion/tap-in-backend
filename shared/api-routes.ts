export const API_ROUTES = {
  AUTH: {
    SIGNUP: '/auth/signup',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
  },
  PROFILES: {
    LIST: '/profiles',
    BY_ID: (id: string) => `/profiles/${id}`,
    UPDATE: (id: string) => `/profiles/${id}`,
    NEARBY: '/profiles/nearby',
  },
  ROOMS: {
    LIST: '/rooms',
    BY_ID: (id: string) => `/rooms/${id}`,
    NEARBY: '/rooms/nearby',
    PRIVATE: '/rooms/private',
    MESSAGES: (roomId: string) => `/rooms/${roomId}/messages`,
    PARTICIPANTS: (roomId: string) => `/rooms/${roomId}/participants`,
  },
  MESSAGES: {
    BY_ROOM: (roomId: string) => `/messages/${roomId}`,
    SEND: (roomId: string) => `/rooms/${roomId}/messages`,
  },
  FRIENDS: {
    LIST: '/friends',
    REQUEST: '/friends/request',
    ACCEPT: '/friends/accept',
    REJECT: '/friends/reject',
  },
  POSTS: {
    LIST: '/posts',
    BY_ID: (id: string) => `/posts/${id}`,
    CREATE: '/posts',
    LIKE: (id: string) => `/posts/${id}/like`,
    COMMENTS: (id: string) => `/posts/${id}/comments`,
  },
  EVENTS: {
    LIST: '/events',
    BY_ID: (id: string) => `/events/${id}`,
    CREATE: '/events',
    JOIN: (id: string) => `/events/${id}/join`,
    LEAVE: (id: string) => `/events/${id}/leave`,
  },
} as const;

export type ApiRoutes = typeof API_ROUTES;
