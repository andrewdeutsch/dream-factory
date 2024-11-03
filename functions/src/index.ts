import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch, {Response} from "node-fetch";
import {CallableContext} from "firebase-functions/v1/https";

admin.initializeApp();

interface ImageRequestData {
  imageUrl: string;
}

export const fetchDalleImage = functions.https.onCall(
  async (
    data: ImageRequestData,
    context: CallableContext,
  ): Promise<{imageUrl: string}> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be logged in",
      );
    }

    try {
      const imageUrl = data.imageUrl;
      const userId = context.auth.uid;

      // Fetch the image
      const response: Response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();

      // Upload to Firebase Storage
      const bucket = admin.storage().bucket();
      const filename = `dreams/${userId}/${Date.now()}.png`;
      const file = bucket.file(filename);

      await file.save(Buffer.from(buffer), {
        metadata: {
          contentType: "image/png",
        },
      });

      // Get the public URL
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500", // Far future expiration
      });

      return {imageUrl: url};
    } catch (error) {
      console.error("Error in fetchDalleImage:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to process image",
      );
    }
  },
);
