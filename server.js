require('dotenv').config();
const express = require("express");
const path = require("path");
const exphbs = require("express-handlebars");
const bodyparser = require("body-parser");
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const cors = require('cors');

const app = express();

// 미들웨어 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, "public")));

// 뷰 엔진 설정
app.set("views", path.join(__dirname, "/views/"));
app.engine("hbs", exphbs({
  extname: "hbs",
  defaultLayout: "mainLayout",
  layoutsDir: __dirname + "/views/layouts/",
}));
app.set("view engine", "hbs");


require("./models/employee.model");
require("./models/games.model");
// 데이터베이스 연결
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log("MongoDB Connection Succeeded.");
    // 데이터베이스 연결 후 모델 불러오기

  }).catch((err) => {
    console.log("Error in DB connection: " + err);
  });

// 컨트롤러 불러오기 (모델 로드 후)
const employeeController = require("./controllers/employeeController");
const homeController = require("./controllers/homeController");
const loginController = require("./controllers/loginController");

// 라우트 설정
app.use("/employee", employeeController);
app.use("/", homeController);
app.use("/sign", loginController);

// 서버 시작
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Socket.IO 설정
const socketIo = require("socket.io");
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
    methods: ["GET", "POST"]
  }
});

const ioHandler = require('./pages/api/socket');
ioHandler(io);