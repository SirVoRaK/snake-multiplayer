import express from 'express'
import http from 'http'
import socketio from 'socket.io'

const app = express()
const server = http.createServer(app)
const sockets = socketio(server)

app.use(express.static('public'))

let stop = false

const canvas = {
    width: 600,
    height: 600
}
const pixelSize = 20

const delay = 100

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
        color: 'black',
        direction: undefined,
        lastDirection: undefined,
        pointQueue: 0
    })
    if (!stop) {
        game.state.players[socket.id].pointQueue = 100
        game.state.players[socket.id].score = 100
        stop = true
    }

    socket.emit('setup', game.state)
    sockets.sockets.emit('scores', getScores())
    updateClients()
    socket.on('move', direction => {
        //game.movePlayer(socket.id, direction)
        changeDirection(socket.id, direction)
        // updateClients()
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
            up: () => {
                players[player].y--
                if (players[player].y < 0) players[player].y = Math.floor(canvas.height / pixelSize - 1)
            },
            down: () => {
                players[player].y++
                if (players[player].y > Math.floor(canvas.height / pixelSize - 1)) players[player].y = 0
            },
            left: () => {
                players[player].x--
                if (players[player].x < 0) players[player].x = Math.floor(canvas.width / pixelSize - 1)
            },
            right: () => {
                players[player].x++
                if (players[player].x > Math.floor(canvas.width / pixelSize - 1)) players[player].x = 0
            }
        }
        /* moves.w = moves.arrowup
        moves.a = moves.arrowleft
        moves.s = moves.arrowdown
        moves.d = moves.arrowright */

        if (!players[player]) return

        if (moves[direction.toLowerCase()]) {
            players[player].tail.push({
                x: players[player].x,
                y: players[player].y,
            })

            const p = players[player]

            function moveToLast() {
                moves[p.lastDirection]()
                p.direction = p.lastDirection
            }

            if (p.score > 0) {
                if (p.direction == 'up' && p.lastDirection == 'down') {
                    moveToLast()
                } else if (p.direction == 'down' && p.lastDirection == 'up') {
                    moveToLast()
                } else if (p.direction == 'left' && p.lastDirection == 'right') {
                    moveToLast()
                } else if (p.direction == 'right' && p.lastDirection == 'left') {
                    moveToLast()
                } else {
                    p.lastDirection = p.direction
                    moves[p.direction]()
                }
            } else {
                moves[direction]()
                p.lastDirection = direction
            }


            if (players[player].pointQueue > 0) {
                players[player].pointQueue--
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
                players[testingPlayer].pointQueue++
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
                            players[playerId].pointQueue = players[playerId].pointQueue + players[testingPlayer].score
                            players[playerId].score = players[playerId].score + players[testingPlayer].score
                            removePlayer(testingPlayer)
                            sockets.to(testingPlayer).emit('gameover')
                            sockets.sockets.emit('scores', getScores())
                        }
                    } catch (e) {}
                }
            }
        }
    }

    function movePlayers() {
        for (const playerId in state.players) {
            try {
                movePlayer(playerId, state.players[playerId].direction)
            } catch (e) {}
        }
        updateClients()
    }

    let moveLoop = setInterval(movePlayers, delay)

    return {
        state,
        addPlayer,
        removePlayer,
        addFruit,
        removeFruit,
        movePlayer
    }
}

function changeDirection(id, direction) {
    const accepted = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        d: 'right',
        w: 'up',
        a: 'left',
        s: 'down'
    }
    if (!accepted[direction]) return

    const newDir = accepted[direction]
    if (!game.state.players[id]) return
    if (game.state.players[id].score > 0) {
        const cur = game.state.players[id].direction
        if (cur == 'down' && newDir == 'up') return
        if (cur == 'up' && newDir == 'down') return
        if (cur == 'left' && newDir == 'right') return
        if (cur == 'right' && newDir == 'left') return
    }

    game.state.players[id].direction = newDir
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