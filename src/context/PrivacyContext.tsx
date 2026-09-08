import React, { createContext, useContext, useState, useCallback } from 'react';

const PRIVACY_STORAGE_KEY = 'partly_privacy_hide_supplier_names';

interface PrivacyContextType {
  hideSupplierNames: boolean;
  toggleSupplierNames: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hideSupplierNames, setHideSupplierNames] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
        return stored === 'true';
      }
    } catch {
      // Safely ignore localStorage errors (e.g. security sandbox, private browsing)
    }
    return false;
  });

  const toggleSupplierNames = useCallback(() => {
    setHideSupplierNames((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(PRIVACY_STORAGE_KEY, String(next));
        }
      } catch {
        // Safely ignore storage write errors
      }
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hideSupplierNames, toggleSupplierNames }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    return {
      hideSupplierNames: false,
      toggleSupplierNames: () => {},
    };
  }
  return context;
};
