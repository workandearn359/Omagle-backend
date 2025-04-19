const waitingUsers = [];

function findMatch(socket, mood, interests) {
  const matchIndex = waitingUsers.findIndex(user =>
    user.id !== socket.id &&
    user.mood === mood &&
    user.interests.some(tag => interests.includes(tag))
  );

  if (matchIndex !== -1) {
    const match = waitingUsers.splice(matchIndex, 1)[0];
    return match;
  } else {
    waitingUsers.push({ id: socket.id, mood, interests });
    return null;
  }
}

function removeFromQueue(socketId) {
  const index = waitingUsers.findIndex(user => user.id === socketId);
  if (index !== -1) waitingUsers.splice(index, 1);
}

module.exports = { findMatch, removeFromQueue };
