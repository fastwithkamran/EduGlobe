import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";
import { type NextRequest, NextResponse } from "next/server";

const MAX_BODY_BYTES = 8 * 1024;
const RESOURCE_TYPES = ["image", "raw", "video"] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

function isResourceType(value: string | undefined): value is ResourceType {
  return RESOURCE_TYPES.some((allowedType) => allowedType === value);
}

function getAdminServices() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials");
  }

  const appName = "cloudinary-delete";
  const app =
    getApps().find((existingApp) => existingApp.name === appName) ??
    initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
      },
      appName,
    );

  return {
    auth: getAuth(app),
    db: getFirestore(
      app,
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ??
        "ai-studio-d22cf13b-5bf4-40cc-b966-42aeb5ff0e24",
    ),
  };
}

function getAssetDetails(assetUrl: string): {
  publicId: string;
  resourceType: ResourceType;
  pathSegments: string[];
} | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  let url: URL;
  try {
    url = new URL(assetUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    url.search ||
    url.hash
  ) {
    return null;
  }

  let segments: string[];
  try {
    segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }

  const [urlCloudName, resourceType, uploadMarker, ...uploadedPath] = segments;
  if (
    urlCloudName !== cloudName ||
    uploadMarker !== "upload" ||
    !isResourceType(resourceType)
  ) {
    return null;
  }

  const versionIndex = uploadedPath.findIndex((segment) =>
    /^v\d+$/.test(segment),
  );
  if (versionIndex < 0 || versionIndex === uploadedPath.length - 1) return null;

  const publicIdSegments = uploadedPath.slice(versionIndex + 1);
  const lastSegment = publicIdSegments.at(-1);
  if (!lastSegment) return null;
  publicIdSegments[publicIdSegments.length - 1] = lastSegment.replace(
    /\.[^.]+$/,
    "",
  );

  const publicId = publicIdSegments.join("/");
  if (
    !publicId ||
    publicId.length > 500 ||
    publicIdSegments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[\\/]/.test(segment),
    )
  ) {
    return null;
  }

  return {
    publicId,
    resourceType,
    pathSegments: publicIdSegments,
  };
}

async function ownsAsset(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  assetUrl: string,
  pathSegments: string[],
): Promise<boolean> {
  const userSnapshot = await db.collection("users").doc(uid).get();
  if (!userSnapshot.exists) return false;

  const user = userSnapshot.data();
  if (!user) return false;

  const isSuperAdmin = user.role === "super_admin";
  const [folder, folderId] = pathSegments;

  if (folder === "avatars") {
    return isSuperAdmin || folderId === uid;
  }

  if (folder === "posts") {
    if (
      !isSuperAdmin &&
      (user.role !== "admin" || (folderId && user.societyId !== folderId))
    ) {
      return false;
    }

    const societyId = folderId ?? user.societyId;
    const postsQuery = societyId
      ? db.collection("posts").where("societyId", "==", societyId)
      : db.collection("posts");
    const postsSnapshot = await postsQuery.get();

    return postsSnapshot.docs.some((post: QueryDocumentSnapshot) =>
      (post.data().attachments ?? []).some(
        (attachment: { fileURL?: unknown }) => attachment.fileURL === assetUrl,
      ),
    );
  }

  if (folder === "societies") {
    const [logoSnapshot, bannerSnapshot] = await Promise.all([
      db
        .collection("societies")
        .where("logoURL", "==", assetUrl)
        .limit(1)
        .get(),
      db
        .collection("societies")
        .where("bannerURL", "==", assetUrl)
        .limit(1)
        .get(),
    ]);
    const society = [...logoSnapshot.docs, ...bannerSnapshot.docs][0];
    if (!society) return false;

    const societyData = society.data();
    return (
      isSuperAdmin ||
      societyData.createdBy === uid ||
      (user.role === "admin" && user.societyId === society.id)
    );
  }

  return false;
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  let rawBody: string;
  try {
    if (!req.body)
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Request body is too large." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let assetUrl: unknown;
  try {
    assetUrl = (JSON.parse(rawBody) as { assetUrl?: unknown }).assetUrl;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof assetUrl !== "string" || !assetUrl.trim()) {
    return NextResponse.json(
      { error: "assetUrl is required." },
      { status: 400 },
    );
  }

  const asset = getAssetDetails(assetUrl);
  if (!asset) {
    return NextResponse.json(
      { error: "Invalid Cloudinary asset URL." },
      { status: 400 },
    );
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error(
      "[cloudinary/delete] Cloudinary credentials are not configured.",
    );
    return NextResponse.json(
      { error: "Asset deletion is unavailable." },
      { status: 503 },
    );
  }

  if (
    !(
      process.env.FIREBASE_PROJECT_ID ??
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ) ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.error(
      "[cloudinary/delete] Firebase Admin credentials are not configured.",
    );
    return NextResponse.json(
      { error: "Asset deletion is unavailable." },
      { status: 503 },
    );
  }

  try {
    const { auth, db } = getAdminServices();
    const decodedToken = await auth.verifyIdToken(token, true);
    if (
      !(await ownsAsset(db, decodedToken.uid, assetUrl, asset.pathSegments))
    ) {
      return NextResponse.json(
        { error: "You are not allowed to delete this asset." },
        { status: 403 },
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const result = await cloudinary.uploader.destroy(asset.publicId, {
      resource_type: asset.resourceType,
      invalidate: true,
    });

    if (result.result === "not found") {
      return NextResponse.json(
        { error: "Cloudinary asset was not found." },
        { status: 404 },
      );
    }
    if (result.result !== "ok") {
      console.error(
        "[cloudinary/delete] Unexpected Cloudinary result:",
        result.result,
      );
      return NextResponse.json(
        { error: "Cloudinary could not delete the asset." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (
      errorCode === "auth/id-token-expired" ||
      errorCode === "auth/argument-error" ||
      errorCode === "auth/invalid-id-token" ||
      errorCode === "auth/revoked-id-token"
    ) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 },
      );
    }

    console.error("[cloudinary/delete] Request failed:", error);
    return NextResponse.json(
      { error: "Asset deletion failed." },
      { status: 502 },
    );
  }
}
