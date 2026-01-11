const express = require("express");
const mongoose = require("mongoose");
const { type } = require("node:os");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pino = require("pino");
require("dotenv").config();


const app = express();
const logger = pino({
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: { colorize: true }
      },
    ]
  }
});

module.exports = logger;

app.use(express.json());

// 🔗 MongoDB connection
mongoose.connect(
  process.env.MONGO_URI,
)
.then(() => logger.info("MongoDB connected"))
.catch(err => logger.error(err, "MongoDB connection failed"));


const userSchema = new mongoose.Schema({
  name:{
    type: String
  },
  email:{
    type: String,
    required: true,
    unique: true
  },
  password:{
    type:String,
    required: true
  },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    }
});

const User = mongoose.model("User", userSchema);

// Auth Middleware
const auth = (req,res,next)=>{
  const header = req.headers.authorization;
  if(!header){
    return res.status(401).json({message: "Token is missed"})
  }

  const token =  header.split(" ")[1];

  try{
    const decode = jwt.verify(token,process.env.JWT_SECRET)
    req.user = decode;
    next();
  }
  catch(err){
    next(err)
  }
};

app.post("/register", async (req,res)=>{
try{
  const {name,email,password,role} = req.body;
  const hasedPassword = await bcrypt.hash(password,10);
  const user = await User.create({name, email, password: hasedPassword,role});
  res.status(200).json({ message:"User Created Successfully"})

}
catch(err){
  logger.error(err, "Register failed");
  res.status(404).json({ message: err.message})
}    
});

// Role Middleware
const isAdmin = (req,res,next)=>{
  const admin = req.header.role;
  if(!admin){
    return res.status(403).json({ message: "Your Role Admin only" });
  }
};

app.post("/login", async (req,res)=>{

  try{
    const {email,password} = req.body;
    const user = await User.findOne({email});
    if(!user){
      logger.warn({ email }, "Invalid login attempt");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password,user.password);
    if (!isMatch) {
      logger.warn({ email }, "Wrong password");
    return res.status(401).json({ message: "Invalid credentials" });
  }

   // create token
  const token = jwt.sign(
    { userId: user._id },     // payload
    process.env.JWT_SECRET,          // secret
    { expiresIn: "1h" }       // expiry
  )

  res.json({
    message: "Login successful",
    token,
  });
  logger.info({ userId: user._id }, "User logged in");
  }

  catch(err){
    res.status(400).json({message: err.message});
  }
});

// Protected route

app.get("/profile", auth, async (req,res) =>{
const user = await User.findById(req.user.userId).select("-password");
logger.info({ userId: req.user.userId }, "Profile accessed");
res.status(200).json({ data: user });
});

app.get("/admin",auth,isAdmin, (req,res) =>{
  res.status(200).json({message: "Welcome Admin"});
});

const PORT = process.env.PORT;
app.listen(3000, () => {
  console.log("Server running on port "+ PORT);
});
