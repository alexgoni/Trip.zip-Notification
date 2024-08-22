const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const cors = require("cors");
require("dotenv").config();

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(cors());

const db = admin.firestore();

app.post("/subscribe", async (req, res) => {
  const { token, id } = req.body;

  if (!token) {
    return res.status(400).send("Device token is required.");
  }

  try {
    const docRef = db.collection("subscriptions").doc(String(id));
    await docRef.set({
      token: token,
      createdAt: new Date(),
    });
    res.status(200).send("Subscription received and saved");
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).send("Error saving subscription");
  }
});

// FCM 푸시 알림 전송 함수
const sendPushNotification = async (deviceToken, notification) => {
  const message = {
    token: deviceToken,
    data: {
      title: notification.title,
      body: notification.body,
    },
  };

  try {
    const response = await admin.messaging().send(message);
    return response;
  } catch (error) {
    throw error;
  }
};

// 푸시 알림 전송 엔드포인트
app.post("/send-notification", async (req, res) => {
  const { id, title, body } = req.body;

  console.log({ id, title, body });

  if (!id || !title || !body) {
    return res.status(400).send("ID, title, and body are required.");
  }

  try {
    // Firestore에서 해당 ID의 문서 가져오기
    const docRef = db.collection("subscriptions").doc(String(id));
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send("No device token found for this ID.");
    }

    // 문서에서 deviceToken 가져오기
    const deviceToken = doc.data().token;

    const notification = {
      title: title,
      body: body,
    };

    const result = await sendPushNotification(deviceToken, notification);
    res.status(200).send(result);
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).send("Error sending notification");
  }
});
// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
