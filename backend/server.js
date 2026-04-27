const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// 👉 route test (để mở link không bị "Cannot GET /")
app.get("/", (req, res) => {
  res.send("Caro server is running 🚀");
});

const server = http.createServer(app);

// ⚡ SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===== GAME DATA =====
const rooms = {};

function createBoard() {
  return Array(10).fill().map(() => Array(10).fill(""));
}

function checkWin(board, x, y, s) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];

  for (const [dx,dy] of dirs) {
    let count = 1;

    for (let i = 1; i < 5; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (board[nx]?.[ny] === s) count++;
      else break;
    }

    for (let i = 1; i < 5; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (board[nx]?.[ny] === s) count++;
      else break;
    }

    if (count >= 5) return true;
  }

  return false;
}

// ===== SOCKET LOGIC =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        board: createBoard(),
        players: [],
        turn: 0
      };
    }

    const room = rooms[roomId];

    // thêm player nếu chưa đủ 2 người
    if (!room.players.includes(socket.id) && room.players.length < 2) {
      room.players.push(socket.id);
    }

    const playerIndex = room.players.indexOf(socket.id);
    const symbol = playerIndex === 0 ? "X" : "O";

    socket.emit("init", {
      board: room.board,
      symbol,
      turn: room.turn
    });

    io.to(roomId).emit("players", room.players.length);
  });

  socket.on("move", ({ roomId, x, y }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIndex = room.players.indexOf(socket.id);

    // không đúng lượt
    if (playerIndex !== room.turn) return;

    // ô đã đánh
    if (room.board[x][y]) return;

    const symbol = playerIndex === 0 ? "X" : "O";
    room.board[x][y] = symbol;

    // check win
    if (checkWin(room.board, x, y, symbol)) {
      io.to(roomId).emit("win", {
        symbol,
        board: room.board
      });
      delete rooms[roomId];
      return;
    }

    // đổi lượt
    room.turn = 1 - room.turn;

    io.to(roomId).emit("update", {
      board: room.board,
      turn: room.turn
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});