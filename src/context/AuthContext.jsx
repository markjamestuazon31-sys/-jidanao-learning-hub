import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { getUserProfile, subscribeUserProfile } from "../services/authService";

const AuthContext = createContext(null);

function missingProfileMessage() {
  return "Your Firebase Authentication account exists, but no LMS profile was found in Realtime Database.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUser(null);
      setProfile(null);
      setProfileError("");
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const nextProfile = await getUserProfile(currentUser.uid);
      setProfile(nextProfile);
      setProfileError(nextProfile ? "" : missingProfileMessage());
      return nextProfile;
    } catch (error) {
      console.error("Unable to refresh the LMS user profile:", error);
      setProfileError(error.message || "Unable to read your LMS profile.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!active) return;

        unsubscribeProfile();
        unsubscribeProfile = () => {};
        setUser(currentUser);
        setProfile(null);
        setProfileError("");

        if (!currentUser) {
          setLoading(false);
          return;
        }

        setLoading(true);
        unsubscribeProfile = subscribeUserProfile(
          currentUser.uid,
          (nextProfile) => {
            if (!active) return;
            setProfile(nextProfile);
            setProfileError(nextProfile ? "" : missingProfileMessage());
            setLoading(false);
          },
          (error) => {
            if (!active) return;
            console.error("Realtime LMS profile listener failed:", error);
            setProfile(null);
            setProfileError(error.message || "Unable to read your LMS profile in real time.");
            setLoading(false);
          },
        );
      },
      (error) => {
        if (!active) return;
        console.error("Firebase Authentication listener failed:", error);
        setProfileError(error.message || "Authentication could not be initialized.");
        setLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileError,
      role: profile?.role || null,
      refreshProfile,
    }),
    [user, profile, loading, profileError, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
