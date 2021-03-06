const socket = io('/')

const scoresDiv = document.querySelector('.scores')
const restartBtn = document.querySelector('.gameover button')
const gameoverDiv = document.querySelector('.gameover')

const setupDiv = document.querySelector('.setup')
const usernameInput = setupDiv.querySelector('input')
const colorsDiv = setupDiv.querySelector('.colors')
const playBtn = setupDiv.querySelector('button')
const setupForm = setupDiv.querySelector('form')
const messageTemplate = document.querySelector('template.message-template')
const messageForm = document.querySelector('.chat form')
const messageInput = messageForm.querySelector('input')
const messagesDiv = document.querySelector('.messages')
const urlDiv = document.querySelector('.url')
const game = createGame()

let lastKey = null
let selfScore = 0
let player = socket.id
const pixelSize = 20
const screen = document.querySelector('canvas')
const ctx = screen.getContext('2d')
ctx.lineWidth = 1

const roomId = location.href.split('?')[1]
console.log(roomId)

socket.on('connected', () => {
    socket.emit('join-room', roomId)
})

socket.on('not-found', () => {
    location.href = '/'
})

socket.on('reconnect', () => {
    location.reload()
})

socket.on('messages', e => {
    messagesDiv.innerHTML = ''
    e.forEach(addMessage)
    messagesDiv.scrollTop = messagesDiv.scrollHeight
})
socket.on('message', e => {
    addMessage(e)
    messagesDiv.scrollTop = messagesDiv.scrollHeight
})


messageForm.onsubmit = (e) => {
    e.preventDefault()
    socket.emit('message', messageInput.value)
    messageInput.value = ''
}


setupForm.onsubmit = (e) => {
    e.preventDefault()
    playBtn.click()
}

playBtn.onclick = () => {
    if (!usernameInput.value) return
    socket.emit('play', {
        username: usernameInput.value,
        color: colorsDiv.querySelector('.selected').classList[0]
    })
    localStorage.setItem('player', JSON.stringify({
        username: usernameInput.value,
        color: colorsDiv.querySelector('.selected').classList[0]
    }))
    setupDiv.classList.add('hide')
}

if (localStorage.getItem('player')) {
    const player = JSON.parse(localStorage.getItem('player'))
    usernameInput.value = player.username
    try {
        colorsDiv.querySelector('.selected').classList.remove('selected')
    } catch (e) {}
    colorsDiv.querySelector(`.${player.color}`).classList.add('selected')
}

colorsDiv.onclick = (e) => {
    try {
        colorsDiv.querySelector('.selected').classList.remove('selected')
    } catch (e) {}
    e.target.classList.add('selected')
}


restartBtn.onclick = () => {
    socket.connect()
    setupDiv.classList.remove('hide')
}

socket.on('setup', (e) => {
    urlDiv.children[0].textContent = location.href
    urlDiv.children[0].href = location.href
    urlDiv.children[1].onclick = () => {
        navigator.clipboard.writeText(urlDiv.children[0].textContent)
    }
    player = socket.id
    game.state = e
    gameoverDiv.classList.remove('show')
})

socket.on('update', e => {
    game.state = e
})

socket.on('gameover', e => {
    gameoverDiv.classList.add('show')
    socket.disconnect()
})

socket.on('scores', e => {
    e.sort((a, b) => {
        return b.score - a.score
    })
    scoresDiv.innerHTML = ''
    e.forEach(({
        username,
        score,
        id
    }) => {
        const scoreWrapper = document.createElement('div')
        scoreWrapper.classList.add('score')
        const nameDiv = document.createElement('div')
        nameDiv.classList.add('score-name')
        const valueDiv = document.createElement('div')
        valueDiv.classList.add('score-value')
        nameDiv.textContent = username
        valueDiv.textContent = score
        if (id == socket.id) {
            scoreWrapper.classList.add('own-score')
            selfScore = score
        }
        scoreWrapper.appendChild(nameDiv)
        scoreWrapper.appendChild(valueDiv)
        scoresDiv.appendChild(scoreWrapper)
    })
})


function createGame() {
    const state = {
        players: {},
        fruits: {},
    }

    return {
        state
    }
}



function startRendering() {
    ctx.clearRect(0, 0, screen.width, screen.height)

    ctx.beginPath()
    ctx.strokeStyle = '#ddd'
    for (let i = 0; i < screen.width / pixelSize; i++) {
        for (let j = 0; j < screen.height / pixelSize; j++) {
            ctx.rect(i * pixelSize, j * pixelSize, pixelSize, pixelSize)
        }
    }
    ctx.stroke()
    ctx.beginPath()

    for (const playerId in game.state.players) {
        const player = game.state.players[playerId]

        for (const tailIndex in game.state.players[playerId].tail) {
            const tail = game.state.players[playerId].tail[tailIndex]
            ctx.fillStyle = player.tailColor
            ctx.fillRect(tail.x * pixelSize, tail.y * pixelSize, pixelSize, pixelSize)
        }

        if (playerId === socket.id) {
            ctx.strokeStyle = player.color
            ctx.strokeRect(player.x * pixelSize, player.y * pixelSize, pixelSize, pixelSize)
        } else {
            ctx.fillStyle = player.color
            ctx.fillRect(player.x * pixelSize, player.y * pixelSize, pixelSize, pixelSize)
        }
    }

    for (const fruitId in game.state.fruits) {
        const fruit = game.state.fruits[fruitId]
        ctx.fillStyle = fruit.value > 1 ? '#FFAE00' : '#f00'
        ctx.fillRect(fruit.x * pixelSize, fruit.y * pixelSize, pixelSize, pixelSize)
    }

    requestAnimationFrame(startRendering)
}



document.addEventListener('keydown', keyDownHandler)

function keyDownHandler(event) {
    if (!setupDiv.classList.contains('hide')) return
    const key = event.key.replace('ArrowDown', 's').replace('ArrowUp', 'w').replace('ArrowLeft', 'a').replace('ArrowRight', 'd')
    socket.emit('move', key)
}

function addMessage(message) {
    const messageDiv = messageTemplate.content.cloneNode(true)
    const messageText = messageDiv.querySelector('.message-text')
    const messageUsername = messageDiv.querySelector('.message-author')
    messageText.textContent = message.message
    messageUsername.textContent = message.author
    messagesDiv.appendChild(messageDiv)
}

startRendering()