const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("MongoDB Connection Succeeded.");
}).catch((err) => {
  console.log("Error in DB connection: " + err);
});

// 모델 불러오기
require("./employee.model");
require("./games.model");

module.exports = mongoose;