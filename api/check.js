// /api/check.js
const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const result = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: email,
              },
            ],
          },
        ],
        properties: ["email"],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const exists = result.data.total > 0;
    res.status(200).json({ exists });
  } catch (error) {
    console.error("HubSpot error:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
};
