require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors({ origin: "https://snatchandglow.co.uk" }));
app.use(express.json());


// ✅ UptimeRobot Ping Route
app.get("/check", (req, res) => {
  console.log("🔍 /check pinged for health monitoring");
  res.status(200).send("✅ API is up and responding.");
});

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
  const { email, firstName, lastName, phone, pageUrl } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const result = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [{
          filters: [{ propertyName: "email", operator: "EQ", value: email }]
        }],
        properties: ["email", "purchase_status"]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const exists = result.data.total > 0;

    // 👉 If not exists, create contact
    if (!exists) {
      await axios.post(
        `https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/${email}/`,
        {
          properties: [
            { property: "firstname", value: firstName || "" },
            { property: "lastname", value: lastName || "" },
            { property: "phone", value: phone || "" },
            { property: "landing_page_url", value: pageUrl || "" },
            { property: "purchase_status", value: "prospect" }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      // 🕒 Fallback after 1 hour if not purchased
      setTimeout(async () => {
        try {
          const recheck = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/contacts/search",
            {
              filterGroups: [{
                filters: [{ propertyName: "email", operator: "EQ", value: email }]
              }],
              properties: ["purchase_status"]
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
                "Content-Type": "application/json"
              }
            }
          );

          const currentStatus = recheck.data.results?.[0]?.properties?.purchase_status;
          if (currentStatus !== "purchased") {
            await axios.post(
              `https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/${email}/`,
              {
                properties: [
                  { property: "purchase_status", value: "not_purchased" }
                ]
              },
              {
                headers: {
                  Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
                  "Content-Type": "application/json"
                }
              }
            );
            console.log(`⏳ Auto-set to not_purchased for ${email}`);
          }
        } catch (err) {
          console.error("❌ Error updating to not_purchased:", err.response?.data || err.message);
        }
      }, 60 * 60 * 1000); // 5 mins
    }

    res.json({ exists });
  } catch (err) {
    console.error("❌ HubSpot Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});


// ✅ New route to mark user as purchased
app.post("/purchase", express.json(), async (req, res) => {
  console.log("📦 Shopify Webhook Hit /purchase:", JSON.stringify(req.body, null, 2));

  try {
    const email = req.body?.email || req.body?.customer?.email;

    if (!email) {
      console.warn("⚠️ Missing email in webhook payload.");
      return res.status(400).json({ error: "Missing email" });
    }

    const hubspotRes = await axios.post(
      `https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/${email}/`,
      {
        properties: [
          {
            property: "purchase_status",
            value: "purchased"
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ HubSpot updated for:", email);
    res.status(200).send("✅ Purchase synced to HubSpot.");
  } catch (error) {
    console.error("🔥 /purchase error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to sync purchase status" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
