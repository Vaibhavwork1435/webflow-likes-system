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

  // ✅ FIX: Get itemId from query string (GET) OR body (POST)
  let itemId;

  if (event.httpMethod === "GET") {
    itemId = event.queryStringParameters?.itemId;
  } else if (event.httpMethod === "POST") {
    // Parse the POST body to get itemId
    try {
      const body = JSON.parse(event.body);
      itemId = body.itemId;
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }
  }

  // Validate itemId exists
  if (!itemId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "itemId is required" }),
    };
  }

  const WEBFLOW_TOKEN = process.env.WEBFLOW_API_TOKEN;
  const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

  console.log("Processing request for itemId:", itemId);

  try {
    // GET: Retrieve current like count
    if (event.httpMethod === "GET") {
      console.log("GET request - fetching current likes");

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
        const errorText = await response.text();
        console.error("Webflow GET error:", response.status, errorText);
        throw new Error(`Webflow API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Webflow item data:", JSON.stringify(data.fieldData));

      // Get like count from the field "template-like-count"
      let likesValue = data.fieldData["template-like-count"];
      console.log(
        "Raw template-like-count value:",
        likesValue,
        "Type:",
        typeof likesValue
      );

      // Convert to number properly
      let likes = 0;
      if (typeof likesValue === "number") {
        likes = likesValue;
      } else if (typeof likesValue === "string") {
        likes = parseInt(likesValue, 10);
      }

      // If NaN or undefined, default to 0
      if (isNaN(likes)) {
        likes = 0;
      }

      console.log("Parsed likes:", likes);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          itemId: itemId,
          likes: likes,
          success: true,
        }),
      };
    }

    // POST: Increment like count
    if (event.httpMethod === "POST") {
      console.log("POST request - incrementing likes");

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
        const errorText = await getResponse.text();
        console.error("Webflow GET error:", getResponse.status, errorText);
        throw new Error(`Webflow API error: ${getResponse.status}`);
      }

      const currentData = await getResponse.json();
      console.log("Current item data:", JSON.stringify(currentData.fieldData));

      // Get current likes from "template-like-count" field
      let currentLikesValue = currentData.fieldData["template-like-count"];
      console.log(
        "Current template-like-count:",
        currentLikesValue,
        "Type:",
        typeof currentLikesValue
      );

      // CRITICAL: Convert to number to prevent string concatenation
      let currentLikes = 0;
      if (typeof currentLikesValue === "number") {
        currentLikes = currentLikesValue;
      } else if (typeof currentLikesValue === "string") {
        currentLikes = parseInt(currentLikesValue, 10);
      }

      if (isNaN(currentLikes)) {
        currentLikes = 0;
      }

      // Increment by 1 (as a number, NOT string concatenation)
      const newLikes = currentLikes + 1;
      console.log(`Incrementing: ${currentLikes} + 1 = ${newLikes}`);

      // Update in Webflow - send as NUMBER
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
              "template-like-count": newLikes, // Field name matches Webflow CMS
            },
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(
          "Webflow UPDATE error:",
          updateResponse.status,
          errorText
        );
        throw new Error(
          `Webflow update error: ${updateResponse.status} - ${errorText}`
        );
      }

      const updatedData = await updateResponse.json();
      console.log(
        "Updated successfully:",
        JSON.stringify(updatedData.fieldData)
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          itemId: itemId,
          likes: newLikes,
          success: true,
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
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
        success: false,
      }),
    };
  }
};
