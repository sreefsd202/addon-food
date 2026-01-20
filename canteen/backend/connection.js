 import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://canteen608:canteen608@cluster0.emtytzf.mongodb.net/canteen?retryWrites=true&w=majority&appName=Cluster0');
    console.log("✅ MongoDB Connected!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};
export default connectDB; 
