import express from 'express'
import http from 'http'
import socketio from 'socket.io'
import {
    v4 as uuidV4
} from 'uuid'

const app = express()
const server = http.createServer(app)
const sockets = socketio(server)

app.use(express.static('public'))

sockets.on('connection', (socket) => {
    console.log(`> Client connected ${socket.id}`)
    socket.emit('connected')
    socket.on('disconnect', () => {
        console.log(`> Client disconnected ${socket.id}`)
    })

    socket.on('create', () => {
        const roomId = uuidV4()
        socket.emit('created', roomId)
        createRoom(roomId)
        socket.emit('created', roomId)
    })

    socket.on('join-room', (roomId) => {
        if (games[roomId]) {
            console.log(`> Client ${socket.id} joined room ${roomId}`)
            games[roomId].join(socket)
            socket.on('disconnect', () => {
                console.log(`> Client ${socket.id} left room ${roomId}`)
                if (games[roomId]) {
                    games[roomId].leave(socket)
                }
            })
        } else {
            socket.emit('not-found')
        }
    })
})


const commands = {
    '/restart': (id) => {
        startRoom(id)
    }
}
const canvas = {
    width: 600,
    height: 600
}
const pixelSize = 20
const delay = 125

const games = {}

let lastGameLength

setInterval(() => {
    if (lastGameLength != Object.keys(games).length) {
        console.log(`> Games running: ${Object.keys(games).length}`)
        lastGameLength = Object.keys(games).length
    }
}, 10)

function deleteRoom(roomId) {
    delete games[roomId]
    console.log(`> Room ${roomId} deleted`)
}

function createRoom(roomId) {
    games[roomId] = room(roomId)
    console.log(`> Room ${roomId} created`)
    startRoom(roomId)
}

function startRoom(roomId) {
    games[roomId].start()
}

function room(roomId) {
    const messages = []

    let closeCooldown = null

    function join(socket) {
        if (closeCooldown) {
            console.log(`> Someone connected to ${roomId} aborting countdown`)
            clearTimeout(closeCooldown)
            closeCooldown = null
        }
        socket.join(roomId)
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

        socket.emit('setup', game.state)
        socket.emit('messages', messages)
        updateScores()
        updateClients()
        socket.on('move', direction => {
            changeDirection(socket.id, direction)
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
            updateScores()
        })
        socket.on('message', e => {
            if (commands[e]) {
                commands[e](roomId)
                return
            }
            const message = {
                author: game.state.players[socket.id].username,
                message: e
            }
            messages.push(message)
            sockets.to(roomId).emit('message', message)
        })
    }

    function leave(socket) {
        game.removePlayer(socket.id)
        updateClients()
        updateScores()
        if (Object.keys(game.state.players).length == 0) {
            console.log(`> No player in room ${roomId} starting shutdown countdown`)
            closeCooldown = setTimeout(() => {
                deleteRoom(roomId)
            }, 10000)
        }
    }

    function updateScores() {
        sockets.to(roomId).emit('scores', getScores())
    }

    function updateClients() {
        sockets.to(roomId).emit('update', game.state)
    }

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
            y,
            value
        }) {
            if (canFruitSpawn(x, y)) {
                state.fruits[`x${x}y${y}`] = {
                    x,
                    y,
                    value: value
                }
            } else {
                addFruit({
                    x: Math.floor(Math.random() * canvas.width / pixelSize),
                    y: Math.floor(Math.random() * canvas.height / pixelSize),
                    value: value
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
                    players[testingPlayer].pointQueue = players[testingPlayer].pointQueue + fruit.value
                    players[testingPlayer].score = players[testingPlayer].score + fruit.value
                    removeFruit(fruit)
                    addFruit({
                        x: Math.floor(Math.random() * canvas.width / pixelSize),
                        y: Math.floor(Math.random() * canvas.height / pixelSize),
                        value: 1
                    })
                    updateScores()
                }
            }

            for (const p in players) {
                for (const playerId in players) {
                    for (const tailIndex in players[playerId].tail) {
                        try {
                            const tail = players[playerId].tail[tailIndex]
                            if (players[testingPlayer].x === tail.x && players[testingPlayer].y === tail.y) {
                                players[playerId].pointQueue = players[playerId].pointQueue + players[testingPlayer].score
                                let deadPlayer
                                if (testingPlayer == playerId) {
                                    deadPlayer = {
                                        x: players[testingPlayer].x,
                                        y: players[testingPlayer].y,
                                        score: players[testingPlayer].score,
                                    }
                                }
                                players[playerId].score = players[playerId].score + players[testingPlayer].score
                                removePlayer(testingPlayer)
                                if (deadPlayer) {
                                    addFruit({
                                        x: deadPlayer.x,
                                        y: deadPlayer.y,
                                        value: deadPlayer.score
                                    })
                                }
                                sockets.to(testingPlayer).emit('gameover')
                                updateScores()
                            }
                        } catch (e) {
                            console.log(tail, players[testingPlayer])
                            console.log(e)
                        }
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

        function addFruits(fruits) {
            for (const fruit of fruits) {
                addFruit(fruits[fruit])
            }
        }

        setInterval(movePlayers, delay)

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
            y: Math.floor(Math.random() * canvas.height / pixelSize),
            value: 1
        })
        game.addFruit({
            x: Math.floor(Math.random() * canvas.width / pixelSize),
            y: Math.floor(Math.random() * canvas.height / pixelSize),
            value: 1
        })
        game.addFruit({
            x: Math.floor(Math.random() * canvas.width / pixelSize),
            y: Math.floor(Math.random() * canvas.height / pixelSize),
            value: 1
        })
        sockets.to(roomId).emit('reconnect')
    }

    return {
        start,
        join,
        leave
    }
}

const port = process.env.PORT || 3000

server.listen(port, () => {
    console.log(`> Server listening on port ${port}`)
    console.log(`> http://localhost:${port}`)
})