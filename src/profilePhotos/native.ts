import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

export const PROFILE_PHOTO_BUCKET = "profile-photos";
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_EDGE = 1024;

export async function createProfilePhotoSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function pickAndUploadProfilePhoto(path: string) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("photo_permission_denied");
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ["images"],
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_SOURCE_BYTES) throw new Error("source_too_large");

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width >= asset.height && asset.width > MAX_EDGE) context.resize({ width: MAX_EDGE, height: null });
  else if (asset.height > MAX_EDGE) context.resize({ width: null, height: MAX_EDGE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.78, format: SaveFormat.JPEG });
  const bytes = await (await fetch(saved.uri)).arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("processed_too_large");
  const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path, bytes, {
    cacheControl: "0",
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return createProfilePhotoSignedUrl(path);
}
