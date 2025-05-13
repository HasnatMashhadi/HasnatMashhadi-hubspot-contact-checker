require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());

// ✅ Allow CORS only from your live website
app.use(cors({
  origin: "https://snatchandglow.co.uk"
}));

// ✅ Simple GET to verify API is alive
app.get("/", (req, res) => {
  res.send("✅ API is live and connected");
});

// ✅ POST to check contact
app.post("/check", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const result = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [{
          filters: [{ propertyName: "email", operator: "EQ", value: email }]
        }],
        properties: ["email"]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const exists = result.data.total > 0;
    res.json({ exists });

  } catch (err) {
    console.error("❌ HubSpot Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
