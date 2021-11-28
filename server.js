import express from 'express'
import http from 'http'
import socketio from 'socket.io'

const app = express()
const server = http.createServer(app)
const sockets = socketio(server)

app.use(express.static('public'))

const canvas = {
    width: 600,
    height: 600
}
const pixelSize = 20

sockets.on('connection', socket => {
    console.log(`> Client connected ${socket.id}`)
    socket.on('disconnect', () => {
        console.log(`> Client disconnected ${socket.id}`)
        game.removePlayer(socket.id)
        updateClients()
        sockets.sockets.emit('scores', getScores())
    })
    game.addPlayer({
        id: socket.id,
        x: Math.floor(Math.random() * canvas.width / pixelSize),
        y: Math.floor(Math.random() * canvas.height / pixelSize),
        tail: [],
        score: 0,
        username: socket.id,
        color: 'black'
    })

    socket.emit('setup', game.state)
    sockets.sockets.emit('scores', getScores())
    updateClients()
    socket.on('move', direction => {
        game.movePlayer(socket.id, direction)
        updateClients()
    })
    socket.on('play', e => {
        game.state.players[socket.id].username = e.username
        game.state.players[socket.id].color = e.color

        const curPlayer = game.state.players[socket.id]
        if (curPlayer.color == 'red') {
            curPlayer.tailColor = '#960000'
        } else if (curPlayer.color == 'green') {
            curPlayer.tailColor = '#009600'
        } else if (curPlayer.color == 'blue') {
            curPlayer.tailColor = '#000096'
        } else if (curPlayer.color == 'yellow') {
            curPlayer.tailColor = '#969600'
        } else if (curPlayer.color == 'purple') {
            curPlayer.tailColor = '#640096'
        } else {
            curPlayer.tailColor = '#646464'
        }

        updateClients()
        sockets.sockets.emit('scores', getScores())
    })
})

function updateClients() {
    sockets.sockets.emit('update', game.state)
}

server.listen(process.env.PORT || 3000, () => {
    console.log(`> Server listening on port ${process.env.PORT}`)
    console.log(`> http://localhost:${process.env.PORT}`)
})

function getScores() {
    const scores = []
    for (const playerId in game.state.players) {
        scores.push({
            id: playerId,
            score: game.state.players[playerId].score,
            username: game.state.players[playerId].username
        })
    }
    return scores
}


function createGame() {
    const state = {
        players: {},
        fruits: {},
    }

    function addFruit({
        x,
        y
    }) {
        if (canFruitSpawn(x, y)) {
            state.fruits[`x${x}y${y}`] = {
                x,
                y
            }
        } else {
            addFruit({
                x: Math.floor(Math.random() * canvas.width / pixelSize),
                y: Math.floor(Math.random() * canvas.height / pixelSize)
            })
        }
    }

    function canPlayerSpawn(x, y) {
        for (const playerId in state.players) {
            const player = state.players[playerId]
            if (player.x == x && player.y == y) {
                return false
            }
            for (const tailIndex in player.tail) {
                const tail = player.tail[tailIndex]
                if (tail.x === x && tail.y === y) {
                    return false
                }
            }
        }
        return true && !state.fruits[`x${x}y${y}`]
    }

    function canFruitSpawn(x, y) {
        for (const playerId in state.players) {
            const player = state.players[playerId]
            for (const tailIndex in player.tail) {
                const tail = player.tail[tailIndex]
                if (tail.x === x && tail.y === y) {
                    return false
                }
            }
        }
        return !state.fruits[`x${x}y${y}`]
    }

    function removeFruit({
        x,
        y
    }) {
        delete state.fruits[`x${x}y${y}`]
    }

    function addPlayer(newPlayer) {
        if (canPlayerSpawn(newPlayer.x, newPlayer.y)) {
            state.players[newPlayer.id] = newPlayer
            state.players[newPlayer.id].wait = false
        } else {
            newPlayer.x = Math.floor(Math.random() * canvas.width / pixelSize)
            newPlayer.y = Math.floor(Math.random() * canvas.height / pixelSize)
            addPlayer(newPlayer)
        }
    }

    function removePlayer(id) {
        delete state.players[id]
    }

    function movePlayer(id, direction) {
        const player = id
        const players = state.players
        const moves = {
            arrowup: () => {
                players[player].y--
                if (players[player].y < 0) players[player].y = Math.floor(canvas.height / pixelSize - 1)
            },
            arrowdown: () => {
                players[player].y++
                if (players[player].y > Math.floor(canvas.height / pixelSize - 1)) players[player].y = 0
            },
            arrowleft: () => {
                players[player].x--
                if (players[player].x < 0) players[player].x = Math.floor(canvas.width / pixelSize - 1)
            },
            arrowright: () => {
                players[player].x++
                if (players[player].x > Math.floor(canvas.width / pixelSize - 1)) players[player].x = 0
            }
        }
        moves.w = moves.arrowup
        moves.a = moves.arrowleft
        moves.s = moves.arrowdown
        moves.d = moves.arrowright

        if (moves[direction.toLowerCase()]) {
            players[player].tail.push({
                x: players[player].x,
                y: players[player].y,
            })

            moves[direction.toLowerCase()]()

            if (players[player].wait) {
                players[player].wait = false
            } else {
                players[player].tail.shift()
            }

            checkCollision(player)
        }
    }



    function checkCollision(testingPlayer) {
        const players = state.players
        const fruits = state.fruits

        for (const fruitId in fruits) {
            const fruit = fruits[fruitId]

            if (players[testingPlayer].x === fruit.x && players[testingPlayer].y === fruit.y) {
                players[testingPlayer].wait = true
                players[testingPlayer].score++
                removeFruit(fruit)
                addFruit({
                    x: Math.floor(Math.random() * canvas.width / pixelSize),
                    y: Math.floor(Math.random() * canvas.height / pixelSize)
                })
                sockets.sockets.emit('scores', getScores())
            }
        }

        for (const p in players) {
            for (const playerId in players) {
                for (const tailIndex in players[playerId].tail) {
                    try {
                        const tail = players[playerId].tail[tailIndex]
                        if (players[testingPlayer].x === tail.x && players[testingPlayer].y === tail.y) {
                            removePlayer(testingPlayer)
                            sockets.to(testingPlayer).emit('gameover')
                            sockets.sockets.emit('scores', getScores())
                        }
                    } catch (e) {}
                }
            }
        }

    }

    return {
        state,
        addPlayer,
        removePlayer,
        addFruit,
        removeFruit,
        movePlayer
    }
}

let game

function start() {
    game = createGame()
    game.addFruit({
        x: Math.floor(Math.random() * canvas.width / pixelSize),
        y: Math.floor(Math.random() * canvas.height / pixelSize)
    })
    game.addFruit({
        x: Math.floor(Math.random() * canvas.width / pixelSize),
        y: Math.floor(Math.random() * canvas.height / pixelSize)
    })
    game.addFruit({
        x: Math.floor(Math.random() * canvas.width / pixelSize),
        y: Math.floor(Math.random() * canvas.height / pixelSize)
    })
}

start()