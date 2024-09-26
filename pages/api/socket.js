const { Server } = require('socket.io');
const { getCurrDateTime } = require('../../utils/dateTime');

let _userConnections = [];

const ioHandler = (io) => {
  console.log('*First use, starting socket.io');

  io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on("userconnect", (data) => {
      console.log("userconnect", data.dsiplayName, data.meetingid);

      const other_users = _userConnections.filter(p => p.meeting_id === data.meetingid);

      _userConnections.push({
        connectionId: socket.id,
        user_id: data.dsiplayName,
        meeting_id: data.meetingid,
      });

      const userCount = _userConnections.length;
      other_users.forEach((v) => {
        socket.to(v.connectionId).emit("informAboutNewConnection", {
          other_user_id: data.dsiplayName,
          connId: socket.id,
          userNumber: userCount,
        });
      });

        socket.emit("userconnected", other_users);
      });

      socket.on("exchangeSDP", (data) => {
        socket.to(data.to_connid).emit("exchangeSDP", {
          message: data.message,
          from_connid: socket.id,
        });
      });

      socket.on("reset", () => {
        const userObj = _userConnections.find(p => p.connectionId === socket.id);
        if (userObj) {
          const { meeting_id } = userObj;
          const list = _userConnections.filter(p => p.meeting_id === meeting_id);
          _userConnections = _userConnections.filter(p => p.meeting_id !== meeting_id);

          list.forEach((v) => {
            socket.to(v.connectionId).emit("reset");
          });

          socket.emit("reset");
        }
      });

      socket.on("sendMessage", (msg) => {
        const userObj = _userConnections.find(p => p.connectionId === socket.id);
        if (userObj) {
          const { meeting_id, user_id } = userObj;
          const list = _userConnections.filter(p => p.meeting_id === meeting_id);

          const messageData = {
            from: user_id,
            message: msg,
            time: getCurrDateTime(),
          };

          list.forEach((v) => {
            socket.to(v.connectionId).emit("showChatMessage", messageData);
          });

          socket.emit("showChatMessage", messageData);
        }
      });

      socket.on("fileTransferToOther", (msg) => {
        const userObj = _userConnections.find(p => p.connectionId === socket.id);
        if (userObj) {
          const { meeting_id } = userObj;
          const list = _userConnections.filter(p => p.meeting_id === meeting_id);

          list.forEach((v) => {
            socket.to(v.connectionId).emit("showFileMessage", {
              ...msg,
              time: getCurrDateTime(),
            });
          });
        }
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
        const userObj = _userConnections.find(p => p.connectionId === socket.id);
        if (userObj) {
          const { meeting_id } = userObj;
          _userConnections = _userConnections.filter(p => p.connectionId !== socket.id);
          const list = _userConnections.filter(p => p.meeting_id === meeting_id);

          list.forEach((v) => {
            socket.to(v.connectionId).emit("informAboutConnectionEnd", {
              connId: socket.id,
              userCount: _userConnections.length,
            });
          });
        }
      });
    });

    // res.socket.server.io = io;
  }
//   res.end();


// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

module.exports = ioHandler;