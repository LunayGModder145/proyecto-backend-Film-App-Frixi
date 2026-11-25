/**
 * Conexión a MongoDB con Mongoose (películas creadas por el admin).
 *
 * @module config/mongoDB
 */

const mongoose = require("mongoose");
require('dotenv').config();

/**
 * Conecta con MongoDB usando MONGO_URI (si no existe, una base local).
 * Se llama una vez al arrancar el servidor (app.js).
 *
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede conectar.
 */
const connectDB = async () => {
    try {
        await mongoose.connect(
            process.env.MONGO_URI || "mongodb://localhost:27017/local"
        );

        console.log("connection to MongoDB established");

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
};

module.exports = connectDB;