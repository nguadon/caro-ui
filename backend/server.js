// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// roomId -> game state
const rooms = {};

function createBoard() {
  return Array(10).fill().map(() => Array(10).fill(""));
}

function checkWin(board, x, y, s) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dx,dy] of dirs) {
    let cnt = 1;
    for (let i=1;i<5;i++){
      const nx=x+dx*i, ny=y+dy*i;
      if(board[nx]?.[ny]===s) cnt++; else break;
    }
    for (let i=1;i<5;i++){
      const nx=x-dx*i, ny=y-dy*i;
      if(board[nx]?.[ny]===s) cnt++; else break;
    }
    if (cnt>=5) return true;
  }
  return false;
}

io.on("connection", (socket) => {

  socket.on("join", (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        board: createBoard(),
        players: [],
        turn: 0 // 0: X, 1: O
      };
    }

    const room = rooms[roomId];

    if (!room.players.includes(socket.id) && room.players.length < 2) {
      room.players.push(socket.id);
    }

    const symbol = room.players[0] === socket.id ? "X" : "O";

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

    const idx = room.players.indexOf(socket.id);
    if (idx !== room.turn) return;
    if (room.board[x][y]) return;

    const symbol = idx === 0 ? "X" : "O";
    room.board[x][y] = symbol;

    if (checkWin(room.board, x, y, symbol)) {
      io.to(roomId).emit("win", { symbol, board: room.board });
      delete rooms[roomId];
      return;
    }

    room.turn = 1 - room.turn;

    io.to(roomId).emit("update", {
      board: room.board,
      turn: room.turn
    });
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p !== socket.id);
      if (room.players.length === 0) delete rooms[roomId];
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on 3000");
});