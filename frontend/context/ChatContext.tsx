import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChatContextType {
  drafts: Record<string, string>;
  setDraft: (roomId: string, draft: string) => void;
  clearDraft: (roomId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const setDraft = useCallback((roomId: string, draft: string) => {
    setDrafts((prev) => ({ ...prev, [roomId]: draft }));
  }, []);

  const clearDraft = useCallback((roomId: string) => {
    setDrafts((prev) => {
      const newDrafts = { ...prev };
      delete newDrafts[roomId];
      return newDrafts;
    });
  }, []);

  return (
    <ChatContext.Provider value={{ drafts, setDraft, clearDraft }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
