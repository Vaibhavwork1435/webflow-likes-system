const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  // Handle preflight
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          itemId,
          likes: data.fieldData["like-count"] || 0,
          name: data.fieldData.name,
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
      const currentLikes = currentData.fieldData["like-count"] || 0;
      const newLikes = currentLikes + 1;

      // Update with new count
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
              "like-count": newLikes,
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
