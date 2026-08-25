import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SCHOOL_STRUCTURE, normalizeSchoolStructure } from "../data/schoolClasses";
import { subscribeSchoolStructure } from "../services/schoolStructureService";

const SchoolStructureContext = createContext(null);

export function SchoolStructureProvider({ children }) {
  const [structure, setStructure] = useState(() => normalizeSchoolStructure(DEFAULT_SCHOOL_STRUCTURE));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeSchoolStructure(
    (nextStructure) => {
      setStructure(nextStructure);
      setError("");
      setLoading(false);
    },
    (loadError) => {
      console.warn("Unable to load the administrator-managed school structure:", loadError);
      setError(loadError.message || "Unable to load the configured grades and sections.");
      setLoading(false);
    },
  ), []);

  const value = useMemo(() => ({ structure, loading, error }), [error, loading, structure]);
  return <SchoolStructureContext.Provider value={value}>{children}</SchoolStructureContext.Provider>;
}

export function useSchoolStructure() {
  const context = useContext(SchoolStructureContext);
  if (!context) throw new Error("useSchoolStructure must be used inside SchoolStructureProvider.");
  return context;
}
