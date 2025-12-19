import mongoose from "mongoose";

const connectDB = async () => {
	const mongoUri = process.env.MONGO_URI;

	try {
		await mongoose.connect(mongoUri);
		console.log("MongoDB connected");
	} catch (error) {
		console.error("MongoDB connection error", error.message);
		process.exit(1);
	}
};

export default connectDB;
