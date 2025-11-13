const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const itemId = event.queryStringParameters?.itemId;

  if (!itemId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "itemId required" }),
    };
  }

  const WEBFLOW_TOKEN = process.env.WEBFLOW_API_TOKEN;
  const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

  try {
    // GET: Retrieve current like count
    if (event.httpMethod === "GET") {
      const response = await fetch(
        `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${WEBFLOW_TOKEN}`,
            accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Webflow API error: ${response.status}`);
      }

      const data = await response.json();

      // IMPORTANT: Parse as number, ensure it's a number
      const likesValue = data.fieldData["like-count"];
      const likes =
        typeof likesValue === "number" ? likesValue : parseInt(likesValue) || 0;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          itemId,
          likes: likes,
        }),
      };
    }

    // POST: Increment like count
    if (event.httpMethod === "POST") {
      // First, get current count
      const getResponse = await fetch(
        `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${WEBFLOW_TOKEN}`,
            accept: "application/json",
          },
        }
      );

      if (!getResponse.ok) {
        throw new Error(`Webflow API error: ${getResponse.status}`);
      }

      const currentData = await getResponse.json();

      // CRITICAL FIX: Properly parse current likes as NUMBER
      const currentLikesValue = currentData.fieldData["like-count"];
      const currentLikes =
        typeof currentLikesValue === "number"
          ? currentLikesValue
          : parseInt(currentLikesValue) || 0;

      // Add 1 to the NUMBER
      const newLikes = currentLikes + 1;

      console.log(`Item ${itemId}: ${currentLikes} + 1 = ${newLikes}`); // Debug log

      // Update with new count - send as NUMBER
      const updateResponse = await fetch(
        `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${itemId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${WEBFLOW_TOKEN}`,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            fieldData: {
              "like-count": newLikes, // Send as number, not string
            },
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        throw new Error(
          `Webflow update error: ${updateResponse.status} - ${errorData}`
        );
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          itemId,
          likes: newLikes,
          message: "Like added successfully",
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};
