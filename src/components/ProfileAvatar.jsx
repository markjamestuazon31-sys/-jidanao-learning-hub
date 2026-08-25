import { UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../firebase/firebaseConfig";

function initialsFor(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ProfileAvatar({
  uid,
  name,
  photoDataUrl = "",
  size = 40,
  className = "",
  decorative = false,
}) {
  const [remotePhoto, setRemotePhoto] = useState(photoDataUrl);
  const [loading, setLoading] = useState(Boolean(uid) && !photoDataUrl);
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => initialsFor(name), [name]);

  useEffect(() => {
    setFailed(false);
    if (photoDataUrl) {
      setRemotePhoto(photoDataUrl);
      setLoading(false);
      return undefined;
    }
    if (!uid) {
      setRemotePhoto("");
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onValue(
      ref(database, `profilePhotos/${uid}`),
      (snapshot) => {
        setRemotePhoto(snapshot.exists() ? String(snapshot.val()?.dataUrl || "") : "");
        setLoading(false);
      },
      () => {
        setRemotePhoto("");
        setLoading(false);
      },
    );
  }, [photoDataUrl, uid]);

  const style = { "--profile-avatar-size": `${Math.max(28, Number(size) || 40)}px` };
  const label = decorative ? undefined : `${name || "User"} profile photo`;
  const classNames = `profile-avatar ${loading ? "profile-avatar--loading" : ""} ${className}`.trim();

  if (remotePhoto && !failed) {
    return (
      <span className={classNames} style={style} aria-hidden={decorative || undefined}>
        <img src={remotePhoto} alt={label || ""} loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  }

  return (
    <span
      className={`${classNames} profile-avatar--fallback`}
      style={style}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      {initials ? <strong>{initials}</strong> : <UserRound size={Math.max(16, size * 0.48)} />}
    </span>
  );
}
