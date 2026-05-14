import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

export const getAIQuestion = async (complaintText) => {
  const prompt = `The following is a complaint submitted by a user: "${complaintText}". 
  Based on this complaint, please generate exactly one short follow-up question to gather more details or clarify the situation. 
  Return only the question text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating AI question:", error);
    return "Could you provide more details about the incident?"; // Fallback question
  }
};
