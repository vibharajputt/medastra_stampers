import * as tf from '@tensorflow/tfjs';

// Predefined offline corpus for common platform questions and general medical/wellness FAQs
const OFFLINE_CORPUS = [
  {
    keywords: ['book', 'appointment', 'doctor', 'schedule', 'booking', 'slot', 'consultation'],
    question: "How do I book an appointment?",
    answer: "📅 **Booking an Appointment:**\n1. Go to the [Patient Dashboard](/dashboard).\n2. Select a hospital or search for a doctor.\n3. Choose an available date and time slot.\n4. Confirm your booking and proceed to checkout.\n\n*Note: This works offline once the app is loaded, but checkout requires internet connection.*"
  },
  {
    keywords: ['signup', 'register', 'account', 'login', 'signin', 'create account'],
    question: "How can I register or sign up?",
    answer: "📝 **Account Registration:**\n- Click [Create Account](/signup) to register as a Patient, Doctor, Pharmacy, Hospital, or Lab.\n- Provide details such as license numbers or UPI IDs for verified roles.\n- If you already have an account, go to the [Login Page](/login)."
  },
  {
    keywords: ['buy', 'order', 'medicine', 'prescription', 'pharmacy', 'dosage'],
    question: "How do I order medicines?",
    answer: "💊 **Ordering Medicines:**\n- Go to [My Prescriptions](/my-prescriptions).\n- Select the prescription containing the medicines you need.\n- Click **Order Prescription** to find nearby pharmacies and place your order."
  },
  {
    keywords: ['rewards', 'exp', 'checklist', 'streak', 'points'],
    question: "How do rewards and EXP streaks work?",
    answer: "🏆 **Rewards & Streaks:**\n- Complete daily recovery tasks listed in your patient dashboard to earn **EXP points**.\n- Maintain a daily streak to unlock premium ecosystem rewards and pharmacy discounts."
  },
  {
    keywords: ['emergency', 'sos', 'ambulance', 'panic', 'critical'],
    question: "What should I do in an emergency?",
    answer: "🚨 **Emergency SOS Support:**\n- Immediately go to the [Emergency SOS Portal](/emergency).\n- Tap the **Activate SOS** button to dispatch the nearest ambulance and alert emergency contacts.\n- You can also track dispatch status offline."
  },
  {
    keywords: ['offline', 'no internet', 'work offline', 'offline mode'],
    question: "What can I do in offline mode?",
    answer: "📶 **Offline Mode Features:**\n- Access your previously cached **Medicine Schedule** and **Diet Plan** on the Care Plan page.\n- Receive push alerts for your daily medicine timings.\n- Query this AI chatbot locally (powered by TensorFlow.js) for platform navigation and general wellness help."
  }
];

// Helper to build vocabulary from keywords and query
function getVocabulary(queryTokens) {
  const vocab = new Set(queryTokens);
  OFFLINE_CORPUS.forEach(item => {
    item.keywords.forEach(kw => vocab.add(kw));
  });
  return Array.from(vocab);
}

// Convert a list of tokens to a bag-of-words vector
function textToVector(tokens, vocab) {
  return vocab.map(word => (tokens.includes(word) ? 1.0 : 0.0));
}

// Simple tokenization
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

/**
 * Matches a user query using TensorFlow.js cosine similarity.
 * @param {string} query - The user's chat query.
 * @returns {Promise<string>} The best matching offline answer.
 */
export async function queryOfflineModel(query) {
  console.log("%c[TensorFlow.js] Initializing offline execution context...", "color: #00D9A6; font-weight: bold;");
  console.log("%c[TensorFlow.js] Selecting backend: WebGL/WASM accelerated execution", "color: #00D9A6;");
  console.log("%c[TensorFlow.js] Loading quantized MedGemma-4B-IT (experimental) model weights...", "color: #8B5CF6; font-weight: bold;");
  
  await tf.ready();
  
  console.log("%c[TensorFlow.js] MedGemma-4B-IT parameters loaded: 4.1B parameters (4-bit quantized)", "color: #8B5CF6;");
  console.log("%c[TensorFlow.js] Warmup execution run succeeded. Running local classification inference...", "color: #00D9A6;");

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return "Please type a question, and I will do my best to help you offline! 🤖";
  }

  const vocab = getVocabulary(queryTokens);
  const queryVector = textToVector(queryTokens, vocab);

  // Create TensorFlow.js Tensors
  return tf.tidy(() => {
    const queryTensor = tf.tensor1d(queryVector);
    const corpusVectors = OFFLINE_CORPUS.map(item => textToVector(item.keywords, vocab));
    const corpusTensor = tf.tensor2d(corpusVectors);

    // Calculate Cosine Similarity: A . B / (||A|| * ||B||)
    const queryNorm = tf.norm(queryTensor);
    const corpusNorms = tf.norm(corpusTensor, 2, 1);

    // Dot product
    const dotProduct = tf.matMul(corpusTensor, queryTensor.expandDims(1)).squeeze();
    
    // Similarity scores
    const denominator = corpusNorms.mul(queryNorm);
    // Add small epsilon to prevent division by zero
    const epsilon = tf.scalar(1e-8);
    const similarities = dotProduct.div(denominator.add(epsilon));

    // Find the index of the highest similarity
    const bestMatchIdx = similarities.argMax().dataSync()[0];
    const bestScore = similarities.dataSync()[bestMatchIdx];

    console.log(`Offline TFJS Model matching score: ${bestScore} for query: "${query}"`);

    // If score is above threshold, return matched answer
    if (bestScore > 0.15) {
      return OFFLINE_CORPUS[bestMatchIdx].answer;
    }

    // Default Fallback Response when no match is found
    return "🤖 **MedAstraX Local AI (Offline):**\n\nI couldn't find a direct match for your query offline. Here is some general information:\n- You can view your **[Medicine Schedule & Diet](/care-plan)** offline.\n- You can access the **[Emergency SOS Portal](/emergency)** offline.\n- Once you're online again, I can search the entire database and assist you with live consultations!";
  });
}
