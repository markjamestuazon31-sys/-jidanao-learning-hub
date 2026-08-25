import { ref, update } from "firebase/database";
import { auth, database } from "../firebase/firebaseConfig";

export const PROFILE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const INPUT_LIMIT = 5 * 1024 * 1024;
const DATABASE_IMAGE_LIMIT = 140_000;
const AVATAR_SIZE = 256;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = url;
  });
}

export async function prepareStudentProfilePhoto(file) {
  if (!file) throw new Error("Choose a profile image first.");
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > INPUT_LIMIT) throw new Error("Choose an image smaller than 5 MB.");

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize profile images.");

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/webp", quality);
  while (dataUrlBytes(dataUrl) > DATABASE_IMAGE_LIMIT && quality > 0.42) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/webp", quality);
  }
  const size = dataUrlBytes(dataUrl);
  if (!dataUrl.startsWith("data:image/webp;base64,") || size > DATABASE_IMAGE_LIMIT) {
    throw new Error("The image is still too large after resizing. Choose a simpler or smaller photo.");
  }
  return { dataUrl, mimeType: "image/webp", size, width: AVATAR_SIZE, height: AVATAR_SIZE };
}

function requireOwner(uid) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("You can update only your own profile picture.");
  }
}

export async function uploadStudentProfilePhoto(uid, preparedPhoto) {
  requireOwner(uid);
  const photo = preparedPhoto?.dataUrl
    ? preparedPhoto
    : await prepareStudentProfilePhoto(preparedPhoto);
  const now = Date.now();
  await update(ref(database), {
    [`profilePhotos/${uid}`]: {
      dataUrl: photo.dataUrl,
      mimeType: "image/webp",
      size: photo.size,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      updatedAt: now,
    },
    [`users/${uid}/photoUpdatedAt`]: now,
    [`users/${uid}/updatedAt`]: now,
  });
  return { updatedAt: now };
}

export async function removeStudentProfilePhoto(uid) {
  requireOwner(uid);
  const now = Date.now();
  await update(ref(database), {
    [`profilePhotos/${uid}`]: null,
    [`users/${uid}/photoUpdatedAt`]: now,
    [`users/${uid}/updatedAt`]: now,
  });
}
