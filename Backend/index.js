import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { supabase } from "./db.js";
import { sendOTP } from "./emailService.js";
import { getAIQuestion } from "./aiService.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve static files from the 'Frontend' directory at the root level
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static("E:/Mazhar Imam/Official Work/AI and Portal Research/AI Classes by Programming Pathshala/Frontend and Backend Full Stack By Lik/Complaints-Registration-Platform-Full-Stack_By_Likhilesh/Frontend"));

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile("E:/Mazhar Imam/Official Work/AI and Portal Research/AI Classes by Programming Pathshala/Frontend and Backend Full Stack By Lik/Complaints-Registration-Platform-Full-Stack_By_Likhilesh/Frontend/index.html");
});

// --- Middleware ---

const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// --- Auth Routes ---

app.post("/api/auth/send-otp", async (req, res) => {
  const { name, email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

    if (existingUser && existingUser.is_verified) {
      return res.status(400).json({ error: "Email already registered" });
    }

    if (existingUser) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ name, otp, otp_expiry: otpExpiry })
        .eq("email", email);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("users")
        .insert({ name, email, otp, otp_expiry: otpExpiry });
      if (insertError) throw insertError;
    }

    const emailSent = await sendOTP(email, otp);
    if (!emailSent) return res.status(500).json({ error: "Failed to send OTP email" });

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError) throw fetchError;

    const now = Date.now();
    const expiry = new Date(user.otp_expiry).getTime();

    console.log("OTP Verification Logic (UTC):", {
      receivedOtp: otp,
      storedOtp: user.otp,
      now,
      expiry,
      diffMs: expiry - now,
      isMatch: user.otp === otp,
      isExpired: now > expiry
    });

    if (!user || user.otp !== otp || now > expiry) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    res.json({ message: "OTP verified" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { email, otp, password } = req.body;

  try {
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError) throw fetchError;

    if (!user || user.otp !== otp || new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ password, is_verified: true, otp: null, otp_expiry: null })
      .eq("email", email);
    if (updateError) throw updateError;

    res.json({ message: "Registration successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.is_verified || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.cookie("token", token, {
      httpOnly: false,
      secure: false, // Changed for local testing
      sameSite: "lax",
    });

    res.json({ name: user.name, email: user.email, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json(req.user);
});

// --- Complaint Routes ---

app.post("/api/ai/question", authenticate, async (req, res) => {
  const { complaint_text } = req.body;
  if (!complaint_text) return res.status(400).json({ error: "Complaint text is required" });

  const question = await getAIQuestion(complaint_text);
  res.json({ question });
});

app.post("/api/complaints", authenticate, async (req, res) => {
  const { complaint_text, ai_question, user_answer } = req.body;

  try {
    const { data: newComplaint, error: insertError } = await supabase
      .from("complaints")
      .insert({
        user_id: req.user.id,
        complaint_text,
        ai_question,
        user_answer,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.json(newComplaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/complaints/my", authenticate, async (req, res) => {
  try {
    const { data: userComplaints, error: fetchError } = await supabase
      .from("complaints")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;
    res.json(userComplaints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Admin Routes ---

app.get("/api/admin/complaints", authenticate, isAdmin, async (req, res) => {
  try {
    const { data: allComplaints, error: fetchError } = await supabase
      .from("complaints")
      .select(`
        id,
        complaint_text,
        ai_question,
        user_answer,
        created_at,
        users (
          name,
          email
        )
      `)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    // Flattening the user data for compatibility with the frontend
    const formattedComplaints = allComplaints.map(c => ({
      ...c,
      user_name: c.users.name,
      user_email: c.users.email,
    }));

    res.json(formattedComplaints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
