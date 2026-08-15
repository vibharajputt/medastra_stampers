// Client-side lightweight NLP classifier using TensorFlow.js for offline fallback

const VOCAB = [
  "book", "appointment", "doctor", "schedule", "physician", "visit", "booking", "slot", "hospital",
  "signup", "register", "account", "join", "create", "user", "profile", "password",
  "medicine", "prescription", "rx", "pill", "medication", "care", "plan", "diet", "nutrition",
  "healthy", "fit", "wellness", "exercise", "walk", "health", "tips",
  "rewards", "points", "coins", "medcoins", "earn", "discount", "redeem",
  "help", "support", "contact", "faq", "question", "issue", "chat"
];

const TRAINING_DATA = [
  // Booking
  { text: "book a doctor appointment", label: 0 },
  { text: "how to schedule a physician visit", label: 0 },
  { text: "i want to book an appointment with a hospital", label: 0 },
  { text: "make doctor booking slot", label: 0 },
  { text: "appointment booking schedules", label: 0 },

  // Signup
  { text: "how to sign up create account", label: 1 },
  { text: "register new patient profile", label: 1 },
  { text: "join medastrax platform register account", label: 1 },
  { text: "set password and sign up user", label: 1 },

  // Medicines
  { text: "view my medicines active prescriptions", label: 2 },
  { text: "show my rx pill care plan schedule", label: 2 },
  { text: "my medication list active prescriptions history", label: 2 },
  { text: "medication care plan prescription order online", label: 2 },

  // Wellness
  { text: "healthy living fit diet guidelines tips", label: 3 },
  { text: "exercise tips workout wellness advice walk", label: 3 },
  { text: "how to stay fit health tips nutrition routine", label: 3 },
  { text: "diet and exercise plan wellness guidelines", label: 3 },

  // Rewards
  { text: "earn rewards and health coins medcoins", label: 4 },
  { text: "how to get points discount redeem", label: 4 },
  { text: "earn discount coins reward program", label: 4 },

  // Help
  { text: "help support contact faq customer care", label: 5 },
  { text: "frequently asked questions support issue chat", label: 5 },
  { text: "contact support team help center pages", label: 5 }
];

const RESPONSES = {
  0: `### 🗓️ Booking an Appointment (Offline Mode)
To book an appointment, go to the [Patient Dashboard](/dashboard) and select your preferred hospital. You will be able to:
- Choose from available doctors.
- Check their specialities and ratings.
- Select a convenient time slot.
- Confirm your booking instantly.

*Note: Your booking will sync with the database once you are back online.*`,

  1: `### 🔐 Registering an Account (Offline Mode)
Setting up your account is easy:
1. Click [Sign Up](/signup) in the top-right corner.
2. Choose your profile role: **Patient**, **Doctor**, **Pharmacy**, **Lab**, or **Hospital**.
3. Complete the registration form and secure password.
4. Verify the security captcha to finish.`,

  2: `### 💊 Medicines & Prescriptions (Offline Mode)
Here is how you can manage your health schedule:
- View your medications and reminders on the [Care Plan](/care-plan) page.
- Review your full medical diagnosis history in [My Prescriptions](/my-prescriptions).
- Order prescription refills directly for delivery.
- View detailed usage guides by clicking **"Ask AI"** next to any medicine.`,

  3: `### 🏃 Diet & Wellness Tips (Offline Mode)
Stay healthy with our core wellness guidelines:
- **Nutrition**: Focus on seasonal fruits, vegetables, lentils, lean proteins, and stay hydrated (8-10 glasses of water).
- **Physical Activity**: Aim for a daily walk or light stretching. Get at least 150 minutes of moderate exercise per week.
- **Recovery**: Rest is vital. Get 7-8 hours of sleep and use the stress relief practices under [Care Plan](/care-plan).`,

  4: `### 🪙 Gamification & Rewards (Offline Mode)
MedAstraX awards **MedCoins** for healthy habits:
- **Earn**: Complete doctor consultations, order medications, book diagnostic packages, or record health milestones.
- **Redeem**: Redeem accumulated coins for direct discounts on your future pharmacy checkout orders.
- Check your rewards balance on the dashboard.`,

  5: `### ℹ️ Help & Support FAQs (Offline Mode)
Need assistance? Since you are currently offline, here are quick references:
- **FAQs**: Find basic platform questions in the [FAQ](/faq).
- **Help Center**: Visit the [Help Center](/help) for guides.
- **Contact**: Reach our team by filing a ticket on the [Support Page](/support) or the [Contact Us](/contact) form.`,

  fallback: `### 🤖 MedAstraX Offline Assistant
I see you are currently offline. I can assist you with common platform topics:
- **Booking** (e.g., "How to book an appointment")
- **Sign Up** (e.g., "How to register an account")
- **Medicines & Care** (e.g., "Check my prescriptions")
- **Wellness** (e.g., "Diet and exercise guidelines")
- **Rewards** (e.g., "How do I earn MedCoins?")
- **Support** (e.g., "Contact customer support")

Please ask a query related to these topics, or check back online for full AI assistance!`
};

let trainedModel = null;
let trainingPromise = null;

function textToBow(text) {
  const tokens = text.toLowerCase().split(/\W+/);
  const bow = new Array(VOCAB.length).fill(0);
  tokens.forEach(token => {
    const idx = VOCAB.indexOf(token);
    if (idx !== -1) {
      bow[idx] = 1;
    }
  });
  return bow;
}

async function trainModel() {
  const tf = window.tf;
  if (!tf) {
    console.warn("TensorFlow.js not available in window context.");
    return null;
  }

  try {
    // 1. Prepare data
    const xsData = TRAINING_DATA.map(item => textToBow(item.text));
    const ysData = TRAINING_DATA.map(item => {
      const arr = new Array(6).fill(0);
      arr[item.label] = 1;
      return arr;
    });

    const xs = tf.tensor2d(xsData);
    const ys = tf.tensor2d(ysData);

    // 2. Build model
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [VOCAB.length],
      units: 12,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 6,
      activation: 'softmax'
    }));

    model.compile({
      optimizer: tf.train.adam(0.05),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // 3. Train
    await model.fit(xs, ys, {
      epochs: 35,
      shuffle: true,
      verbose: 0
    });

    // Clean tensors
    xs.dispose();
    ys.dispose();

    trainedModel = model;
    console.log("Offline TensorFlow.js NLP classifier trained successfully.");
    return model;
  } catch (err) {
    console.error("Error training offline AI classifier:", err);
    return null;
  }
}

export async function getOfflineAiResponse(query) {
  const tf = window.tf;
  if (!tf) {
    console.warn("TensorFlow.js not loaded. Returning offline fallback response.");
    return RESPONSES.fallback;
  }

  try {
    if (!trainedModel) {
      if (!trainingPromise) {
        trainingPromise = trainModel();
      }
      await trainingPromise;
    }

    if (!trainedModel) {
      return RESPONSES.fallback;
    }

    const bow = textToBow(query);
    const wordCount = bow.reduce((a, b) => a + b, 0);
    if (wordCount === 0) {
      return RESPONSES.fallback;
    }

    const inputTensor = tf.tensor2d([bow]);
    const prediction = trainedModel.predict(inputTensor);
    const probs = await prediction.data();
    inputTensor.dispose();
    prediction.dispose();

    let maxIdx = 0;
    let maxVal = 0;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > maxVal) {
        maxVal = probs[i];
        maxIdx = i;
      }
    }

    if (maxVal >= 0.35) {
      return RESPONSES[maxIdx] || RESPONSES.fallback;
    } else {
      return RESPONSES.fallback;
    }
  } catch (err) {
    console.error("Offline AI prediction failed:", err);
    return RESPONSES.fallback;
  }
}
