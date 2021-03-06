const socket = io('/')
const createBtn = document.querySelector('button.create')
const joinForm = document.querySelector('form')
const roomCode = joinForm.querySelector('input')

createBtn.onclick = () => {
    socket.emit('create')
}
socket.on('created', (data) => {
    console.log(data, location.href)
    location.href = `/room/?${data}`
})

joinForm.onsubmit = (e) => {
    e.preventDefault()
    if (roomCode.value.includes('http')) {
        location.href = roomCode.value
    } else {
        location.href = `/room/?${roomCode.value}`
    }
}